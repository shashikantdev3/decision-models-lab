/**
 * Benchmark: every model answers the same questions on every ticket, several times.
 *   npm run bench -- --models jev,decision-1,claude-haiku --runs 3
 *   npm run bench -- --mock                         (offline; output goes to .cache/mock-results)
 * Options: --dataset data/tickets.jsonl  --runs 3  --concurrency 4  --max-usd 2  --limit N  --fresh  --yes  --region "..."
 */
import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  buildTriageRequest,
  estimateTokens,
  costFromTokens,
  findDecider,
  mapPool,
  summarizeBench,
  type BenchCall,
  type BenchFile,
  type BenchModelInfo,
  type SummaryFile,
} from "../../core/src/index.ts";
import {
  arg,
  flag,
  confirm,
  loadDataset,
  loadQuestions,
  provenance,
  outDir,
  writeJson,
  ResponseCache,
  Budget,
  BudgetExceeded,
  runner,
  deciderFor,
  usd,
  pct,
  printTable,
  openRouterUsage,
  mockBanner,
} from "./shared.ts";

const mock = flag("mock");
const modelKeys = (arg("models", "jev,decision-1,claude-haiku") ?? "").split(",").filter(Boolean);
const runs = Number(arg("runs", "3"));
const concurrency = Number(arg("concurrency", "4"));
const maxUsd = Number(arg("max-usd", "2"));
const limit = Number(arg("limit", "0"));
const WARMUPS = 3;
const PILOT = 5;

const { tickets: allTickets, info: dataset } = loadDataset();
const tickets = limit ? allTickets.slice(0, limit) : allTickets;
const questions = loadQuestions(arg("questions", "v1"));
const cache = new ResponseCache(flag("fresh"));
const budget = new Budget(maxUsd);
const dir = outDir(mock);
if (mock) mockBanner();

// ---- Estimate -----------------------------------------------------------------------------------
const perCallTokens = tickets.map((t) => estimateTokens(buildTriageRequest(t, questions)));
const avgTokens = perCallTokens.reduce((a, b) => a + b, 0) / perCallTokens.length;
const estimates = modelKeys.map((k) => {
  const e = findDecider(k);
  const calls = runs * tickets.length + WARMUPS;
  const extraIn = e.kind === "llm-as-decider" ? 420 : 0;
  const out = e.kind === "llm-as-decider" ? 160 : 2;
  return { e, calls, usd: costFromTokens(e.id, calls * (avgTokens + extraIn), calls * out) };
});
const totalEstimate = estimates.reduce((s, x) => s + x.usd, 0);
console.log(`Bench: ${tickets.length} tickets x ${runs} runs (+${WARMUPS} warm-up calls per model)`);
printTable([["model", "calls", "estimated cost"], ...estimates.map((x) => [x.e.label, x.calls, usd(x.usd)])]);
console.log(
  `Total estimate ${usd(totalEstimate)}. Budget cap ${usd(maxUsd)} (--max-usd). Cached calls are free.`,
);
if (!mock) {
  if (totalEstimate > maxUsd) {
    console.error(
      "The estimate is above the budget cap. Raise --max-usd or use fewer models, runs or tickets.",
    );
    process.exit(1);
  }
  if (tickets.length > 10 && !flag("yes") && !(await confirm("Spend up to this amount?"))) {
    console.log("Stopped. Nothing was spent.");
    process.exit(0);
  }
}

const usageBefore = mock ? undefined : await openRouterUsage();
const summaries: SummaryFile["models"] = [];
const freshOpenRouterCost: number[] = [];

for (const { e, usd: est } of estimates) {
  const info: BenchModelInfo = { key: e.key, id: e.id, label: e.label, kind: e.kind };
  const perCallEstimate = est / Math.max(1, runs * tickets.length + WARMUPS);
  const calls: BenchCall[] = [];
  console.log(`\n${e.label}`);
  try {
    // ---- Pilot: 5 tickets from run 1. They land in the cache, so the full run reuses them. --------
    const r1 = runner(deciderFor(e.key, allTickets, mock, 1), { cache, budget, mock });
    const pilot = await mapPool(tickets.slice(0, PILOT), concurrency, (t) =>
      r1.call(buildTriageRequest(t, questions), `bench:run1:${t.id}`, perCallEstimate),
    );
    for (const r of pilot) {
      for (const [qid, a] of Object.entries(r.answers)) {
        const sum = Object.values(a.probabilities).reduce((s, x) => s + x, 0);
        if (Math.abs(sum - 1) > 0.02)
          throw new Error(`Pilot: ${qid} probabilities sum to ${sum.toFixed(3)}, expected 1.`);
      }
      if (!(r.usage.costUsd >= 0)) throw new Error(`Pilot: cost is ${r.usage.costUsd}.`);
      if (!mock && r.usage.costUsd > perCallEstimate * 20 + 0.001)
        throw new Error(
          `Pilot: a call cost ${usd(r.usage.costUsd)}, far above the estimate ${usd(perCallEstimate)}. Stopping to be safe.`,
        );
    }
    console.log(`  pilot ok: ${pilot.length} calls parse, cost per call ${usd(pilot[0].usage.costUsd)}`);

    // ---- Warm-up: excluded from metrics. Skipped when the run is fully cached. -----------------
    const firstKey = (run: number, id: string) => `bench:run${run}:${id}`;
    const allCached =
      !mock &&
      tickets.every((t) =>
        cache.get(cache.key(e.id, firstKey(runs, t.id), buildTriageRequest(t, questions))),
      );
    let warmups = 0;
    if (!allCached && !mock) {
      for (const t of tickets.slice(0, WARMUPS)) {
        await r1.call(
          buildTriageRequest(t, questions),
          `bench:warmup:${Date.now()}:${t.id}`,
          perCallEstimate,
        );
        warmups++;
      }
    }

    // ---- Full runs --------------------------------------------------------------------------------
    for (let run = 1; run <= runs; run++) {
      const r = runner(deciderFor(e.key, allTickets, mock, run), { cache, budget, mock });
      let done = 0;
      const results = await mapPool(tickets, concurrency, async (t) => {
        try {
          const res = await r.call(buildTriageRequest(t, questions), firstKey(run, t.id), perCallEstimate);
          if (!res.cached && !mock && e.provider === "openrouter")
            freshOpenRouterCost.push(res.usage.costUsd);
          done++;
          if (process.stdout.isTTY && done % 12 === 0)
            process.stdout.write(`  run ${run}: ${done}/${tickets.length}\r`);
          return {
            run,
            ticketId: t.id,
            latencyMs: res.latencyMs,
            usage: res.usage,
            answers: res.answers,
            servedModel: res.servedModel,
            cached: res.cached,
          } satisfies BenchCall;
        } catch (err) {
          if (err instanceof BudgetExceeded) throw err;
          return {
            run,
            ticketId: t.id,
            latencyMs: 0,
            usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
            answers: {},
            error: (err as Error).message,
          } satisfies BenchCall;
        }
      });
      calls.push(...results);
      const errs = results.filter((x) => x.error).length;
      console.log(
        `  run ${run}: ${results.length - errs}/${results.length} ok${errs ? `, ${errs} errors (first: ${results.find((x) => x.error)?.error})` : ""}`,
      );
    }

    const metrics = summarizeBench(calls, tickets);
    const file: BenchFile = {
      schema: 1,
      kind: "bench",
      model: info,
      provenance: provenance({ runs, questionSet: questions.version, dataset, mock }),
      warmupCalls: warmups,
      calls,
      metrics,
    };
    const name = `bench-${e.key}.json`;
    writeJson(resolve(dir, name), file);
    summaries.push({ model: info, file: name, metrics });
    console.log(
      `  team accuracy ${pct(metrics.accuracy.team.mean)} (${pct(metrics.accuracy.team.min)} to ${pct(metrics.accuracy.team.max)})  ECE ${metrics.ece.toFixed(3)}  p50 ${metrics.latency.p50.toFixed(0)} ms  p95 ${metrics.latency.p95.toFixed(0)} ms  ${usd(metrics.cost.per1000Usd)} per 1,000`,
    );
  } catch (err) {
    console.error(`  ${(err as Error).message}`);
    process.exitCode = 1;
    if (err instanceof BudgetExceeded) break;
  }
}

// ---- Summary (merged with models already benched today) -------------------------------------------
const summaryPath = resolve(dir, "summary.json");
const previous: SummaryFile | undefined = existsSync(summaryPath)
  ? JSON.parse(readFileSync(summaryPath, "utf8"))
  : undefined;
const merged = [
  ...(previous?.models ?? []).filter((m) => !summaries.some((s) => s.model.key === m.model.key)),
  ...summaries,
];
const summary: SummaryFile = {
  schema: 1,
  kind: "summary",
  provenance: provenance({ runs, questionSet: questions.version, dataset, mock }),
  models: merged,
};
writeJson(summaryPath, summary);

// ---- VERIFY.md ------------------------------------------------------------------------------------
const usageAfter = mock ? undefined : await openRouterUsage();
const failures: string[] = [];
const checks: string[] = [];
for (const s of summaries) {
  const f = JSON.parse(readFileSync(resolve(dir, s.file), "utf8")) as BenchFile;
  const expected = runs * tickets.length;
  const answered = f.calls.filter(
    (c) => !c.error && Object.keys(questions.triage).every((q) => c.answers[q]),
  );
  (answered.length === expected ? checks : failures).push(
    `${s.model.label}: ${answered.length} of ${expected} calls have an answer for every question.`,
  );
  const badSums = f.calls.flatMap((c) =>
    Object.entries(c.answers).filter(
      ([, a]) => Math.abs(Object.values(a.probabilities).reduce((x, y) => x + y, 0) - 1) > 0.02,
    ),
  );
  (badSums.length ? failures : checks).push(
    `${s.model.label}: ${badSums.length} answers whose probabilities do not sum to about 1.`,
  );
  const negative = f.calls.filter((c) => !(c.usage.costUsd >= 0));
  (negative.length ? failures : checks).push(
    `${s.model.label}: ${negative.length} calls with a negative or missing cost.`,
  );
  const sum = f.calls.reduce((x, c) => x + c.usage.costUsd, 0);
  (Math.abs(sum - f.metrics.cost.totalUsd) < 1e-9 ? checks : failures).push(
    `${s.model.label}: per-call costs add up to the reported total (${usd(sum)}).`,
  );
  (f.provenance.mock === mock ? checks : failures).push(
    `${s.model.label}: mock flag is ${f.provenance.mock}.`,
  );
}
if (mock) failures.push("This run used Mock mode. None of these numbers may be published.");
if (usageBefore !== undefined && usageAfter !== undefined) {
  const delta = usageAfter - usageBefore;
  const ours = freshOpenRouterCost.reduce((a, b) => a + b, 0);
  const ok = Math.abs(delta - ours) <= Math.max(0.0005, ours * 0.1);
  (ok ? checks : failures).push(
    `OpenRouter account usage moved by ${usd(delta)}; summed usage.cost of new calls is ${usd(ours)}.${ok ? "" : " The account total can lag by a few minutes; rerun the check later before publishing."}`,
  );
} else if (!mock) {
  checks.push("OpenRouter account usage could not be read, so the account cross-check was skipped.");
}
if (dataset.labelStatus.includes("not")) {
  failures.push(`Dataset ${dataset.labelStatus}. Any page that shows accuracy must say so.`);
}
const verify = [
  `# Verification for ${dir.split(/[\\/]/).slice(-1)[0]}`,
  "",
  failures.length ? "## Failed or needs attention" : "## All checks passed",
  ...failures.map((x) => `- ${x}`),
  "",
  "## Passed",
  ...checks.map((x) => `- ${x}`),
  "",
  `Generated ${new Date().toISOString()} by npm run bench. Spent on new calls in this process: ${usd(budget.spent)}.`,
  "",
].join("\n");
writeFileSync(resolve(dir, "VERIFY.md"), verify);
console.log(
  `\nWrote ${dir}. ${failures.length ? `${failures.length} items need attention, see VERIFY.md.` : "All checks passed."}`,
);
