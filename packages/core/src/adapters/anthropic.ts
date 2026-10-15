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
}

interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Calls the Messages API and forces one tool call, so the output is structured JSON.
 * Tries temperature 0 first; if the model rejects the temperature parameter, retries once without it.
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
  for (let attempt = 0; attempt < 2; attempt++) {
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
      if (res.status === 400 && attempt === 0 && msg && /temperature/i.test(msg)) {
        delete body.temperature;
        temperatureIgnored = true;
        continue;
      }
      throw new ProviderError(explainStatus("anthropic", res.status, msg), "anthropic", res.status, json);
    }
    const content = (json.content as Array<{ type: string; name?: string; input?: unknown }>) ?? [];
    const call = content.find((c) => c.type === "tool_use" && c.name === args.tool.name);
    if (!call)
      throw new ProviderError("Claude did not return the structured answer.", "anthropic", 200, json);
    return {
      input: call.input as T,
      usage: json.usage as { input_tokens: number; output_tokens: number },
      raw: json,
      temperatureIgnored,
    };
  }
  throw new ProviderError("Claude rejected the request twice.", "anthropic");
}
