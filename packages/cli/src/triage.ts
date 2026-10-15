/**
 * The full loop on the dataset: decide, route, reason, verify, record.
 *   npm run triage -- --decider decision-1 --writer claude-sonnet --threshold 0.8
 *   npm run triage -- --mock
 * Options: --limit N  --draft-all  --concurrency 4  --max-usd 2  --yes  --critical 0.35  --pd-band 0.2,0.8
 */
import { resolve } from "node:path";
import {
  buildDecider,
  buildWriter,
  costFromTokens,
  defaultPolicy,
  estimateTokens,
  buildTriageRequest,
  findDecider,
  findWriter,
  rerouteQueue,
  runTriage,
  type EscalationPolicy,
  type TriageFile,
} from "../../core/src/index.ts";
import {
  arg,
  flag,
  confirm,
  keys,
  loadDataset,
  loadQuestions,
  provenance,
  outDir,
  writeJson,
  usd,
  pct,
  mockBanner,
} from "./shared.ts";

const mock = flag("mock");
const d = findDecider(arg("decider", "decision-1")!);
const w = findWriter(arg("writer", "claude-sonnet")!);
const limit = Number(arg("limit", "0"));
const band = arg("pd-band");
const policy: EscalationPolicy = {
  ...defaultPolicy,
  teamConfidenceThreshold: Number(arg("threshold", String(defaultPolicy.teamConfidenceThreshold))),
  criticalProbabilityThreshold: Number(arg("critical", String(defaultPolicy.criticalProbabilityThreshold))),
  personalDataUncertainBand: band
    ? (band.split(",").map(Number) as [number, number])
    : defaultPolicy.personalDataUncertainBand,
};
const { tickets: all, info: dataset } = loadDataset();
const tickets = limit ? all.slice(0, limit) : all;
const questions = loadQuestions();
const draftAll = flag("draft-all");
if (mock) mockBanner();

const avg =
  tickets.reduce((s, t) => s + estimateTokens(buildTriageRequest(t, questions)), 0) / tickets.length;
const share = draftAll ? 1 : 0.45;
const estimate =
  costFromTokens(d.id, tickets.length * avg, 0) +
  tickets.length * share * (costFromTokens(w.id, 900, 350) + costFromTokens(d.id, avg + 200, 0));
console.log(
  `Triage: ${tickets.length} tickets, decider ${d.label}, writer ${w.label}, threshold ${policy.teamConfidenceThreshold}`,
);
console.log(`Estimated cost ${usd(estimate)} (assumes ${Math.round(share * 100)}% of tickets reach Claude).`);
if (!mock) {
  const max = Number(arg("max-usd", "2"));
  if (estimate > max) {
    console.error(`Estimate is above --max-usd ${max}. Stopping.`);
    process.exit(1);
  }
  if (tickets.length > 10 && !flag("yes") && !(await confirm("Go ahead?"))) {
    console.log("Stopped. Nothing was spent.");
    process.exit(0);
  }
}

const build = { keys: keys(), mock: mock ? { tickets: all } : undefined };
const records = await runTriage({
  tickets,
  decider: buildDecider(d.key, build),
  writer: buildWriter(w.key, build),
  questions,
  policy,
  draftAll,
  concurrency: Number(arg("concurrency", "4")),
  onRecord: (r) => {
    const flagText = r.verification && !r.verification.outcome.passed ? "  draft flagged for a human" : "";
    console.log(
      `  ${r.ticketId}  ${r.route.action.padEnd(8)}  ${r.final.team.padEnd(8)} ${r.final.urgency.padEnd(8)}${flagText}`,
    );
  },
});

const byId = new Map(all.map((t) => [t.id, t]));
const { stats } = rerouteQueue(records, byId, policy);
console.log(
  `\nAuto-routed ${stats.auto}/${stats.total} (${pct(stats.autoShare)}), accuracy on those ${pct(stats.autoTeamAccuracy)}. ` +
    `Escalated ${stats.escalated}. Final team accuracy ${pct(stats.finalTeamAccuracy)}. Drafts flagged ${stats.draftsFailed}. ` +
    `Cost ${usd(stats.costUsd)}. Sum of call times ${(stats.timeMs / 1000).toFixed(1)} s.`,
);
if (dataset.labelStatus.includes("not")) console.log(`Note: ${dataset.labelStatus}.`);

const file: TriageFile = {
  schema: 1,
  kind: "triage",
  provenance: provenance({ runs: 1, questionSet: questions.version, dataset, mock }),
  decider: { key: d.key, id: d.id, label: d.label },
  writer: { key: w.key, id: w.id, label: w.label },
  policy,
  draftAll,
  records,
};
const out = resolve(outDir(mock), `triage-${d.key}-${w.key}.json`);
writeJson(out, file);
console.log(`Wrote ${out}`);
