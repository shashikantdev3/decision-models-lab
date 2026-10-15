import { mean } from "./basic.ts";

/** Brier score for yes/no forecasts: mean of (p - outcome)^2. 0 is perfect, 0.25 is a constant 0.5. */
export function brierBinary(probYes: number[], outcomes: boolean[]): number {
  return mean(probYes.map((p, i) => (p - (outcomes[i] ? 1 : 0)) ** 2));
}

/** Multi-class Brier: mean over items of the sum over classes of (p_k - y_k)^2. Ranges 0 to 2. */
export function brierMulticlass(probs: Record<string, number>[], truth: string[]): number {
  return mean(
    probs.map((dist, i) => {
      let s = 0;
      const keys = new Set([...Object.keys(dist), truth[i]]);
      for (const k of keys) s += ((dist[k] ?? 0) - (k === truth[i] ? 1 : 0)) ** 2;
      return s;
    }),
  );
}

export interface ReliabilityBin {
  lo: number;
  hi: number;
  count: number;
  meanConfidence: number;
  accuracy: number;
}

/** Equal-width bins over [0, 1]. A confidence of exactly 1 goes in the last bin. */
export function reliabilityBins(confidence: number[], correct: boolean[], bins = 10): ReliabilityBin[] {
  const out: ReliabilityBin[] = Array.from({ length: bins }, (_, b) => ({
    lo: b / bins,
    hi: (b + 1) / bins,
    count: 0,
    meanConfidence: 0,
    accuracy: 0,
  }));
  confidence.forEach((c, i) => {
    const b = Math.min(bins - 1, Math.max(0, Math.floor(c * bins)));
    const bin = out[b];
    bin.count++;
    bin.meanConfidence += c;
    bin.accuracy += correct[i] ? 1 : 0;
  });
  for (const bin of out) {
    if (bin.count) {
      bin.meanConfidence /= bin.count;
      bin.accuracy /= bin.count;
    }
  }
  return out;
}

/** Expected calibration error: weighted mean gap between confidence and accuracy across bins. */
export function expectedCalibrationError(confidence: number[], correct: boolean[], bins = 10): number {
  const n = confidence.length;
  if (!n) return NaN;
  return reliabilityBins(confidence, correct, bins).reduce(
    (s, b) => s + (b.count / n) * Math.abs(b.accuracy - b.meanConfidence),
    0,
  );
}

export interface CoveragePoint {
  threshold: number;
  coverage: number;
  /** Accuracy on the items at or above the threshold. Undefined when none are. */
  accuracy?: number;
}

/** For each threshold, the share of items handled automatically and how accurate those are. */
export function coverageCurve(
  items: { confidence: number; correct: boolean }[],
  thresholds: number[] = Array.from({ length: 50 }, (_, i) => Math.round((0.5 + i * 0.01) * 100) / 100),
): CoveragePoint[] {
  return thresholds.map((t) => {
    const kept = items.filter((x) => x.confidence >= t);
    return {
      threshold: t,
      coverage: items.length ? kept.length / items.length : 0,
      accuracy: kept.length ? kept.filter((x) => x.correct).length / kept.length : undefined,
    };
  });
}

/**
 * Wording sensitivity. `tops[i]` holds the top answer for item i under each wording (original first).
 * Flip rate = share of (item, rewording) pairs where the top answer differs from the original.
 */
export function flipRate(tops: string[][]): number {
  let flips = 0;
  let pairs = 0;
  for (const row of tops) {
    for (let j = 1; j < row.length; j++) {
      pairs++;
      if (row[j] !== row[0]) flips++;
    }
  }
  return pairs ? flips / pairs : NaN;
}

/** Mean total-variation distance between the original distribution and each rewording's distribution. */
export function meanProbabilityShift(dists: Record<string, number>[][]): number {
  const shifts: number[] = [];
  for (const row of dists) {
    for (let j = 1; j < row.length; j++) {
      const keys = new Set([...Object.keys(row[0]), ...Object.keys(row[j])]);
      let tv = 0;
      for (const k of keys) tv += Math.abs((row[0][k] ?? 0) - (row[j][k] ?? 0));
      shifts.push(tv / 2);
    }
  }
  return mean(shifts);
}
