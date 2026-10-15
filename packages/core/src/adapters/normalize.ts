import type { Answer, Question } from "../types.ts";
import { optionsOf } from "../questions.ts";

function argmax(probs: Record<string, number>): string {
  let best = "";
  let bestP = -1;
  for (const [k, p] of Object.entries(probs)) {
    if (p > bestP) {
      best = k;
      bestP = p;
    }
  }
  return best;
}

export function renormalize(probs: Record<string, number>): Record<string, number> {
  const clean: Record<string, number> = {};
  let sum = 0;
  for (const [k, v] of Object.entries(probs)) {
    const n = Number.isFinite(v) && v > 0 ? v : 0;
    clean[k] = n;
    sum += n;
  }
  if (sum <= 0) {
    const keys = Object.keys(clean);
    for (const k of keys) clean[k] = 1 / keys.length;
    return clean;
  }
  for (const k of Object.keys(clean)) clean[k] = clean[k] / sum;
  return clean;
}

export function noulAnswer(pYes: number, confidence?: number): Answer {
  const p = Math.min(1, Math.max(0, pYes));
  return {
    type: "noul",
    value: p,
    probabilities: { true: p, false: 1 - p },
    confidence: confidence ?? Math.max(p, 1 - p),
    top: p >= 0.5 ? "true" : "false",
  };
}

export function choiceAnswer(
  probabilities: Record<string, number>,
  choice?: string,
  confidence?: number,
): Answer {
  const probs = renormalize(probabilities);
  const top = choice && choice in probs ? choice : argmax(probs);
  return { type: "choice", value: top, probabilities: probs, confidence: confidence ?? probs[top], top };
}

/** Score answer keyed by level label. `position` is 0-based; computed from the distribution when missing. */
export function scoreAnswer(
  levels: string[],
  byLabel: Record<string, number>,
  position?: number,
  confidence?: number,
): Answer {
  const probs = renormalize(Object.fromEntries(levels.map((l) => [l, byLabel[l] ?? 0])));
  const pos = position ?? levels.reduce((s, l, i) => s + i * probs[l], 0);
  const top = argmax(probs);
  return { type: "score", value: pos, probabilities: probs, confidence: confidence ?? probs[top], top };
}

/**
 * Converts one raw Decisions API answer into our Answer shape.
 * Documented shape (OpenRouter API reference, checked 2026-10-15):
 *   noul:   { type: "noul", noul: number }
 *   choice: { type: "choice", choice: string, confidence?: number, probabilities?: { [option]: number } }
 *   score:  { type: "score", score: number, confidence?: number, probabilities?: { "0": p, ... }, legend?: { "0": text } }
 * Score probabilities are keyed by 0-based index strings; we re-key them by the level labels from the question.
 */
export function normalizeProviderAnswer(raw: unknown, q: Question): Answer {
  const r = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" ? Number(v) : undefined);
  if (q.type === "noul") {
    const p = num(r.noul ?? r.probability ?? r.value);
    if (p === undefined || Number.isNaN(p)) throw new Error("noul answer has no probability");
    return noulAnswer(p, num(r.confidence));
  }
  if (q.type === "choice") {
    const probs = (r.probabilities as Record<string, number>) ?? {};
    const choice = typeof r.choice === "string" ? r.choice : undefined;
    const filled = Object.keys(probs).length ? probs : choice ? { [choice]: 1 } : {};
    for (const o of optionsOf(q)) if (!(o in filled)) filled[o] = 0;
    return choiceAnswer(filled, choice, num(r.confidence));
  }
  const levels = optionsOf(q);
  const rawProbs = (r.probabilities as Record<string, number>) ?? {};
  const byLabel: Record<string, number> = {};
  for (const [k, v] of Object.entries(rawProbs)) {
    const idx = Number(k);
    const label = Number.isInteger(idx) && levels[idx] !== undefined ? levels[idx] : k;
    byLabel[label] = Number(v);
  }
  return scoreAnswer(levels, byLabel, num(r.score), num(r.confidence));
}
