/**
 * Wording sensitivity: ask the same four questions in their original wording and three rewordings.
 *   npm run wording -- --model jev
 *   npm run wording -- --model decision-1 --mock
 * One call per ticket per wording (4 per ticket). Reports flip rate and average probability shift.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  costFromTokens,
  estimateTokens,
  findDecider,
  flipRate,
  mapPool,
  meanProbabilityShift,
  ticketContext,
  type DecisionRequest,
  type Question,
  type WordingFile,
  type WordingItem,
} from "../../core/src/index.ts";
import {
  arg,
  flag,
  confirm,
  p,
  loadDataset,
  loadQuestions,
  provenance,
  outDir,
  writeJson,
  ResponseCache,
  Budget,
  runner,
  deciderFor,
  usd,
  pct,
  mockBanner,
} from "./shared.ts";

const mock = flag("mock");
const e = findDecider(arg("model", "jev")!);
const limit = Number(arg("limit", "0"));
const { tickets: all, info: dataset } = loadDataset();
const tickets = limit ? all.slice(0, limit) : all;
const qs = loadQuestions();
const rw = JSON.parse(readFileSync(p("data/rewordings.v1.json"), "utf8")) as {
  rewordings: Record<string, Pick<Question, "instructions" | "criteria">[]>;
};
if (mock) mockBanner();

const variants: Record<string, Question>[] = [0, 1, 2, 3].map((v) =>
  Object.fromEntries(
    Object.entries(qs.triage).map(([id, q]) => [id, v === 0 ? q : { ...q, ...rw.rewordings[id][v - 1] }]),
  ),
);
const requests = tickets.flatMap((t) =>
  variants.map((questions, v) => ({
    t,
    v,
    req: { context: ticketContext(t), questions } as DecisionRequest,
  })),
);
const est = requests.reduce(
  (s, r) =>
    s +
    costFromTokens(
      e.id,
      estimateTokens(r.req) + (e.kind === "decision" ? 0 : 420),
      e.kind === "decision" ? 2 : 160,
    ),
  0,
);
console.log(`Wording test on ${e.label}: ${requests.length} calls, estimated ${usd(est)}.`);
if (!mock && requests.length > 10 && !flag("yes") && !(await confirm("Go ahead?"))) process.exit(0);

const r = runner(deciderFor(e.key, all, mock), {
  cache: new ResponseCache(flag("fresh")),
  budget: new Budget(Number(arg("max-usd", "2"))),
  mock,
});
const results = await mapPool(requests, Number(arg("concurrency", "4")), async (x) => ({
  ...x,
  res: await r.call(x.req, `wording:v${x.v}:${x.t.id}`, est / requests.length),
}));

const items: WordingItem[] = [];
for (const t of tickets) {
  for (const qid of Object.keys(qs.triage)) {
    const rows = results.filter((x) => x.t.id === t.id).sort((a, b) => a.v - b.v);
    items.push({
      ticketId: t.id,
      questionId: qid,
      tops: rows.map((x) => x.res.answers[qid].top),
      dists: rows.map((x) => x.res.answers[qid].probabilities),
    });
  }
}
const byQuestion = Object.fromEntries(
  Object.keys(qs.triage).map((qid) => {
    const it = items.filter((i) => i.questionId === qid);
    return [
      qid,
      {
        flipRate: flipRate(it.map((i) => i.tops)),
        meanProbabilityShift: meanProbabilityShift(it.map((i) => i.dists)),
      },
    ];
  }),
);
const file: WordingFile = {
  schema: 1,
  kind: "wording",
  model: { key: e.key, id: e.id, label: e.label, kind: e.kind },
  provenance: provenance({ runs: 1, questionSet: `${qs.version}+rewordings.v1`, dataset, mock }),
  items,
  metrics: {
    flipRate: flipRate(items.map((i) => i.tops)),
    meanProbabilityShift: meanProbabilityShift(items.map((i) => i.dists)),
    byQuestion,
  },
};
for (const [qid, m] of Object.entries(byQuestion))
  console.log(
    `  ${qid.padEnd(24)} flip rate ${pct(m.flipRate)}  mean shift ${m.meanProbabilityShift.toFixed(3)}`,
  );
console.log(
  `Overall flip rate ${pct(file.metrics.flipRate)}, mean probability shift ${file.metrics.meanProbabilityShift.toFixed(3)}.`,
);
const out = resolve(outDir(mock), `wording-${e.key}.json`);
writeJson(out, file);
console.log(`Wrote ${out}`);
