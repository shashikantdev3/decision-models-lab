/**
 * Hello World: one request with a yes/no, a choice and a scale question, sent to both decision models.
 *   npm run hello -- --mock                 offline, no key: replays the answers recorded from the real API
 *   npm run hello                           live, both models, about $0.00003 in total
 *   npm run hello -- --model decision-1     one model
 *   npm run hello -- --verbose              also print the request and the raw response
 *   npm run hello -- --save-fixture         save each live response as a test fixture
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  findDecider,
  parseDecisionsResponse,
  toDecisionsBody,
  type DecisionRequest,
  type DecisionResult,
} from "../../core/src/index.ts";
import { arg, flag, deciderFor, keys, p, today, writeJson } from "./shared.ts";

const mock = flag("mock");
const verbose = flag("verbose");
const models = (arg("model", "jev,decision-1") ?? "jev,decision-1").split(",");
const fx = JSON.parse(readFileSync(p("packages/core/test/fixtures/documented-shape.triage.json"), "utf8"));
const req: DecisionRequest = { context: fx.request.state, questions: fx.request.questions };

if (!mock && !keys().openrouter) {
  console.error(
    [
      "No OpenRouter key found in .env.",
      "",
      "  Run it for real (recommended):",
      "    1. Add credit at https://openrouter.ai/settings/credits ($5 is plenty; this run costs about $0.00003)",
      "    2. Create a key at https://openrouter.ai/settings/keys and give it a credit limit",
      "    3. Copy .env.example to .env and set OPENROUTER_API_KEY=sk-or-v1-...",
      "    4. npm run hello",
      "",
      "  Or try it offline first, with answers recorded from the real API:",
      "    npm run hello -- --mock",
    ].join("\n"),
  );
  process.exit(1);
}

/** The same six lines the one-file examples print, so every route to Hello World looks the same. */
export function summary(r: DecisionResult): string {
  const f = (n: number) => n.toFixed(2);
  const { urgent, team, severity } = r.answers;
  const others = Object.entries(team.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${f(v)}`)
    .join(", ");
  return [
    `model     ${r.servedModel ?? r.modelId}`,
    `urgent    yes ${f(Number(urgent.value))}`,
    `team      ${team.top} ${f(team.probabilities[team.top])}   confidence ${f(team.confidence ?? 0)}   (${others})`,
    `severity  ${severity.top} ${f(severity.probabilities[severity.top])}   position ${f(Number(severity.value))} on 0 to 3`,
    `cost      $${r.usage.costUsd.toFixed(7)} for ${r.usage.inputTokens} input tokens (output is free)`,
    `time      ${Math.round(r.latencyMs)} ms`,
  ].join("\n");
}

/** Offline, Hello World replays the newest real response saved for this model, so beginners see real answers. */
function recorded(key: string): { result: DecisionResult; when: string } | undefined {
  const dir = p("packages/core/test/fixtures");
  const file = readdirSync(dir)
    .filter((f) => f.startsWith(`live.${key}.`) && f.endsWith(".json"))
    .sort()
    .at(-1);
  if (!file) return undefined;
  const c = JSON.parse(readFileSync(resolve(dir, file), "utf8"));
  const entry = findDecider(key);
  const result = parseDecisionsResponse(entry.id, req, c.response, c.latencyMs ?? 0);
  return { result, when: String(c._source).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "earlier" };
}

if (mock) {
  console.log("\n[OFFLINE] No call is made. Each model's answer below was recorded from the real API.\n");
}
console.log("Ticket:   Checkout returns HTTP 500 for all users since 10:05.");
console.log("Asking:   urgent (yes/no), team (payments, auth, infra), severity (Cosmetic to Critical)");

for (const key of models) {
  const entry = findDecider(key);
  const replay = mock ? recorded(entry.key) : undefined;
  const model = deciderFor(key, [], mock);
  console.log(
    `\n${entry.label}${replay ? ` (recorded ${replay.when})` : mock ? " (mock, made-up answers)" : ""}`,
  );
  if (verbose) {
    console.log("Request body:");
    console.log(JSON.stringify(toDecisionsBody(entry.id, req), null, 2));
  }
  try {
    const r = replay ? replay.result : await model.decide(req);
    if (verbose) {
      console.log("Raw response:");
      console.log(JSON.stringify(r.raw, null, 2));
    }
    console.log(summary(r));
    if (flag("save-fixture") && !mock) {
      const file = resolve(p("packages/core/test/fixtures"), `live.${entry.key}.${today()}.json`);
      writeJson(file, {
        _source: `Live capture from ${entry.id} on ${new Date().toISOString()}`,
        latencyMs: r.latencyMs,
        request: toDecisionsBody(entry.id, req),
        response: r.raw,
      });
      console.log(`Saved ${file}`);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(
    mock
      ? "\nThat was offline. Add your key to .env and run `npm run hello` to ask the models yourself."
      : "\nNext: `npm run dev` opens the site on http://localhost:5173. To pick something to build, see CONTRIBUTING.md.",
  );
  if (!verbose) console.log("Add --verbose to see the request and the raw response.");
}
