import modelsJson from "../../../config/models.json";
import type { DecisionModel, ModelKind, Ticket, Writer } from "./types.ts";
import { OpenRouterDecisions } from "./adapters/openrouter.ts";
import { ClaudeDecider } from "./adapters/claudeDecider.ts";
import { ClaudeWriter } from "./adapters/claudeWriter.ts";
import { MockDecider, MockWriter, createMockOracle } from "./adapters/mock.ts";

export interface DeciderEntry {
  key: string;
  id: string;
  alias?: string;
  label: string;
  kind: ModelKind;
  adapter: "openrouter-decisions" | "claude-decider";
  provider: "openrouter" | "anthropic";
  contextTokens: number;
  longContextBytes?: number;
  questionTypes: string[];
  color: "jev" | "decision1" | "claude";
}

export interface WriterEntry {
  key: string;
  id: string;
  label: string;
  provider: "anthropic";
}

export const modelsConfig = modelsJson as unknown as { deciders: DeciderEntry[]; writers: WriterEntry[] };

export function findDecider(keyOrId: string): DeciderEntry {
  const e = modelsConfig.deciders.find((d) => d.key === keyOrId || d.id === keyOrId || d.alias === keyOrId);
  if (!e) {
    const known = modelsConfig.deciders.map((d) => d.key).join(", ");
    throw new Error(`Unknown model "${keyOrId}". Known: ${known}. Add it to config/models.json.`);
  }
  return e;
}

export function findWriter(keyOrId: string): WriterEntry {
  const e = modelsConfig.writers.find((d) => d.key === keyOrId || d.id === keyOrId);
  if (!e) {
    const known = modelsConfig.writers.map((d) => d.key).join(", ");
    throw new Error(`Unknown writer "${keyOrId}". Known: ${known}. Add it to config/models.json.`);
  }
  return e;
}

export interface Keys {
  openrouter?: string;
  anthropic?: string;
}

export interface BuildOptions {
  keys: Keys;
  /** Use offline stand-ins. Needs the tickets so the mock knows the labels. */
  mock?: { tickets: Ticket[]; run?: number; simulateLatency?: boolean };
  browser?: boolean;
  openrouterBaseUrl?: string;
  maxTokens?: number;
}

function needKey(k: string | undefined, name: string): string {
  if (!k) {
    throw new Error(
      name === "openrouter"
        ? "No OpenRouter key. Put OPENROUTER_API_KEY in .env, or run with --mock."
        : "No Anthropic key. Put ANTHROPIC_API_KEY in .env, or run with --mock.",
    );
  }
  return k;
}

export function buildDecider(keyOrId: string, o: BuildOptions): DecisionModel {
  const e = findDecider(keyOrId);
  if (o.mock) {
    return new MockDecider({
      modelId: e.id,
      label: `${e.label} (mock)`,
      kind: e.kind,
      oracle: createMockOracle(o.mock.tickets),
      run: o.mock.run,
      simulateLatency: o.mock.simulateLatency,
    });
  }
  if (e.adapter === "openrouter-decisions") {
    return new OpenRouterDecisions({
      apiKey: needKey(o.keys.openrouter, "openrouter"),
      modelId: e.id,
      label: e.label,
      baseUrl: o.openrouterBaseUrl,
      appTitle: "Decision Models Lab",
      appUrl: "https://github.com/shashikantdev3/decision-models-lab",
    });
  }
  return new ClaudeDecider({
    apiKey: needKey(o.keys.anthropic, "anthropic"),
    modelId: e.id,
    label: e.label,
    browser: o.browser,
    maxTokens: o.maxTokens,
  });
}

export function buildWriter(keyOrId: string, o: BuildOptions): Writer {
  const e = findWriter(keyOrId);
  if (o.mock) {
    return new MockWriter({
      modelId: e.id,
      label: `${e.label} (mock)`,
      run: o.mock.run,
      simulateLatency: o.mock.simulateLatency,
    });
  }
  return new ClaudeWriter({
    apiKey: needKey(o.keys.anthropic, "anthropic"),
    modelId: e.id,
    label: e.label,
    browser: o.browser,
    maxTokens: o.maxTokens ?? 600,
  });
}
