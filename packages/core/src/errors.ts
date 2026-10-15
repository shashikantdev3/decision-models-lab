export type ProviderName = "openrouter" | "anthropic";

/** An error with a message a person can act on. `status` is the HTTP status when there was one. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderName,
    public readonly status?: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  get retryable(): boolean {
    return this.status === undefined || this.status === 429 || this.status >= 500;
  }
}

const host: Record<ProviderName, string> = {
  openrouter: "openrouter.ai",
  anthropic: "console.anthropic.com",
};

export function explainStatus(provider: ProviderName, status: number, providerMessage?: string): string {
  const name = provider === "openrouter" ? "OpenRouter" : "Anthropic";
  const tail = providerMessage ? ` (${name} said: ${providerMessage})` : "";
  switch (status) {
    case 400:
      return `${name} rejected the request as malformed. Check the model id and the question format.${tail}`;
    case 401:
      return `${name} rejected this key. Check the key and its credit limit on ${host[provider]}.${tail}`;
    case 402:
      return `${name} says the account is out of credit. Add credit or raise the key's limit on ${host[provider]}.${tail}`;
    case 403:
      return `${name} refused access with this key. Check the key's permissions on ${host[provider]}.${tail}`;
    case 404:
      return `${name} does not know this model or endpoint. Check the model id in config/models.json.${tail}`;
    case 413:
      return `The request is too large for this model. Shorten the context.${tail}`;
    case 429:
      return `${name} is rate limiting these calls. Wait a moment or lower the concurrency.${tail}`;
    case 529:
      return `The model provider is overloaded. Try again in a minute.${tail}`;
    default:
      if (status >= 500)
        return `${name} or the model provider failed (HTTP ${status}). Try again shortly.${tail}`;
      return `${name} returned HTTP ${status}.${tail}`;
  }
}

export function networkErrorMessage(provider: ProviderName, err: unknown): string {
  const name = provider === "openrouter" ? "OpenRouter" : "Anthropic";
  const reason = err instanceof Error ? err.message : String(err);
  return `Could not reach ${name} (${reason}). Check your connection. In a browser this can also mean the provider blocks direct browser calls (CORS); see docs/03-hello-world.md.`;
}
