import type { DecisionResult, Draft, Ticket, TicketLabels, Writer } from "../types.ts";
import { callToolOnce, type AnthropicOptions } from "./anthropic.ts";
import { TEAMS, URGENCY, ticketContext } from "../questions.ts";
import { costFromTokens } from "../pricing.ts";
import { now } from "../util/random.ts";

export const WRITER_SYSTEM = `You are a senior support engineer at Contoso, a fictional SaaS company.
A fast decision model has already looked at this ticket and was not sure enough to route it alone.
Your job:
1. Decide the final labels: owning team, urgency, whether the customer is blocked, and whether the ticket contains personal data.
2. Give a short reason a colleague can check in ten seconds.
3. Draft a reply to the customer.

Rules for the reply:
- Answer what the customer asked, plainly, in under 120 words.
- Never repeat personal data from the ticket (emails, names, card digits, addresses).
- Never promise a refund, credit, discount or a specific date or time. Say the team will confirm.
- Be professional and warm. No filler.`;

function summarise(decision?: DecisionResult): string {
  if (!decision) return "No decision model output.";
  return Object.entries(decision.answers)
    .map(([id, a]) => {
      const probs = Object.entries(a.probabilities)
        .sort((x, y) => y[1] - x[1])
        .map(([k, p]) => `${k} ${p.toFixed(2)}`)
        .join(", ");
      return `- ${id}: ${probs}`;
    })
    .join("\n");
}

interface WriterOutput extends TicketLabels {
  reason: string;
  reply: string;
}

/** System Two step: Claude reviews an escalated ticket, settles the labels and drafts a reply. */
export class ClaudeWriter implements Writer {
  readonly id: string;
  readonly label: string;
  constructor(private readonly opts: AnthropicOptions) {
    this.id = opts.modelId;
    this.label = opts.label ?? opts.modelId;
  }

  async draft(
    input: { ticket: Ticket; decision?: DecisionResult },
    o?: { signal?: AbortSignal },
  ): Promise<Draft> {
    const started = now();
    const tool = {
      name: "submit_triage",
      description: "Submit the final labels, a short reason and the draft reply.",
      input_schema: {
        type: "object",
        properties: {
          team: { type: "string", enum: [...TEAMS] },
          urgency: { type: "string", enum: [...URGENCY] },
          customer_blocked: { type: "boolean" },
          contains_personal_data: { type: "boolean" },
          reason: { type: "string", description: "One short paragraph: why these labels." },
          reply: { type: "string", description: "The reply to send to the customer." },
        },
        required: ["team", "urgency", "customer_blocked", "contains_personal_data", "reason", "reply"],
      },
    };
    const user = [
      "Ticket:",
      ...ticketContext(input.ticket),
      "",
      "Decision model probabilities:",
      summarise(input.decision),
    ].join("\n");
    const call = await callToolOnce<WriterOutput>(this.opts, {
      system: WRITER_SYSTEM,
      user,
      tool,
      signal: o?.signal,
    });
    const { reason, reply, ...labels } = call.input;
    const { input_tokens = 0, output_tokens = 0 } = call.usage ?? {};
    return {
      writerId: this.id,
      labels: labels as TicketLabels,
      reason,
      reply,
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
