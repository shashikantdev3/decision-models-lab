/**
 * Mock mode for the site: runs the offline stand-in models in the browser so every page works
 * before any recorded run exists. Every number here is made up and is always shown with a Mock badge.
 */
import {
  MockDecider,
  MockWriter,
  buildTriageRequest,
  createMockOracle,
  defaultPolicy,
  findDecider,
  findWriter,
  flipRate,
  meanProbabilityShift,
  runTriage,
  summarizeBench,
  ticketContext,
  type BenchCall,
  type BenchFile,
  type Provenance,
  type TriageFile,
  type WordingFile,
  type WordingItem,
  type DecisionRequest,
  type Question,
} from "@decision-models-lab/core";
import { questions, rewordings, tickets, type ResultSet } from "./data.ts";

const oracle = createMockOracle(tickets);
const today = new Date().toISOString().slice(0, 10);

function prov(runs: number): Provenance {
  return {
    date: today,
    createdAt: new Date().toISOString(),
    gitCommit: "mock",
    region: "your browser (mock)",
    questionSet: questions.version,
    dataset: { version: "v1", sha256: "mock", count: tickets.length, labelStatus: "mock" },
    runs,
    mock: true,
  };
}

async function bench(key: string): Promise<BenchFile> {
  const e = findDecider(key);
  const calls: BenchCall[] = [];
  for (const run of [1, 2, 3]) {
    const d = new MockDecider({ modelId: e.id, oracle, run, kind: e.kind });
    for (const t of tickets) {
      const r = await d.decide(buildTriageRequest(t, questions));
      calls.push({
        run,
        ticketId: t.id,
        latencyMs: r.latencyMs,
        usage: r.usage,
        answers: r.answers,
        servedModel: r.servedModel,
      });
    }
  }
  return {
    schema: 1,
    kind: "bench",
    model: { key: e.key, id: e.id, label: e.label, kind: e.kind },
    provenance: prov(3),
    warmupCalls: 0,
    calls,
    metrics: summarizeBench(calls, tickets),
  };
}

async function triage(deciderKey: string, writerKey: string): Promise<TriageFile> {
  const d = findDecider(deciderKey);
  const w = findWriter(writerKey);
  const records = await runTriage({
    tickets,
    decider: new MockDecider({ modelId: d.id, oracle, kind: d.kind, label: d.label }),
    writer: new MockWriter({ modelId: w.id, label: w.label }),
    questions,
    policy: defaultPolicy,
    draftAll: true,
  });
  return {
    schema: 1,
    kind: "triage",
    provenance: prov(1),
    decider: { key: d.key, id: d.id, label: d.label },
    writer: { key: w.key, id: w.id, label: w.label },
    policy: defaultPolicy,
    draftAll: true,
    records,
  };
}

async function wording(key: string): Promise<WordingFile> {
  const e = findDecider(key);
  const d = new MockDecider({ modelId: e.id, oracle, kind: e.kind });
  const variants: Record<string, Question>[] = [0, 1, 2, 3].map((v) =>
    Object.fromEntries(
      Object.entries(questions.triage).map(([id, q]) => [
        id,
        v === 0 ? q : { ...q, ...rewordings.rewordings[id][v - 1] },
      ]),
    ),
  );
  const items: WordingItem[] = [];
  for (const t of tickets) {
    const res = [];
    for (const qs of variants)
      res.push(await d.decide({ context: ticketContext(t), questions: qs } as DecisionRequest));
    for (const qid of Object.keys(questions.triage)) {
      items.push({
        ticketId: t.id,
        questionId: qid,
        tops: res.map((r) => r.answers[qid].top),
        dists: res.map((r) => r.answers[qid].probabilities),
      });
    }
  }
  const byQuestion = Object.fromEntries(
    Object.keys(questions.triage).map((qid) => {
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
  return {
    schema: 1,
    kind: "wording",
    model: { key: e.key, id: e.id, label: e.label, kind: e.kind },
    provenance: prov(1),
    items,
    metrics: {
      flipRate: flipRate(items.map((i) => i.tops)),
      meanProbabilityShift: meanProbabilityShift(items.map((i) => i.dists)),
      byQuestion,
    },
  };
}

let cached: Promise<ResultSet> | undefined;

export function mockResultSet(): Promise<ResultSet> {
  cached ??= (async () => {
    const benches = await Promise.all(["jev", "decision-1", "claude-haiku"].map(bench));
    return {
      date: today,
      mock: true,
      summary: {
        schema: 1,
        kind: "summary",
        provenance: prov(3),
        models: benches.map((b) => ({
          model: b.model,
          file: `bench-${b.model.key}.json`,
          metrics: b.metrics,
        })),
      },
      bench: benches,
      triage: await Promise.all([triage("jev", "claude-sonnet"), triage("decision-1", "claude-sonnet")]),
      wording: await Promise.all([wording("jev"), wording("decision-1")]),
    };
  })();
  return cached;
}
