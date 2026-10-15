import type {
  DecisionResult,
  EscalationPolicy,
  RouteDecision,
  VerifyOutcome,
  VerifyPolicy,
} from "../types.ts";
import { TONES } from "../questions.ts";
import policyJson from "../../../../config/policy.json";

export const defaultPolicy: EscalationPolicy = {
  teamConfidenceThreshold: policyJson.teamConfidenceThreshold,
  criticalProbabilityThreshold: policyJson.criticalProbabilityThreshold,
  personalDataUncertainBand: policyJson.personalDataUncertainBand as [number, number],
  verify: policyJson.verify,
};

const pct = (n: number) => n.toFixed(2);

/**
 * Pure routing rule. Reads the decision model's probabilities and says whether a ticket can be routed
 * automatically or must go to Claude. No I/O.
 */
export function route(result: Pick<DecisionResult, "answers">, policy: EscalationPolicy): RouteDecision {
  const reasons: string[] = [];
  const team = result.answers.team;
  if (!team) {
    reasons.push("No team answer");
  } else {
    const conf = team.confidence ?? Math.max(...Object.values(team.probabilities));
    if (conf < policy.teamConfidenceThreshold) {
      reasons.push(`Team confidence ${pct(conf)} is below ${pct(policy.teamConfidenceThreshold)}`);
    }
  }
  const pCritical = result.answers.urgency?.probabilities.Critical;
  if (pCritical !== undefined && pCritical > policy.criticalProbabilityThreshold) {
    reasons.push(`P(Critical) ${pct(pCritical)} is above ${pct(policy.criticalProbabilityThreshold)}`);
  }
  const pd = result.answers.contains_personal_data;
  if (pd) {
    const p = Number(pd.value);
    const [lo, hi] = policy.personalDataUncertainBand;
    if (p >= lo && p <= hi)
      reasons.push(`Personal data unclear (P = ${pct(p)}, between ${pct(lo)} and ${pct(hi)})`);
  }
  return { action: reasons.length ? "escalate" : "auto", reasons };
}

/** Pure check of a verification result against the verify policy. */
export function checkDraft(verification: Pick<DecisionResult, "answers">, v: VerifyPolicy): VerifyOutcome {
  const a = verification.answers;
  const failures: string[] = [];
  const p = (id: string) => (a[id] ? Number(a[id].value) : undefined);
  const answers = p("reply_answers_the_question");
  if (answers !== undefined && answers < v.answersQuestionMin)
    failures.push(`May not answer the question (P = ${pct(answers)})`);
  const leaks = p("reply_leaks_personal_data");
  if (leaks !== undefined && leaks > v.leaksPersonalDataMax)
    failures.push(`May leak personal data (P = ${pct(leaks)})`);
  const promise = p("reply_promises_something_unapproved");
  if (promise !== undefined && promise > v.unapprovedPromiseMax)
    failures.push(`May promise something unapproved (P = ${pct(promise)})`);
  const tone = a.reply_tone;
  if (tone) {
    const min = (TONES as readonly string[]).indexOf(v.minTone);
    if (Number(tone.value) < min - 0.5) failures.push(`Tone reads as ${tone.top}`);
  }
  return { passed: failures.length === 0, failures };
}
