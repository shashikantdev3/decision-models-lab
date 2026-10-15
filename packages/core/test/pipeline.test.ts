import { describe, expect, it } from "vitest";
import {
  MockDecider,
  MockWriter,
  createMockOracle,
  defaultPolicy,
  rerouteQueue,
  runTriage,
  summarizeBench,
  buildTriageRequest,
} from "../src/index.ts";
import { questions, tickets } from "./helpers.ts";

const oracle = createMockOracle(tickets);
const decider = new MockDecider({ modelId: "typesafe/jev-1.14", oracle });
const writer = new MockWriter({ modelId: "claude-sonnet-5-5" });

describe("mock models", () => {
  it("are deterministic for the same run and differ across runs", async () => {
    const req = buildTriageRequest(tickets[0], questions);
    const a = await decider.decide(req);
    const b = await decider.decide(req);
    const c = await new MockDecider({ modelId: "typesafe/jev-1.14", oracle, run: 2 }).decide(req);
    expect(a.answers).toEqual(b.answers);
    expect(a.answers).not.toEqual(c.answers);
    expect(a.mock).toBe(true);
  });

  it("return distributions that sum to 1", async () => {
    for (const t of tickets.slice(0, 10)) {
      const r = await decider.decide(buildTriageRequest(t, questions));
      for (const ans of Object.values(r.answers)) {
        expect(Object.values(ans.probabilities).reduce((s, p) => s + p, 0)).toBeCloseTo(1, 6);
      }
    }
  });
});

describe("triage pipeline (mock)", () => {
  it("routes every ticket, and drafts and verifies every escalated one", async () => {
    const records = await runTriage({ tickets, decider, writer, questions, policy: defaultPolicy });
    expect(records).toHaveLength(tickets.length);
    const escalated = records.filter((r) => r.route.action === "escalate");
    expect(escalated.length).toBeGreaterThan(0);
    expect(escalated.length).toBeLessThan(tickets.length);
    for (const r of escalated) {
      expect(r.draft).toBeDefined();
      expect(r.verification?.outcome).toBeDefined();
      expect(r.final).toEqual(r.draft!.labels);
    }
    for (const r of records.filter((x) => x.route.action === "auto")) expect(r.draft).toBeUndefined();
  });

  it("rerouting with a higher threshold never auto-routes more tickets", async () => {
    const records = await runTriage({
      tickets,
      decider,
      writer,
      questions,
      policy: defaultPolicy,
      draftAll: true,
    });
    const byId = new Map(tickets.map((t) => [t.id, t]));
    let prev = Infinity;
    for (const t of [0.5, 0.6, 0.7, 0.8, 0.9, 0.99]) {
      const { stats } = rerouteQueue(records, byId, { ...defaultPolicy, teamConfidenceThreshold: t });
      expect(stats.auto).toBeLessThanOrEqual(prev);
      prev = stats.auto;
    }
  });
});

describe("summarizeBench", () => {
  it("produces every metric in the measurement protocol", async () => {
    const calls = [];
    for (const run of [1, 2, 3]) {
      const d = new MockDecider({ modelId: "microsoft/microsoft-decision-1-20261009", oracle, run });
      for (const t of tickets) {
        const r = await d.decide(buildTriageRequest(t, questions));
        calls.push({ run, ticketId: t.id, latencyMs: r.latencyMs, usage: r.usage, answers: r.answers });
      }
    }
    const m = summarizeBench(calls, tickets);
    expect(m.calls).toBe(144);
    expect(m.accuracy.team.mean).toBeGreaterThan(0.5);
    expect(m.accuracy.team.min).toBeLessThanOrEqual(m.accuracy.team.max);
    expect(m.reliability).toHaveLength(10);
    expect(m.coverage[0].threshold).toBe(0.5);
    expect(m.coverage.at(-1)!.threshold).toBe(0.99);
    expect(m.latency.p95).toBeGreaterThanOrEqual(m.latency.p50);
    expect(m.cost.per1000Usd).toBeGreaterThan(0);
    expect(m.ece).toBeGreaterThanOrEqual(0);
  });
});
