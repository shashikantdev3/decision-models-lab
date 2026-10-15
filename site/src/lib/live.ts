import {
  buildDecider,
  buildWriter,
  MockDecider,
  type DecisionModel,
  type Writer,
} from "@decision-models-lab/core";
import { tickets } from "./data.ts";
import type { Mode } from "./mode.tsx";

/** Builds a decider for the current mode. Live uses the visitor's own keys straight from the browser. */
export function deciderForMode(
  key: string,
  mode: Mode,
  keys: { openrouter: string; anthropic: string },
): DecisionModel {
  if (mode === "mock") return buildDecider(key, { keys: {}, mock: { tickets } });
  return buildDecider(key, {
    keys: { openrouter: keys.openrouter, anthropic: keys.anthropic },
    browser: true,
    maxTokens: 600,
  });
}

export function writerForMode(
  key: string,
  mode: Mode,
  keys: { openrouter: string; anthropic: string },
): Writer {
  if (mode === "mock") return buildWriter(key, { keys: {}, mock: { tickets } });
  return buildWriter(key, { keys: { anthropic: keys.anthropic }, browser: true, maxTokens: 600 });
}

/** A mock decider with no dataset knowledge, for questions the visitor writes. */
export function freeMock(modelId: string, run = 0): DecisionModel {
  return new MockDecider({ modelId, run });
}
