import { describe, expect, it } from "vitest";
import { normalizeProviderAnswer, renormalize } from "../src/index.ts";
import { fixture } from "./helpers.ts";

const f = fixture("documented-shape.triage.json");
const qs = f.request.questions;

describe("normalizeProviderAnswer", () => {
  it("reads a noul answer as P(yes)", () => {
    const a = normalizeProviderAnswer(f.response.answers.urgent, qs.urgent);
    expect(a.value).toBeCloseTo(0.97);
    expect(a.top).toBe("true");
    expect(a.probabilities.false).toBeCloseTo(0.03);
  });

  it("keeps the provider's choice and confidence", () => {
    const a = normalizeProviderAnswer(f.response.answers.team, qs.team);
    expect(a.top).toBe("payments");
    expect(a.confidence).toBe(0.91);
    expect(Object.values(a.probabilities).reduce((s, p) => s + p, 0)).toBeCloseTo(1);
  });

  it("re-keys score probabilities from index strings to level labels", () => {
    const a = normalizeProviderAnswer(f.response.answers.severity, qs.severity);
    expect(a.probabilities.Critical).toBeCloseTo(0.89);
    expect(a.top).toBe("Critical");
    expect(a.value).toBeCloseTo(2.87);
  });

  it("computes a score position when the provider leaves it out", () => {
    const a = normalizeProviderAnswer({ type: "score", probabilities: { "0": 0.5, "3": 0.5 } }, qs.severity);
    expect(a.value).toBeCloseTo(1.5);
  });

  it("fills missing choice options with zero", () => {
    const a = normalizeProviderAnswer({ type: "choice", choice: "auth" }, qs.team);
    expect(a.probabilities).toEqual({ auth: 1, payments: 0, infra: 0 });
  });

  it("throws on a noul answer with no number", () => {
    expect(() => normalizeProviderAnswer({ type: "noul" }, qs.urgent)).toThrow();
  });
});

describe("renormalize", () => {
  it("spreads evenly when everything is zero", () => {
    expect(renormalize({ a: 0, b: 0 })).toEqual({ a: 0.5, b: 0.5 });
  });
  it("drops negative and NaN values", () => {
    expect(renormalize({ a: 2, b: -1, c: NaN })).toEqual({ a: 1, b: 0, c: 0 });
  });
});
