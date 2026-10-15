import { route, type EscalationPolicy, type TriageRecord } from "@decision-models-lab/core";
import type { StripData } from "../components/Strip.tsx";
import type { Bay } from "../components/Board.tsx";
import { ticketById } from "./data.ts";
import { TEAM_LABEL } from "./format.ts";

export function firstSentence(text: string, max = 110): string {
  const s = text.split(/(?<=\.)\s/)[0] ?? text;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function stripFrom(
  rec: TriageRecord,
  policy: EscalationPolicy,
  opts: { printed?: boolean } = {},
): StripData {
  const t = ticketById.get(rec.ticketId);
  const a = rec.decision.answers;
  const r = route(rec.decision, policy);
  const escalated = r.action === "escalate";
  return {
    id: rec.ticketId,
    subject: t?.subject ?? rec.ticketId,
    state: escalated ? "escalated" : "routed",
    printed: opts.printed ?? true,
    team: a.team?.top,
    teamP: a.team ? a.team.probabilities[a.team.top] : undefined,
    urgency: a.urgency?.top,
    blockedP: a.customer_blocked ? Number(a.customer_blocked.value) : undefined,
    personalP: a.contains_personal_data ? Number(a.contains_personal_data.value) : undefined,
    latencyMs: rec.decision.latencyMs,
    costUsd: rec.decision.usage.costUsd,
    note: escalated && rec.draft ? firstSentence(rec.draft.reason) : undefined,
    flagged: escalated && rec.verification ? !rec.verification.outcome.passed : false,
  };
}

export const BAY_ORDER = ["incoming", "payments", "auth", "infra", "data", "account", "desk"] as const;

export function emptyBays(): Bay[] {
  return BAY_ORDER.map((id) => ({
    id,
    title: id === "incoming" ? "Incoming" : id === "desk" ? "Claude's desk" : TEAM_LABEL[id],
    strips: [],
    desk: id === "desk",
  }));
}

/** Puts each strip in the bay its state says: incoming, the team it was routed to, or Claude's desk. */
export function baysFor(strips: StripData[]): Bay[] {
  const bays = emptyBays();
  const byId = new Map(bays.map((b) => [b.id, b]));
  for (const d of strips) {
    const key =
      d.state === "incoming" ? "incoming" : d.state === "escalated" ? "desk" : (d.team ?? "incoming");
    (byId.get(key) ?? byId.get("incoming")!).strips.push(d);
  }
  return bays;
}
