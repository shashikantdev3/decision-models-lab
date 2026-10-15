import type {
  DecisionModel,
  EscalationPolicy,
  QuestionSet,
  Ticket,
  TicketLabels,
  TriageRecord,
  Writer,
  DecisionResult,
} from "../types.ts";
import { buildTriageRequest, buildVerifyRequest } from "../questions.ts";
import { route, checkDraft } from "../policy/escalation.ts";
import { mapPool } from "../util/pool.ts";

export interface TriageOptions {
  tickets: Ticket[];
  decider: DecisionModel;
  /** Claude. When missing, escalated tickets keep the decision model's labels and are marked for a human. */
  writer?: Writer;
  /** Checks Claude's draft. Defaults to the decider. */
  verifier?: DecisionModel;
  questions: QuestionSet;
  policy: EscalationPolicy;
  concurrency?: number;
  signal?: AbortSignal;
  onRecord?: (rec: TriageRecord, index: number) => void;
  /**
   * Ask the writer about every ticket, not only escalated ones. Costs more, but lets a replay show a
   * Claude draft wherever the threshold slider is moved. Final labels still follow the route.
   */
  draftAll?: boolean;
}

export function labelsFromDecision(d: Pick<DecisionResult, "answers">): TicketLabels {
  const a = d.answers;
  return {
    team: a.team?.top as TicketLabels["team"],
    urgency: a.urgency?.top as TicketLabels["urgency"],
    customer_blocked: a.customer_blocked ? Number(a.customer_blocked.value) >= 0.5 : false,
    contains_personal_data: a.contains_personal_data ? Number(a.contains_personal_data.value) >= 0.5 : false,
  };
}

/** One ticket through the loop: decide, route, reason, verify, record. */
export async function triageOne(t: Ticket, o: Omit<TriageOptions, "tickets">): Promise<TriageRecord> {
  const decision = await o.decider.decide(buildTriageRequest(t, o.questions), { signal: o.signal });
  const r = route(decision, o.policy);
  const rec: TriageRecord = {
    ticketId: t.id,
    decision,
    route: r,
    final: labelsFromDecision(decision),
    totalLatencyMs: decision.latencyMs,
    totalCostUsd: decision.usage.costUsd,
  };
  if (o.writer && (r.action === "escalate" || o.draftAll)) {
    const draft = await o.writer.draft({ ticket: t, decision }, { signal: o.signal });
    rec.draft = draft;
    if (r.action === "escalate") rec.final = draft.labels;
    const verifier = o.verifier ?? o.decider;
    const vr = await verifier.decide(buildVerifyRequest(t, draft, o.questions), { signal: o.signal });
    rec.verification = { result: vr, outcome: checkDraft(vr, o.policy.verify) };
    if (r.action === "escalate") {
      rec.totalLatencyMs += draft.latencyMs + vr.latencyMs;
      rec.totalCostUsd += draft.usage.costUsd + vr.usage.costUsd;
    }
  }
  return rec;
}

export async function runTriage(o: TriageOptions): Promise<TriageRecord[]> {
  return mapPool(o.tickets, o.concurrency ?? 4, async (t, i) => {
    const rec = await triageOne(t, o);
    o.onRecord?.(rec, i);
    return rec;
  });
}

export interface QueueStats {
  total: number;
  auto: number;
  escalated: number;
  autoShare: number;
  /** Accuracy of `team` on tickets routed automatically. Undefined when none were. */
  autoTeamAccuracy?: number;
  /** Accuracy of all four labels on the final answers (Claude's for escalated tickets). */
  finalTeamAccuracy: number;
  draftsFailed: number;
  costUsd: number;
  /** Sum of per-ticket time. Tickets in parallel finish sooner than this. */
  timeMs: number;
}

/**
 * Re-applies a policy to recorded decisions without new calls. This powers the threshold slider:
 * the decision model's probabilities do not change, only where the line sits.
 * A ticket that the recording auto-routed but the new policy escalates has no Claude draft; it is
 * counted as escalated and its cost uses `writerCostEstimate`.
 */
export function rerouteQueue(
  records: TriageRecord[],
  tickets: Map<string, Ticket>,
  policy: EscalationPolicy,
  writerCostEstimate = 0,
  writerLatencyEstimate = 0,
): { routes: Map<string, ReturnType<typeof route>>; stats: QueueStats } {
  const routes = new Map<string, ReturnType<typeof route>>();
  let auto = 0;
  let autoCorrect = 0;
  let finalCorrect = 0;
  let cost = 0;
  let time = 0;
  let failed = 0;
  for (const rec of records) {
    const r = route(rec.decision, policy);
    routes.set(rec.ticketId, r);
    const truth = tickets.get(rec.ticketId)?.labels;
    const decided = labelsFromDecision(rec.decision);
    cost += rec.decision.usage.costUsd;
    time += rec.decision.latencyMs;
    if (r.action === "auto") {
      auto++;
      if (truth && decided.team === truth.team) {
        autoCorrect++;
        finalCorrect++;
      }
    } else {
      const final = rec.draft?.labels ?? decided;
      if (truth && final.team === truth.team) finalCorrect++;
      if (rec.draft) {
        cost += rec.draft.usage.costUsd + (rec.verification?.result.usage.costUsd ?? 0);
        time += rec.draft.latencyMs + (rec.verification?.result.latencyMs ?? 0);
        if (rec.verification && !rec.verification.outcome.passed) failed++;
      } else {
        cost += writerCostEstimate;
        time += writerLatencyEstimate;
      }
    }
  }
  const total = records.length;
  return {
    routes,
    stats: {
      total,
      auto,
      escalated: total - auto,
      autoShare: total ? auto / total : 0,
      autoTeamAccuracy: auto ? autoCorrect / auto : undefined,
      finalTeamAccuracy: total ? finalCorrect / total : 0,
      draftsFailed: failed,
      costUsd: cost,
      timeMs: time,
    },
  };
}
