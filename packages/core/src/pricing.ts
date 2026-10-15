import pricingJson from "../../../config/pricing.json";

export interface Price {
  input: number;
  output: number;
  checked: string;
  source: string;
  note?: string;
}

export const pricing = pricingJson as unknown as { models: Record<string, Price> };

/** USD for a call, from config/pricing.json (USD per million tokens). Returns 0 for unknown models. */
export function costFromTokens(modelId: string, inputTokens: number, outputTokens: number): number {
  const p = pricing.models[modelId];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export function priceOf(modelId: string): Price | undefined {
  return pricing.models[modelId];
}
