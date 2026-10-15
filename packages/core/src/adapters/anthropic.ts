import { ProviderError, explainStatus, networkErrorMessage } from "../errors.ts";

export interface AnthropicOptions {
  apiKey: string;
  modelId: string;
  label?: string;
  /** Set true when calling from a browser. Sends anthropic-dangerous-direct-browser-access. */
  browser?: boolean;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxTokens?: number;
}

export interface AnthropicToolCall<T> {
  input: T;
  usage: { input_tokens: number; output_tokens: number };
  raw: unknown;
  temperatureIgnored: boolean;
  /** True when the model rejected a forced tool_choice and the call fell back to auto. */
  toolChoiceRelaxed: boolean;
}

interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Calls the Messages API and forces one tool call, so the output is structured JSON.
 * Tries temperature 0 and a forced tool call first. If the model rejects either, retries without it
 * (tool_choice falls back to auto with an instruction to call the tool).
 */
export async function callToolOnce<T>(
  opts: AnthropicOptions,
  args: { system: string; user: string; tool: Tool; signal?: AbortSignal },
): Promise<AnthropicToolCall<T>> {
  const url = `${opts.baseUrl ?? "https://api.anthropic.com"}/v1/messages`;
  const f = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    "x-api-key": opts.apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (opts.browser) headers["anthropic-dangerous-direct-browser-access"] = "true";

  const body: Record<string, unknown> = {
    model: opts.modelId,
    max_tokens: opts.maxTokens ?? 600,
    temperature: 0,
    system: args.system,
    tools: [args.tool],
    tool_choice: { type: "tool", name: args.tool.name },
    messages: [{ role: "user", content: args.user }],
  };

  let temperatureIgnored = false;
  let toolChoiceRelaxed = false;
  // Some newer models reject temperature or a forced tool_choice. Each is dropped at most once, then the call is retried.
  const required = (args.tool.input_schema.required as string[] | undefined) ?? [];
  let incompleteRetries = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    let res: Response;
    try {
      res = await f(url, { method: "POST", headers, body: JSON.stringify(body), signal: args.signal });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") throw err;
      throw new ProviderError(networkErrorMessage("anthropic", err), "anthropic", undefined, err);
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = (json.error as { message?: string } | undefined)?.message;
      if (res.status === 400 && msg && /temperature/i.test(msg) && !temperatureIgnored) {
        delete body.temperature;
        temperatureIgnored = true;
        continue;
      }
      if (res.status === 400 && msg && /tool_choice/i.test(msg) && !toolChoiceRelaxed) {
        body.tool_choice = { type: "auto" };
        body.system = `${args.system}\n\nAnswer only by calling the ${args.tool.name} tool. Do not write any other text.`;
        toolChoiceRelaxed = true;
        continue;
      }
      throw new ProviderError(explainStatus("anthropic", res.status, msg), "anthropic", res.status, json);
    }
    const content = (json.content as Array<{ type: string; name?: string; input?: unknown }>) ?? [];
    const call = content.find((c) => c.type === "tool_use" && c.name === args.tool.name);
    const missing = call
      ? required.filter((k) => (call.input as Record<string, unknown>)?.[k] === undefined)
      : required;
    // Without a forced tool call a model can skip the tool or leave fields out. Models that think before
    // answering can also run out of tokens mid-answer. Ask again, at most twice, with more room if it ran out.
    if ((!call || missing.length) && incompleteRetries < 2) {
      incompleteRetries++;
      if (json.stop_reason === "max_tokens") body.max_tokens = Math.min(Number(body.max_tokens) * 2, 4096);
      continue;
    }
    if (!call)
      throw new ProviderError("Claude did not return the structured answer.", "anthropic", 200, json);
    if (missing.length)
      throw new ProviderError(
        `Claude's answer is missing ${missing.join(", ")} after three tries.`,
        "anthropic",
        200,
        json,
      );
    return {
      input: call.input as T,
      usage: json.usage as { input_tokens: number; output_tokens: number },
      raw: json,
      temperatureIgnored,
      toolChoiceRelaxed,
    };
  }
  throw new ProviderError("Claude did not return a usable answer after five tries.", "anthropic");
}
