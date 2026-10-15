/**
 * Contract tests against the real APIs. Skipped unless LIVE=1. They spend a fraction of a cent.
 *   npm run test:live
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { OpenRouterDecisions, ClaudeDecider } from "../src/index.ts";
import { fixture, root, toRequest } from "./helpers.ts";

const live = process.env.LIVE === "1";
if (live && existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));
const req = toRequest(fixture("documented-shape.triage.json").request);

describe.skipIf(!live)("live: OpenRouter Decisions API", () => {
  for (const modelId of ["typesafe/jev-1.14", "microsoft/microsoft-decision-1-20261009"]) {
    it(`${modelId} answers noul, choice and score in one request`, async () => {
      const m = new OpenRouterDecisions({ apiKey: process.env.OPENROUTER_API_KEY!, modelId });
      const r = await m.decide(req);
      expect(r.answers.urgent.type).toBe("noul");
      expect(r.answers.team.type).toBe("choice");
      expect(r.answers.severity.type).toBe("score");
      expect(r.usage.costUsd).toBeGreaterThanOrEqual(0);
    }, 30_000);
  }
});

describe.skipIf(!live)("live: Claude as decider", () => {
  it("returns a probability for every option", async () => {
    const m = new ClaudeDecider({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      modelId: "claude-haiku-4-5-20251001",
    });
    const r = await m.decide(req);
    expect(Object.keys(r.answers.team.probabilities).sort()).toEqual(["auth", "infra", "payments"]);
  }, 60_000);
});
