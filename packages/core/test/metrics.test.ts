import { describe, expect, it } from "vitest";
import {
  accuracy,
  brierBinary,
  brierMulticlass,
  costPer,
  coverageCurve,
  expectedCalibrationError,
  flipRate,
  macroF1,
  meanAbsoluteError,
  meanProbabilityShift,
  percentile,
  reliabilityBins,
} from "../src/index.ts";

describe("basic metrics", () => {
  it("accuracy", () => expect(accuracy(["a", "b", "c", "a"], ["a", "b", "a", "a"])).toBe(0.75));

  it("macro F1 averages per-class F1", () => {
    // a: tp=2 fp=1 fn=0 -> p=2/3 r=1 f1=0.8 ; b: tp=1 fp=0 fn=1 -> p=1 r=0.5 f1=2/3
    expect(macroF1(["a", "a", "a", "b"], ["a", "a", "b", "b"], ["a", "b", "c"])).toBeCloseTo(
      (0.8 + 2 / 3) / 2,
    );
  });

  it("MAE", () => expect(meanAbsoluteError([0, 2, 3], [1, 2, 1])).toBe(1));

  it("nearest-rank percentile", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(95);
    expect(percentile([5], 95)).toBe(5);
  });

  it("cost per 1,000", () => expect(costPer(0.02, 200)).toBeCloseTo(0.1));
});

describe("calibration", () => {
  it("Brier for perfect and coin-flip forecasts", () => {
    expect(brierBinary([1, 0], [true, false])).toBe(0);
    expect(brierBinary([0.5, 0.5], [true, false])).toBe(0.25);
  });

  it("multi-class Brier", () => {
    expect(brierMulticlass([{ a: 1, b: 0 }], ["a"])).toBe(0);
    expect(brierMulticlass([{ a: 0, b: 1 }], ["a"])).toBe(2);
  });

  it("ECE is zero when confidence matches accuracy in each bin", () => {
    const conf = [0.75, 0.75, 0.75, 0.75];
    const correct = [true, true, true, false];
    expect(expectedCalibrationError(conf, correct)).toBeCloseTo(0);
  });

  it("ECE catches overconfidence", () => {
    expect(expectedCalibrationError([0.95, 0.95], [false, true])).toBeCloseTo(0.45);
  });

  it("puts confidence 1.0 in the last bin", () => {
    const bins = reliabilityBins([1], [true]);
    expect(bins[9].count).toBe(1);
  });

  it("coverage falls as the threshold rises", () => {
    const items = [0.55, 0.7, 0.9, 0.99].map((c, i) => ({ confidence: c, correct: i > 0 }));
    const curve = coverageCurve(items, [0.5, 0.8, 0.95]);
    expect(curve.map((p) => p.coverage)).toEqual([1, 0.5, 0.25]);
    expect(curve[0].accuracy).toBe(0.75);
    expect(curve[1].accuracy).toBe(1);
  });

  it("flip rate and probability shift", () => {
    expect(flipRate([["a", "a", "b", "a"]])).toBeCloseTo(1 / 3);
    expect(
      meanProbabilityShift([
        [
          { a: 1, b: 0 },
          { a: 0.5, b: 0.5 },
        ],
      ]),
    ).toBeCloseTo(0.5);
  });
});
