import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { QuestionSet, Ticket } from "../packages/core/src/index.ts";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const p = (...parts: string[]) => resolve(ROOT, ...parts);

export function loadEnv(): void {
  const file = p(".env");
  if (existsSync(file) && typeof process.loadEnvFile === "function") process.loadEnvFile(file);
}

export function readJsonl<T>(file: string): T[] {
  return readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as T;
      } catch {
        throw new Error(`${file}: line ${i + 1} is not valid JSON`);
      }
    });
}

export function writeJsonl(file: string, rows: unknown[]): void {
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

export const loadTickets = () => readJsonl<Ticket>(p("data/tickets.jsonl"));
export const loadQuestions = (version = "v1") =>
  JSON.parse(readFileSync(p(`data/questions.${version}.json`), "utf8")) as QuestionSet;

export function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  rl.close();
  return answer === "y" || answer === "yes";
}

/** Minimal CSV for review files: quotes fields that need it. */
export function toCsv(rows: Record<string, string>[], headers: string[]): string {
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return (
    [headers.join(","), ...rows.map((r) => headers.map((h) => q(r[h] ?? "")).join(","))].join("\n") + "\n"
  );
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    if (row.some((x) => x !== "")) rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries((header ?? []).map((h, i) => [h, r[i] ?? ""])));
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  return fallback;
}

export const flag = (name: string) => process.argv.includes(`--${name}`);
