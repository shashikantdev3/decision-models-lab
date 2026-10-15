import type { DecisionModel, DecisionRequest, DecisionResult, ModelKind } from "../types.ts";
import { ProviderError, explainStatus, networkErrorMessage } from "../errors.ts";
import { normalizeProviderAnswer } from "./normalize.ts";
import { costFromTokens } from "../pricing.ts";
import { now } from "../util/random.ts";

export interface OpenRouterOptions {
  apiKey: string;
  modelId: string;
  label?: string;
  /** Defaults to https://openrouter.ai/api. Point it at the optional proxy if browser calls are blocked. */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Optional attribution headers OpenRouter shows on its dashboard. */
  appUrl?: string;
  appTitle?: string;
}

/** The body sent to POST /api/alpha/decisions. Exported so the site can show it. */
export function toDecisionsBody(modelId: string, req: DecisionRequest) {
  return { model: modelId, state: req.context, questions: req.questions };
}

/** TypeSafe Jev and Microsoft Decision-1 through OpenRouter's Decisions API. One class, model id passed in. */
export class OpenRouterDecisions implements DecisionModel {
  readonly id: string;
  readonly label: string;
  readonly kind: ModelKind = "decision";
  private readonly opts: OpenRouterOptions;

  constructor(opts: OpenRouterOptions) {
    this.opts = opts;
    this.id = opts.modelId;
    this.label = opts.label ?? opts.modelId;
  }

  async decide(req: DecisionRequest, o?: { signal?: AbortSignal }): Promise<DecisionResult> {
    const url = `${this.opts.baseUrl ?? "https://openrouter.ai/api"}/alpha/decisions`;
    const f = this.opts.fetchImpl ?? fetch;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
      "Content-Type": "application/json",
    };
    if (this.opts.appUrl) headers["HTTP-Referer"] = this.opts.appUrl;
    if (this.opts.appTitle) headers["X-Title"] = this.opts.appTitle;

    const started = now();
    let res: Response;
    try {
      res = await f(url, {
        method: "POST",
        headers,
        body: JSON.stringify(toDecisionsBody(this.id, req)),
        signal: o?.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      throw new ProviderError(networkErrorMessage("openrouter", err), "openrouter", undefined, err);
    }
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg = (body as { error?: { message?: string } })?.error?.message;
      throw new ProviderError(explainStatus("openrouter", res.status, msg), "openrouter", res.status, body);
    }
    const latencyMs = now() - started;
    return parseDecisionsResponse(this.id, req, body, latencyMs);
  }
}

/** Turns a raw Decisions API response into a DecisionResult. Kept separate so tests can feed fixtures. */
export function parseDecisionsResponse(
  modelId: string,
  req: DecisionRequest,
  body: unknown,
  latencyMs: number,
): DecisionResult {
  const b = body as {
    model?: string;
    answers?: Record<string, unknown>;
    usage?: { input_tokens?: number; output_tokens?: number; cost?: number };
  };
  if (!b || typeof b !== "object" || !b.answers) {
    throw new ProviderError("OpenRouter returned a response without answers.", "openrouter", 200, body);
  }
  const answers: DecisionResult["answers"] = {};
  for (const [qid, q] of Object.entries(req.questions)) {
    const raw = b.answers[qid];
    if (raw === undefined)
      throw new ProviderError(`The response has no answer for question "${qid}".`, "openrouter", 200, body);
    answers[qid] = normalizeProviderAnswer(raw, q);
  }
  const inputTokens = b.usage?.input_tokens ?? 0;
  const outputTokens = b.usage?.output_tokens ?? 0;
  return {
    modelId,
    servedModel: b.model,
    answers,
    latencyMs,
    usage: {
      inputTokens,
      outputTokens,
      costUsd: b.usage?.cost ?? costFromTokens(modelId, inputTokens, outputTokens),
    },
    raw: body,
  };
}
