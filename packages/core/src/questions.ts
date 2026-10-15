import type { DecisionRequest, Draft, NoulCriteria, Question, QuestionSet, Ticket } from "./types.ts";

export const TEAMS = ["payments", "auth", "infra", "data", "account"] as const;
export const URGENCY = ["Low", "Normal", "High", "Critical"] as const;
export const TONES = ["Rude", "Flat", "Professional", "Warm"] as const;

/** The ticket as the model sees it. The ticket id is left out on purpose so it cannot leak a hint. */
export function ticketContext(ticket: Pick<Ticket, "channel" | "subject" | "body">): string[] {
  return [`Channel: ${ticket.channel}`, `Subject: ${ticket.subject}`, `Message:\n${ticket.body}`];
}

export function buildTriageRequest(ticket: Ticket, qs: QuestionSet): DecisionRequest {
  return { context: ticketContext(ticket), questions: qs.triage };
}

export function buildVerifyRequest(
  ticket: Ticket,
  draft: Pick<Draft, "reply">,
  qs: QuestionSet,
): DecisionRequest {
  return {
    context: [
      "A support agent drafted a reply to a customer ticket. Judge the draft reply, not the ticket.",
      "--- Customer ticket ---",
      ...ticketContext(ticket),
      "--- Draft reply ---",
      draft.reply,
    ],
    questions: qs.verify,
  };
}

/** Ordered answer labels for a question: option ids, score levels, or true/false. */
export function optionsOf(q: Question): string[] {
  if (q.type === "noul") return ["true", "false"];
  if (q.type === "score") return (q.criteria as string[]).slice();
  return Object.keys(q.criteria as Record<string, string>);
}

export function isNoulCriteria(c: Question["criteria"]): c is NoulCriteria {
  return (
    !Array.isArray(c) && typeof c === "object" && "true" in c && "false" in c && Object.keys(c).length === 2
  );
}

/** Rough token estimate (about 4 characters per token) used only for cost estimates before a run. */
export function estimateTokens(req: DecisionRequest): number {
  const text = JSON.stringify(req.context) + JSON.stringify(req.questions);
  return Math.ceil(text.length / 4);
}

/** Validates a question set so a typo fails early with a clear message. */
export function validateQuestion(id: string, q: Question): string[] {
  const errs: string[] = [];
  if (!q.instructions?.trim()) errs.push(`${id}: instructions are empty`);
  if (q.type === "noul" && !isNoulCriteria(q.criteria))
    errs.push(`${id}: noul criteria need exactly "true" and "false"`);
  if (q.type === "score" && (!Array.isArray(q.criteria) || q.criteria.length < 2))
    errs.push(`${id}: score criteria must be an array of at least 2 levels, lowest first`);
  if (q.type === "choice" && (Array.isArray(q.criteria) || Object.keys(q.criteria).length < 2))
    errs.push(`${id}: choice criteria must map at least 2 option ids to descriptions`);
  return errs;
}
