import ticketsRaw from "../../../data/tickets.jsonl?raw";
import questionsJson from "../../../data/questions.v1.json";
import rewordingsJson from "../../../data/rewordings.v1.json";
import type {
  BenchFile,
  QuestionSet,
  SummaryFile,
  Ticket,
  TriageFile,
  WordingFile,
  Question,
} from "@decision-models-lab/core";

export const tickets: Ticket[] = ticketsRaw
  .split(/\r?\n/)
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));
export const ticketById = new Map(tickets.map((t) => [t.id, t]));
export const questions = questionsJson as unknown as QuestionSet;
export const rewordings = rewordingsJson as unknown as {
  rewordings: Record<string, Pick<Question, "instructions" | "criteria">[]>;
};

/** One recorded day of results: everything the CLI wrote to results/<date>/. */
export interface ResultSet {
  date: string;
  mock: boolean;
  summary?: SummaryFile;
  bench: BenchFile[];
  triage: TriageFile[];
  wording: WordingFile[];
}

// Vite bundles every recorded result at build time. Mock output never lives in results/, so these are real runs.
const files = import.meta.glob("../../../results/*/*.json", { eager: true, import: "default" }) as Record<
  string,
  unknown
>;

function collect(): ResultSet[] {
  const byDate = new Map<string, ResultSet>();
  for (const [path, data] of Object.entries(files)) {
    const date = path.split("/").at(-2)!;
    const set = byDate.get(date) ?? { date, mock: false, bench: [], triage: [], wording: [] };
    const d = data as { kind?: string; provenance?: { mock?: boolean } };
    if (d.provenance?.mock) continue; // never replay mock data as if it were recorded
    if (d.kind === "summary") set.summary = d as SummaryFile;
    else if (d.kind === "bench") set.bench.push(d as BenchFile);
    else if (d.kind === "triage") set.triage.push(d as TriageFile);
    else if (d.kind === "wording") set.wording.push(d as WordingFile);
    byDate.set(date, set);
  }
  return [...byDate.values()]
    .filter((s) => s.bench.length || s.triage.length)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const recorded: ResultSet[] = collect();
export const latestRecorded: ResultSet | undefined = recorded[0];

export function labelStatusText(set: ResultSet | undefined): string {
  const s = set?.bench[0]?.provenance.dataset.labelStatus ?? set?.triage[0]?.provenance.dataset.labelStatus;
  if (s) return s;
  const statuses = new Set(tickets.map((t) => t.labelStatus ?? "spec-only"));
  if (statuses.has("spec-only")) return "labels machine-made, not cross-checked or human-reviewed yet";
  if (statuses.has("owner-reviewed"))
    return "labels machine-made, cross-checked, disagreements reviewed by the owner";
  return "labels machine-made and cross-checked, not human-reviewed";
}
