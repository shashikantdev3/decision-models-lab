export type QuestionType = "noul" | "choice" | "score";

export interface NoulCriteria {
  true: string;
  false: string;
}

export interface Question {
  type: QuestionType;
  instructions: string;
  /** noul: { true, false }. choice: option id -> description. score: ordered labels, lowest first. */
  criteria: NoulCriteria | Record<string, string> | string[];
}

export interface DecisionRequest {
  /** Maps to `state` in the Decisions API. */
  context: string[];
  /** Question id -> question. */
  questions: Record<string, Question>;
}

export interface Answer {
  type: QuestionType;
  /** choice: option id. score: probability-weighted position (0-based). noul: P(yes). */
  value: string | number | boolean;
  /** Keyed by option id (choice), level label (score) or "true"/"false" (noul). */
  probabilities: Record<string, number>;
  /** How concentrated the distribution is. Provider value when given, otherwise the top probability. */
  confidence?: number;
  /** The single most likely answer: option id, level label, or "true"/"false". */
  top: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface DecisionResult {
  modelId: string;
  /** Model string the provider says it served, for example with a dated suffix. */
  servedModel?: string;
  answers: Record<string, Answer>;
  /** Measured by us, client side, from request sent to response parsed. */
  latencyMs: number;
  usage: Usage;
  /** Untouched provider response, for learning and debugging. */
  raw: unknown;
  mock?: boolean;
}

export type ModelKind = "decision" | "llm-as-decider";

export interface DecisionModel {
  id: string;
  label: string;
  kind: ModelKind;
  decide(req: DecisionRequest, opts?: { signal?: AbortSignal }): Promise<DecisionResult>;
}

export type Team = "payments" | "auth" | "infra" | "data" | "account";
export type Urgency = "Low" | "Normal" | "High" | "Critical";
export type Difficulty = "clear" | "ambiguous" | "adversarial";

export interface TicketLabels {
  team: Team;
  urgency: Urgency;
  customer_blocked: boolean;
  contains_personal_data: boolean;
}

export interface Ticket {
  id: string;
  channel: "email" | "chat" | "form";
  subject: string;
  body: string;
  labels: TicketLabels;
  difficulty: Difficulty;
  notes: string;
  /** How the label was settled: spec and blind check agreed, owner reviewed, or not cross-checked yet. */
  labelStatus?: "agreed" | "owner-reviewed" | "spec-only";
}

export interface Draft {
  writerId: string;
  labels: TicketLabels;
  reason: string;
  reply: string;
  latencyMs: number;
  usage: Usage;
  raw: unknown;
  mock?: boolean;
}

export interface Writer {
  id: string;
  label: string;
  draft(
    input: { ticket: Ticket; decision?: DecisionResult },
    opts?: { signal?: AbortSignal },
  ): Promise<Draft>;
}

export interface QuestionSet {
  version: string;
  triage: Record<string, Question>;
  verify: Record<string, Question>;
}

export interface EscalationPolicy {
  teamConfidenceThreshold: number;
  criticalProbabilityThreshold: number;
  personalDataUncertainBand: [number, number];
  verify: VerifyPolicy;
}

export interface VerifyPolicy {
  answersQuestionMin: number;
  leaksPersonalDataMax: number;
  unapprovedPromiseMax: number;
  minTone: string;
}

export interface RouteDecision {
  action: "auto" | "escalate";
  reasons: string[];
}

export interface VerifyOutcome {
  passed: boolean;
  failures: string[];
}

export interface TriageRecord {
  ticketId: string;
  decision: DecisionResult;
  route: RouteDecision;
  draft?: Draft;
  verification?: { result: DecisionResult; outcome: VerifyOutcome };
  /** Final labels: Claude's when escalated, otherwise the decision model's top answers. */
  final: TicketLabels;
  totalLatencyMs: number;
  totalCostUsd: number;
}
