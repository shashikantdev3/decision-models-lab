/**
 * Hello World: one decision call with a noul, a choice and a score question.
 *   npm run hello -- --model jev            (live: about $0.00001)
 *   npm run hello -- --model decision-1
 *   npm run hello -- --model jev,decision-1 --save-fixture
 *   npm run hello -- --mock                 (offline, no key)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findDecider, toDecisionsBody, type DecisionRequest } from "../../core/src/index.ts";
import { arg, flag, deciderFor, p, today, writeJson, usd, mockBanner } from "./shared.ts";

const mock = flag("mock");
const models = (arg("model", "jev") ?? "jev").split(",");
const fx = JSON.parse(readFileSync(p("packages/core/test/fixtures/documented-shape.triage.json"), "utf8"));
const req: DecisionRequest = { context: fx.request.state, questions: fx.request.questions };

if (mock) mockBanner();
for (const key of models) {
  const entry = findDecider(key);
  const model = deciderFor(key, [], mock);
  console.log(`\n=== ${entry.label} (${entry.id})`);
  console.log("Request body:");
  console.log(JSON.stringify(toDecisionsBody(entry.id, req), null, 2));
  try {
    const r = await model.decide(req);
    console.log("\nRaw response:");
    console.log(JSON.stringify(r.raw, null, 2));
    console.log("\nAnswers:");
    for (const [id, a] of Object.entries(r.answers)) {
      const probs = Object.entries(a.probabilities)
        .map(([k, v]) => `${k} ${v.toFixed(2)}`)
        .join(", ");
      console.log(
        `  ${id.padEnd(9)} ${a.type.padEnd(6)} top=${a.top}  confidence=${a.confidence?.toFixed(2)}  [${probs}]`,
      );
    }
    console.log(
      `\nLatency ${r.latencyMs.toFixed(0)} ms  |  tokens in ${r.usage.inputTokens}, out ${r.usage.outputTokens}  |  cost ${usd(r.usage.costUsd)}  |  served by ${r.servedModel ?? "?"}`,
    );
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
    console.error(`\n${(err as Error).message}`);
    process.exitCode = 1;
  }
}
