/** Pure metric functions. No I/O. Inputs are plain arrays so they work in Node and the browser. */

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

export function accuracy<T>(pred: T[], truth: T[]): number {
  if (pred.length !== truth.length) throw new Error("accuracy: arrays differ in length");
  if (!pred.length) return NaN;
  let ok = 0;
  for (let i = 0; i < pred.length; i++) if (pred[i] === truth[i]) ok++;
  return ok / pred.length;
}

/** Macro-averaged F1 over `labels`. Labels with no true and no predicted cases are skipped. */
export function macroF1(pred: string[], truth: string[], labels: readonly string[]): number {
  const f1s: number[] = [];
  for (const l of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let i = 0; i < pred.length; i++) {
      if (pred[i] === l && truth[i] === l) tp++;
      else if (pred[i] === l) fp++;
      else if (truth[i] === l) fn++;
    }
    if (tp + fp + fn === 0) continue;
    const p = tp + fp ? tp / (tp + fp) : 0;
    const r = tp + fn ? tp / (tp + fn) : 0;
    f1s.push(p + r ? (2 * p * r) / (p + r) : 0);
  }
  return mean(f1s);
}

export function meanAbsoluteError(pred: number[], truth: number[]): number {
  return mean(pred.map((p, i) => Math.abs(p - truth[i])));
}

/** Nearest-rank percentile, p in [0, 100]. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * s.length);
  return s[Math.min(s.length - 1, Math.max(0, rank - 1))];
}

export function costPer(totalCostUsd: number, calls: number, per = 1000): number {
  return calls ? (totalCostUsd / calls) * per : NaN;
}

export function minMax(xs: number[]): { mean: number; min: number; max: number } {
  return { mean: mean(xs), min: Math.min(...xs), max: Math.max(...xs) };
}
