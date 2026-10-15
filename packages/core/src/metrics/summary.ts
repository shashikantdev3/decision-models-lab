import type { Answer, Difficulty, Ticket, Usage } from "../types.ts";
import { TEAMS, URGENCY } from "../questions.ts";
import { accuracy, costPer, macroF1, meanAbsoluteError, minMax, percentile, mean } from "./basic.ts";
import {
  brierBinary,
  brierMulticlass,
  coverageCurve,
  expectedCalibrationError,
  reliabilityBins,
  type CoveragePoint,
  type ReliabilityBin,
} from "./calibration.ts";

export interface Provenance {
  date: string;
  createdAt: string;
  gitCommit: string;
  region: string;
  questionSet: string;
  dataset: { version: string; sha256: string; count: number; labelStatus: string };
  runs: number;
  /** True only for files produced by Mock mode. Such files are never written to results/. */
  mock: boolean;
}

export interface BenchCall {
  run: number;
  ticketId: string;
  latencyMs: number;
  usage: Usage;
  answers: Record<string, Answer>;
  servedModel?: string;
  /** True if the response came from .cache/ instead of a new call. Latency is then the original measurement. */
  cached?: boolean;
  error?: string;
}

export interface BenchModelInfo {
  key: string;
  id: string;
  label: string;
  kind: "decision" | "llm-as-decider";
}

export interface Spread {
  mean: number;
  min: number;
  max: number;
}

export interface BenchMetrics {
  calls: number;
  errors: number;
  accuracy: Record<"team" | "urgency" | "customer_blocked" | "contains_personal_data", Spread>;
  teamMacroF1: Spread;
  urgencyMAE: Spread;
  brier: { noul: number; team: number };
  ece: number;
  reliability: ReliabilityBin[];
  latency: { p50: number; p95: number; mean: number };
  cost: { totalUsd: number; perCallUsd: number; per100Usd: number; per1000Usd: number };
  tokens: { inputMean: number; outputMean: number };
  coverage: CoveragePoint[];
  teamAccuracyByDifficulty: Partial<Record<Difficulty, number>>;
}

export interface BenchFile {
  schema: 1;
  kind: "bench";
  model: BenchModelInfo;
  provenance: Provenance;
  warmupCalls: number;
  calls: BenchCall[];
  metrics: BenchMetrics;
}

const QUESTIONS = ["team", "urgency", "customer_blocked", "contains_personal_data"] as const;

function truthTop(t: Ticket, q: (typeof QUESTIONS)[number]): string {
  const v = t.labels[q];
  return typeof v === "boolean" ? String(v) : v;
}

export function summarizeBench(calls: BenchCall[], tickets: Ticket[]): BenchMetrics {
  const byId = new Map(tickets.map((t) => [t.id, t]));
  const ok = calls.filter((c) => !c.error && byId.has(c.ticketId));
  const runs = [...new Set(ok.map((c) => c.run))].sort();

  const perRun = runs.map((run) => {
    const rc = ok.filter((c) => c.run === run);
    const acc = Object.fromEntries(
      QUESTIONS.map((q) => [
        q,
        accuracy(
          rc.map((c) => c.answers[q]?.top),
          rc.map((c) => truthTop(byId.get(c.ticketId)!, q)),
        ),
      ]),
    ) as Record<(typeof QUESTIONS)[number], number>;
    const f1 = macroF1(
      rc.map((c) => c.answers.team?.top),
      rc.map((c) => byId.get(c.ticketId)!.labels.team),
      TEAMS,
    );
    const mae = meanAbsoluteError(
      rc.map((c) => Number(c.answers.urgency?.value ?? 0)),
      rc.map((c) => URGENCY.indexOf(byId.get(c.ticketId)!.labels.urgency)),
    );
    return { acc, f1, mae };
  });

  // Calibration pools every top answer: its confidence against whether it was right.
  const conf: number[] = [];
  const correct: boolean[] = [];
  const noulP: number[] = [];
  const noulY: boolean[] = [];
  const teamDists: Record<string, number>[] = [];
  const teamTruth: string[] = [];
  for (const c of ok) {
    const t = byId.get(c.ticketId)!;
    for (const q of QUESTIONS) {
      const a = c.answers[q];
      if (!a) continue;
      conf.push(a.probabilities[a.top] ?? a.confidence ?? 0);
      correct.push(a.top === truthTop(t, q));
      if (a.type === "noul") {
        noulP.push(Number(a.value));
        noulY.push(truthTop(t, q) === "true");
      }
    }
    if (c.answers.team) {
      teamDists.push(c.answers.team.probabilities);
      teamTruth.push(t.labels.team);
    }
  }

  // Cached calls keep the latency measured when they were first made, so every call counts.
  const lat = ok.map((c) => c.latencyMs);
  const totalUsd = ok.reduce((s, c) => s + c.usage.costUsd, 0);

  const teamItems = ok
    .filter((c) => c.answers.team)
    .map((c) => ({
      confidence: c.answers.team.confidence ?? c.answers.team.probabilities[c.answers.team.top],
      correct: c.answers.team.top === byId.get(c.ticketId)!.labels.team,
    }));

  const byDiff: Partial<Record<Difficulty, number>> = {};
  for (const d of ["clear", "ambiguous", "adversarial"] as Difficulty[]) {
    const dc = ok.filter((c) => byId.get(c.ticketId)!.difficulty === d);
    if (dc.length)
      byDiff[d] = accuracy(
        dc.map((c) => c.answers.team?.top),
        dc.map((c) => byId.get(c.ticketId)!.labels.team),
      );
  }

  return {
    calls: calls.length,
    errors: calls.length - ok.length,
    accuracy: Object.fromEntries(
      QUESTIONS.map((q) => [q, minMax(perRun.map((r) => r.acc[q]))]),
    ) as BenchMetrics["accuracy"],
    teamMacroF1: minMax(perRun.map((r) => r.f1)),
    urgencyMAE: minMax(perRun.map((r) => r.mae)),
    brier: { noul: brierBinary(noulP, noulY), team: brierMulticlass(teamDists, teamTruth) },
    ece: expectedCalibrationError(conf, correct, 10),
    reliability: reliabilityBins(conf, correct, 10),
    latency: { p50: percentile(lat, 50), p95: percentile(lat, 95), mean: mean(lat) },
    cost: {
      totalUsd,
      perCallUsd: ok.length ? totalUsd / ok.length : NaN,
      per100Usd: costPer(totalUsd, ok.length, 100),
      per1000Usd: costPer(totalUsd, ok.length, 1000),
    },
    tokens: {
      inputMean: mean(ok.map((c) => c.usage.inputTokens)),
      outputMean: mean(ok.map((c) => c.usage.outputTokens)),
    },
    coverage: coverageCurve(teamItems),
    teamAccuracyByDifficulty: byDiff,
  };
}

export interface SummaryFile {
  schema: 1;
  kind: "summary";
  provenance: Provenance;
  models: { model: BenchModelInfo; file: string; metrics: BenchMetrics }[];
}

export interface WordingItem {
  ticketId: string;
  questionId: string;
  /** Index 0 is the original wording. */
  tops: string[];
  dists: Record<string, number>[];
}

export interface WordingFile {
  schema: 1;
  kind: "wording";
  model: BenchModelInfo;
  provenance: Provenance;
  items: WordingItem[];
  metrics: {
    flipRate: number;
    meanProbabilityShift: number;
    byQuestion: Record<string, { flipRate: number; meanProbabilityShift: number }>;
  };
}

export interface TriageFile {
  schema: 1;
  kind: "triage";
  provenance: Provenance;
  decider: { key: string; id: string; label: string };
  writer: { key: string; id: string; label: string };
  policy: import("../types.ts").EscalationPolicy;
  draftAll: boolean;
  records: import("../types.ts").TriageRecord[];
}
