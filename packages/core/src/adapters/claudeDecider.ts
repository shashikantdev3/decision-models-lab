import type { DecisionModel, DecisionRequest, DecisionResult, ModelKind, Question } from "../types.ts";
import { callToolOnce, type AnthropicOptions } from "./anthropic.ts";
import { choiceAnswer, noulAnswer, scoreAnswer } from "./normalize.ts";
import { optionsOf } from "../questions.ts";
import { costFromTokens } from "../pricing.ts";
import { now } from "../util/random.ts";

const prob = { type: "number", minimum: 0, maximum: 1 };

function schemaFor(q: Question) {
  if (q.type === "noul") {
    return {
      type: "object",
      properties: { p_yes: { ...prob, description: "Probability that the answer is yes (true)." } },
      required: ["p_yes"],
    };
  }
  const opts = optionsOf(q);
  return {
    type: "object",
    description: "A probability for every option. They must sum to 1.",
    properties: Object.fromEntries(opts.map((o) => [o, prob])),
    required: opts,
  };
}

function describe(id: string, q: Question): string {
  if (q.type === "noul") {
    const c = q.criteria as { true: string; false: string };
    return `- ${id} (yes/no): ${q.instructions}\n  yes means: ${c.true}\n  no means: ${c.false}`;
  }
  if (q.type === "score") {
    return `- ${id} (ordered scale, lowest first): ${q.instructions}\n  levels: ${(q.criteria as string[]).join(" < ")}`;
  }
  const lines = Object.entries(q.criteria as Record<string, string>).map(([k, v]) => `  ${k}: ${v}`);
  return `- ${id} (pick one): ${q.instructions}\n${lines.join("\n")}`;
}

/**
 * Asks Claude the same typed questions a decision model gets, and forces a JSON tool output with
 * a probability per option. These are probabilities Claude writes down, not calibrated model outputs.
 * It exists so the lab can compare the two approaches on the same tickets.
 */
export class ClaudeDecider implements DecisionModel {
  readonly id: string;
  readonly label: string;
  readonly kind: ModelKind = "llm-as-decider";
  constructor(private readonly opts: AnthropicOptions) {
    this.id = opts.modelId;
    this.label = opts.label ?? opts.modelId;
  }

  async decide(req: DecisionRequest, o?: { signal?: AbortSignal }): Promise<DecisionResult> {
    const started = now();
    const tool = {
      name: "record_decisions",
      description: "Record a probability for every answer of every question.",
      input_schema: {
        type: "object",
        properties: Object.fromEntries(Object.entries(req.questions).map(([id, q]) => [id, schemaFor(q)])),
        required: Object.keys(req.questions),
      },
    };
    const user = [
      "Context:",
      ...req.context,
      "",
      "Questions (answer each one on its own, without using your other answers):",
      ...Object.entries(req.questions).map(([id, q]) => describe(id, q)),
    ].join("\n");
    const call = await callToolOnce<Record<string, Record<string, number>>>(this.opts, {
      system:
        "You are a classifier. Read the context and give honest probabilities for each answer. " +
        "Use values near 0.5 when you are unsure. Do not write any prose; only call the tool.",
      user,
      tool,
      signal: o?.signal,
    });
    const answers: DecisionResult["answers"] = {};
    for (const [id, q] of Object.entries(req.questions)) {
      const a = call.input[id] ?? {};
      if (q.type === "noul") answers[id] = noulAnswer(Number(a.p_yes ?? 0.5));
      else if (q.type === "choice") answers[id] = choiceAnswer(a);
      else answers[id] = scoreAnswer(optionsOf(q), a);
    }
    const { input_tokens = 0, output_tokens = 0 } = call.usage ?? {};
    return {
      modelId: this.id,
      servedModel: (call.raw as { model?: string }).model,
      answers,
      latencyMs: now() - started,
      usage: {
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        costUsd: costFromTokens(this.id, input_tokens, output_tokens),
      },
      raw: call.raw,
    };
  }
}
