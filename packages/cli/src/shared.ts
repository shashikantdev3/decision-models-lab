import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import {
  ProviderError,
  buildDecider,
  findDecider,
  sleep,
  type DecisionModel,
  type DecisionRequest,
  type DecisionResult,
  type Provenance,
  type Ticket,
} from "../../core/src/index.ts";
import {
  p,
  loadEnv,
  loadTickets,
  loadQuestions,
  sha256,
  confirm,
  arg,
  flag,
  readJsonl,
} from "../../../scripts/lib.ts";

export { p, loadEnv, loadTickets, loadQuestions, confirm, arg, flag };

export const today = () => new Date().toISOString().slice(0, 10);

export function gitCommit(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return dirty ? `${sha}+uncommitted` : sha;
  } catch {
    return "no-commit-yet";
  }
}

export function region(): string {
  const r = arg("region") ?? process.env.DML_REGION;
  if (r) return r;
  return `unknown (timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}); set --region or DML_REGION`;
}

export function loadDataset(file = arg("dataset", "data/tickets.jsonl")!): {
  tickets: Ticket[];
  info: Provenance["dataset"];
} {
  const full = resolve(p("."), file);
  const tickets = full === p("data/tickets.jsonl") ? loadTickets() : readJsonl<Ticket>(full);
  const statuses = tickets.reduce<Record<string, number>>((m, t) => {
    const s = t.labelStatus ?? "spec-only";
    m[s] = (m[s] ?? 0) + 1;
    return m;
  }, {});
  const labelStatus = statuses["spec-only"]
    ? "labels machine-made, not cross-checked or human-reviewed yet"
    : statuses["owner-reviewed"]
      ? "labels machine-made, cross-checked, disagreements reviewed by the owner"
      : "labels machine-made and cross-checked, not human-reviewed";
  return { tickets, info: { version: "v1", sha256: sha256(full), count: tickets.length, labelStatus } };
}

export function provenance(o: {
  runs: number;
  questionSet: string;
  dataset: Provenance["dataset"];
  mock: boolean;
}): Provenance {
  return {
    date: today(),
    createdAt: new Date().toISOString(),
    gitCommit: gitCommit(),
    region: region(),
    questionSet: o.questionSet,
    dataset: o.dataset,
    runs: o.runs,
    mock: o.mock,
  };
}

/** Where a run's files go. Mock output never goes to results/. */
export function outDir(mock: boolean): string {
  const dir = mock ? p(".cache", "mock-results", today()) : p("results", today());
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
}

export function keys() {
  loadEnv();
  return { openrouter: process.env.OPENROUTER_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY };
}

export const usd = (n: number) => (n < 0.01 ? `$${n.toFixed(6)}` : `$${n.toFixed(4)}`);

/** Live responses are stored in .cache/responses so a rerun after a crash or a code fix never pays twice. */
export class ResponseCache {
  private dir = p(".cache", "responses");
  constructor(private readonly fresh: boolean) {
    mkdirSync(this.dir, { recursive: true });
  }
  key(modelId: string, tag: string, req: DecisionRequest): string {
    return createHash("sha256")
      .update(JSON.stringify([modelId, tag, req]))
      .digest("hex")
      .slice(0, 32);
  }
  get(k: string): DecisionResult | undefined {
    if (this.fresh) return undefined;
    const f = resolve(this.dir, `${k}.json`);
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as DecisionResult) : undefined;
  }
  set(k: string, r: DecisionResult): void {
    writeFileSync(resolve(this.dir, `${k}.json`), JSON.stringify(r));
  }
}

export class BudgetExceeded extends Error {}

/** Tracks money spent on new calls in this process and stops before going over the cap. */
export class Budget {
  spent = 0;
  constructor(public readonly maxUsd: number) {}
  check(nextEstimate: number): void {
    if (this.spent + nextEstimate > this.maxUsd) {
      throw new BudgetExceeded(
        `Stopped before going over the budget: spent ${usd(this.spent)} of ${usd(this.maxUsd)}. Raise --max-usd to continue; cached calls will not be paid for again.`,
      );
    }
  }
  add(cost: number): void {
    this.spent += cost;
  }
}

/** Retries rate limits and provider failures with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const retryable = err instanceof ProviderError && err.retryable;
      if (!retryable || attempt >= retries) throw err;
      const wait = 1000 * 2 ** attempt + Math.random() * 300;
      console.warn(`  ${(err as Error).message} Retrying in ${(wait / 1000).toFixed(1)} s.`);
      await sleep(wait);
    }
  }
}

export interface CallRunner {
  model: DecisionModel;
  call(req: DecisionRequest, tag: string, estimateUsd: number): Promise<DecisionResult & { cached: boolean }>;
}

/** Wraps a decider with the cache, the budget and retries. Mock deciders skip all three. */
export function runner(
  model: DecisionModel,
  o: { cache: ResponseCache; budget: Budget; mock: boolean },
): CallRunner {
  return {
    model,
    async call(req, tag, estimateUsd) {
      if (o.mock) return { ...(await model.decide(req)), cached: false };
      const k = o.cache.key(model.id, tag, req);
      const hit = o.cache.get(k);
      if (hit) return { ...hit, cached: true };
      o.budget.check(estimateUsd);
      const r = await withRetry(() => model.decide(req));
      o.budget.add(r.usage.costUsd);
      o.cache.set(k, r);
      return { ...r, cached: false };
    },
  };
}

export function deciderFor(key: string, tickets: Ticket[], mock: boolean, run = 0): DecisionModel {
  return buildDecider(key, { keys: keys(), mock: mock ? { tickets, run } : undefined });
}

export { findDecider };

/** Reads OpenRouter's running total for this key, to check our summed usage.cost against the account. */
export async function openRouterUsage(): Promise<number | undefined> {
  const k = keys().openrouter;
  if (!k) return undefined;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${k}` },
    });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { data?: { usage?: number } };
    return j.data?.usage;
  } catch {
    return undefined;
  }
}

export function listDir(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir) : [];
}

export function printTable(rows: (string | number)[][]): void {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
  for (const r of rows) console.log(r.map((c, i) => String(c).padEnd(widths[i])).join("  "));
}

export const pct = (n: number | undefined) =>
  n === undefined || Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(1)}%`;

export function mockBanner(): void {
  console.log(
    "\n[MOCK] Offline stand-in models. Every number below is made up. Nothing is written to results/.\n",
  );
}
