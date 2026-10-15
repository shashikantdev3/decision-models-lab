import type {
  Answer,
  DecisionModel,
  DecisionRequest,
  DecisionResult,
  Difficulty,
  Draft,
  ModelKind,
  Question,
  Ticket,
  Writer,
} from "../types.ts";
import { optionsOf, ticketContext, estimateTokens, TEAMS, URGENCY } from "../questions.ts";
import { choiceAnswer, noulAnswer, scoreAnswer } from "./normalize.ts";
import { costFromTokens } from "../pricing.ts";
import { hash32, logNormal, seeded, sleep } from "../util/random.ts";

/**
 * Offline stand-ins. They return realistic-looking answers built from the dataset labels plus seeded noise:
 * some wrong answers, some low-confidence answers, and plausible latency. Every number they produce is
 * made up. They exist so the pipeline, CLI, tests and site run with no key and no cost.
 * Mock output is never written to results/.
 */

export interface MockProfile {
  latencyMedianMs: number;
  latencySigma: number;
  /** Range of confidence drawn per difficulty. */
  confidence: Record<Difficulty, [number, number]>;
  /** Added to the reported confidence but not to the real chance of being right. Positive = overconfident. */
  overconfidence: number;
}

export const MOCK_PROFILES: Record<string, MockProfile> = {
  jev: {
    latencyMedianMs: 105,
    latencySigma: 0.25,
    confidence: { clear: [0.84, 0.99], ambiguous: [0.45, 0.86], adversarial: [0.42, 0.88] },
    overconfidence: 0.0,
  },
  decision1: {
    latencyMedianMs: 310,
    latencySigma: 0.2,
    confidence: { clear: [0.8, 0.99], ambiguous: [0.44, 0.84], adversarial: [0.45, 0.9] },
    overconfidence: 0.02,
  },
  claude: {
    latencyMedianMs: 1600,
    latencySigma: 0.3,
    confidence: { clear: [0.86, 0.99], ambiguous: [0.5, 0.88], adversarial: [0.5, 0.9] },
    overconfidence: 0.12,
  },
};

export function profileFor(modelId: string): MockProfile {
  if (/jev/i.test(modelId)) return MOCK_PROFILES.jev;
  if (/decision-1/i.test(modelId)) return MOCK_PROFILES.decision1;
  if (/claude/i.test(modelId)) return MOCK_PROFILES.claude;
  return MOCK_PROFILES.decision1;
}

export interface OracleAnswer {
  truth: Record<string, string>;
  difficulty: Difficulty;
  /** Overrides the profile's confidence range, for questions that are easy to judge. */
  confidence?: [number, number];
}
export type Oracle = (req: DecisionRequest) => OracleAnswer | undefined;

const contextKey = (ctx: string[]) => ctx.join("\n");

/** Knows the dataset labels for triage requests and judges draft replies by simple text rules. */
export function createMockOracle(tickets: Ticket[]): Oracle {
  const byContext = new Map<string, Ticket>();
  for (const t of tickets) byContext.set(contextKey(ticketContext(t)), t);
  return (req): OracleAnswer | undefined => {
    const t = byContext.get(contextKey(req.context));
    if (t) {
      return {
        difficulty: t.difficulty,
        truth: {
          team: t.labels.team,
          urgency: t.labels.urgency,
          customer_blocked: String(t.labels.customer_blocked),
          contains_personal_data: String(t.labels.contains_personal_data),
        },
      };
    }
    const marker = req.context.indexOf("--- Draft reply ---");
    if (marker >= 0) {
      const reply = req.context.slice(marker + 1).join("\n");
      return {
        difficulty: "clear",
        confidence: [0.9, 0.995],
        truth: {
          reply_answers_the_question: String(reply.length > 80),
          reply_leaks_personal_data: String(/@example\.com|\b\d{4}\b.*card|card ending/i.test(reply)),
          reply_promises_something_unapproved: String(
            /refund|credit your account|by (monday|tuesday|wednesday|thursday|friday|tomorrow)/i.test(reply),
          ),
          reply_tone: /sorry for the inconvenience\.$/im.test(reply) ? "Flat" : "Professional",
        },
      };
    }
    return undefined;
  };
}

function between(rand: () => number, [lo, hi]: [number, number]) {
  return lo + (hi - lo) * rand();
}

/** Spreads `rest` probability over the other options, favouring `favour` when given. */
function spread(options: string[], top: string, c: number, rand: () => number, favour?: string) {
  const others = options.filter((o) => o !== top);
  const weights = others.map((o) => (o === favour ? 2.5 : 0.2) + rand());
  const sum = weights.reduce((a, b) => a + b, 0);
  const probs: Record<string, number> = { [top]: c };
  others.forEach((o, i) => (probs[o] = ((1 - c) * weights[i]) / sum));
  return probs;
}

function mockAnswer(
  q: Question,
  truth: string | undefined,
  difficulty: Difficulty,
  profile: MockProfile,
  rand: () => number,
  range?: [number, number],
): Answer {
  const options = optionsOf(q);
  const t =
    truth !== undefined && options.includes(truth) ? truth : options[Math.floor(rand() * options.length)];
  const realC = between(rand, range ?? profile.confidence[difficulty]);
  const reported = Math.min(0.995, realC + profile.overconfidence * rand() * 1.6);
  const correct = rand() < realC;

  if (q.type === "score") {
    const k = options.indexOf(t);
    const step = rand() < 0.5 ? -1 : 1;
    const wrongIdx = Math.min(
      options.length - 1,
      Math.max(0, k + (k === 0 ? 1 : k === options.length - 1 ? -1 : step)),
    );
    const topIdx = correct ? k : wrongIdx;
    const neighbour = options[correct ? Math.min(options.length - 1, Math.max(0, k + step)) : k];
    const probs = spread(options, options[topIdx], reported, rand, neighbour);
    return scoreAnswer(options, probs);
  }
  if (q.type === "noul") {
    const top = correct ? t : t === "true" ? "false" : "true";
    const pYes = top === "true" ? reported : 1 - reported;
    return noulAnswer(pYes);
  }
  const wrong = options.filter((o) => o !== t)[Math.floor(rand() * (options.length - 1))];
  const top = correct ? t : wrong;
  return choiceAnswer(spread(options, top, reported, rand, correct ? undefined : t));
}

/** Converts our Answer back into the documented provider shape, so mock raw output looks like the real thing. */
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const r4all = (o: Record<string, number>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r4(v)]));

function toProviderShape(a: Answer, q: Question) {
  if (a.type === "noul") return { type: "noul", noul: r4(Number(a.value)) };
  if (a.type === "choice")
    return {
      type: "choice",
      choice: a.top,
      confidence: r4(a.confidence ?? 0),
      probabilities: r4all(a.probabilities),
    };
  const levels = optionsOf(q);
  return {
    type: "score",
    score: r4(Number(a.value)),
    confidence: r4(a.confidence ?? 0),
    probabilities: Object.fromEntries(levels.map((l, i) => [String(i), r4(a.probabilities[l])])),
    legend: Object.fromEntries(levels.map((l, i) => [String(i), l])),
  };
}

export interface MockDeciderOptions {
  modelId: string;
  label?: string;
  kind?: ModelKind;
  oracle?: Oracle;
  /** Changes the noise so repeated runs differ, like real repeated runs. */
  run?: number;
  /** Actually wait for the sampled latency. Off by default so tests stay fast. */
  simulateLatency?: boolean;
}

export class MockDecider implements DecisionModel {
  readonly id: string;
  readonly label: string;
  readonly kind: ModelKind;
  constructor(private readonly o: MockDeciderOptions) {
    this.id = o.modelId;
    this.label = o.label ?? `${o.modelId} (mock)`;
    this.kind = o.kind ?? (/claude/i.test(o.modelId) ? "llm-as-decider" : "decision");
  }

  async decide(req: DecisionRequest, opts?: { signal?: AbortSignal }): Promise<DecisionResult> {
    const profile = profileFor(this.id);
    const oracle = this.o.oracle?.(req);
    const seed = `${this.id}|${this.o.run ?? 0}|${contextKey(req.context)}|${JSON.stringify(req.questions)}`;
    const rand = seeded(seed);
    const answers: Record<string, Answer> = {};
    const rawAnswers: Record<string, unknown> = {};
    for (const [id, q] of Object.entries(req.questions)) {
      // Each question gets its own stream so adding a question does not change the others.
      const qRand = seeded(`${seed}|${id}`);
      answers[id] = mockAnswer(
        q,
        oracle?.truth[id],
        oracle?.difficulty ?? "ambiguous",
        profile,
        qRand,
        oracle?.confidence,
      );
      rawAnswers[id] = toProviderShape(answers[id], q);
    }
    const latencyMs = Math.max(20, logNormal(rand, profile.latencyMedianMs, profile.latencySigma));
    if (this.o.simulateLatency) await sleep(latencyMs, opts?.signal);
    const inputTokens = estimateTokens(req) + (this.kind === "llm-as-decider" ? 420 : 0);
    const outputTokens =
      this.kind === "decision"
        ? Object.keys(req.questions).length > 0
          ? 2
          : 0
        : 40 + 28 * Object.keys(req.questions).length;
    const costUsd = costFromTokens(this.id, inputTokens, outputTokens);
    return {
      modelId: this.id,
      servedModel: `${this.id} (mock)`,
      answers,
      latencyMs,
      usage: { inputTokens, outputTokens, costUsd },
      raw: {
        mock: true,
        id: `mock-${hash32(seed).toString(16)}`,
        model: this.id,
        answers: rawAnswers,
        usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost: costUsd },
      },
      mock: true,
    };
  }
}

const TEAM_NAMES: Record<string, string> = {
  payments: "Payments",
  auth: "Identity and access",
  infra: "Platform",
  data: "Data",
  account: "Accounts",
};

const TEAM_SCOPE: Record<string, string> = {
  payments: "checkout, invoices and billing",
  auth: "sign-in, SSO and access",
  infra: "uptime, performance and the network",
  data: "exports, imports, reports and sync",
  account: "plans, seats, profile and account settings",
};

/** Offline Claude stand-in for the System Two step. Mostly right, sometimes writes a reply that should fail checks. */
export class MockWriter implements Writer {
  readonly id: string;
  readonly label: string;
  constructor(
    private readonly o: {
      modelId: string;
      label?: string;
      run?: number;
      simulateLatency?: boolean;
      failRate?: number;
    } = {
      modelId: "claude-sonnet-5-5",
    },
  ) {
    this.id = o.modelId;
    this.label = o.label ?? `${o.modelId} (mock)`;
  }

  async draft(
    input: { ticket: Ticket; decision?: DecisionResult },
    opts?: { signal?: AbortSignal },
  ): Promise<Draft> {
    const { ticket } = input;
    const rand = seeded(`writer|${this.id}|${this.o.run ?? 0}|${ticket.id}`);
    const acc = ticket.difficulty === "clear" ? 0.97 : ticket.difficulty === "ambiguous" ? 0.88 : 0.82;
    const labels = { ...ticket.labels };
    if (rand() > acc) {
      const alt = input.decision?.answers.team?.top;
      labels.team = (
        alt && alt !== ticket.labels.team ? alt : TEAMS[Math.floor(rand() * TEAMS.length)]
      ) as typeof labels.team;
    }
    if (rand() > acc + 0.05) {
      const i = URGENCY.indexOf(labels.urgency);
      labels.urgency = URGENCY[Math.min(3, Math.max(0, i + (rand() < 0.5 ? -1 : 1)))];
    }
    const urgencyPhrase: Record<string, string> = {
      Low: "in the normal queue",
      Normal: "today",
      High: "as a priority",
      Critical: "right now, with an engineer on call",
    };
    const reason =
      `The message is about ${TEAM_SCOPE[labels.team]}, which ${TEAM_NAMES[labels.team]} owns. ` +
      `Urgency is ${labels.urgency.toLowerCase()} because ${labels.customer_blocked ? "the customer cannot carry on with their work" : "there is no hard block on the customer"}. ` +
      (labels.contains_personal_data
        ? "The ticket includes personal data, so the reply must not repeat it."
        : "No personal data in the ticket.");
    let reply =
      `Hi, thanks for getting in touch. I have passed this to our ${TEAM_NAMES[labels.team]} team, who will pick it up ${urgencyPhrase[labels.urgency]}. ` +
      (labels.customer_blocked
        ? "We understand this is stopping your work and have marked it accordingly. "
        : "") +
      "We will update you on this ticket as soon as we know more. Contoso Support";
    const failRate = this.o.failRate ?? 0.15;
    const roll = rand();
    if (roll < failRate / 2)
      reply = reply.replace("We will update you", "We will refund you in full by Friday and update you");
    else if (roll < failRate) reply = `Hi, we checked the account for priya.n@example.com. ` + reply;

    const latencyMs = Math.max(400, logNormal(rand, 2600, 0.3));
    if (this.o.simulateLatency) await sleep(latencyMs, opts?.signal);
    const inputTokens = 620 + Math.round(ticket.body.length / 4);
    const outputTokens = 180 + Math.round(rand() * 120);
    return {
      writerId: this.id,
      labels,
      reason,
      reply,
      latencyMs,
      usage: { inputTokens, outputTokens, costUsd: costFromTokens(this.id, inputTokens, outputTokens) },
      raw: { mock: true },
      mock: true,
    };
  }
}

/** Convenience: a mock decider wired to the dataset. */
export function mockDeciderFor(
  modelId: string,
  tickets: Ticket[],
  opts: Partial<MockDeciderOptions> = {},
): MockDecider {
  return new MockDecider({ modelId, oracle: createMockOracle(tickets), ...opts });
}
