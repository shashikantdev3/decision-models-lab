import { describe, expect, it } from "vitest";
import {
  checkDraft,
  choiceAnswer,
  defaultPolicy,
  noulAnswer,
  route,
  scoreAnswer,
  URGENCY,
  TONES,
} from "../src/index.ts";

const answers = (teamConf: number, pCritical: number, pPersonal: number) => ({
  team: choiceAnswer({ payments: teamConf, auth: 1 - teamConf }),
  urgency: scoreAnswer([...URGENCY], { Low: 0.1, Normal: 0.2, High: 0.7 - pCritical, Critical: pCritical }),
  customer_blocked: noulAnswer(0.9),
  contains_personal_data: noulAnswer(pPersonal),
});

describe("route", () => {
  const policy = {
    ...defaultPolicy,
    teamConfidenceThreshold: 0.8,
    criticalProbabilityThreshold: 0.35,
    personalDataUncertainBand: [0.2, 0.8] as [number, number],
  };

  it("auto-routes a confident, non-critical ticket with clear personal data", () => {
    expect(route({ answers: answers(0.95, 0.05, 0.02) }, policy)).toEqual({ action: "auto", reasons: [] });
  });

  it("escalates when team confidence is below the threshold", () => {
    const r = route({ answers: answers(0.7, 0.05, 0.02) }, policy);
    expect(r.action).toBe("escalate");
    expect(r.reasons[0]).toMatch(/Team confidence 0.70 is below 0.80/);
  });

  it("escalates likely critical tickets even when the team is clear", () => {
    const r = route({ answers: answers(0.99, 0.5, 0.02) }, policy);
    expect(r.action).toBe("escalate");
    expect(r.reasons.join()).toMatch(/P\(Critical\)/);
  });

  it("escalates when personal data is uncertain, but not when it is clearly present", () => {
    expect(route({ answers: answers(0.99, 0.05, 0.5) }, policy).action).toBe("escalate");
    expect(route({ answers: answers(0.99, 0.05, 0.95) }, policy).action).toBe("auto");
  });

  it("lists every reason that fired", () => {
    expect(route({ answers: answers(0.6, 0.6, 0.5) }, policy).reasons).toHaveLength(3);
  });

  it("treats the threshold as inclusive", () => {
    expect(route({ answers: answers(0.8, 0.05, 0.02) }, policy).action).toBe("auto");
  });
});

describe("checkDraft", () => {
  const v = defaultPolicy.verify;
  const tone = (label: string) => scoreAnswer([...TONES], { [label]: 1 });
  const verdict = (ans: number, leak: number, promise: number, t: string) => ({
    answers: {
      reply_answers_the_question: noulAnswer(ans),
      reply_leaks_personal_data: noulAnswer(leak),
      reply_promises_something_unapproved: noulAnswer(promise),
      reply_tone: tone(t),
    },
  });

  it("passes a good draft", () => {
    expect(checkDraft(verdict(0.9, 0.05, 0.05, "Professional"), v)).toEqual({ passed: true, failures: [] });
  });

  it("flags leaks, promises, non-answers and a flat tone", () => {
    const r = checkDraft(verdict(0.2, 0.8, 0.9, "Flat"), v);
    expect(r.passed).toBe(false);
    expect(r.failures).toHaveLength(4);
  });
});
