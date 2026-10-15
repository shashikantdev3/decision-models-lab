/**
 * Step 5 of labels-by-construction: merge the owner's answers from data/review.csv into data/tickets.jsonl.
 *   npm run data:merge
 * resolution column: "spec" keeps the planned label, "blind" takes the cross-check label,
 * "rewrite" marks the ticket for rewriting (it is kept but flagged), or an exact label value.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { p, loadTickets, writeJsonl, parseCsv } from "./lib.ts";
import { TEAMS, URGENCY, type Ticket } from "../packages/core/src/index.ts";

const rows = parseCsv(readFileSync(p("data/review.csv"), "utf8"));
const open = rows.filter((r) => !r.resolution.trim());
if (open.length) {
  console.error(
    `${open.length} rows in data/review.csv have no resolution yet (first: ${open[0].id} ${open[0].field}).`,
  );
  process.exit(1);
}
const tickets = loadTickets();
const byId = new Map(tickets.map((t) => [t.id, t]));
const rewrite = new Set<string>();

function parseValue(field: string, v: string): string | boolean {
  if (field === "customer_blocked" || field === "contains_personal_data") {
    if (v !== "true" && v !== "false") throw new Error(`${field} must be true or false, got "${v}"`);
    return v === "true";
  }
  if (field === "team" && !(TEAMS as readonly string[]).includes(v)) throw new Error(`Unknown team "${v}"`);
  if (field === "urgency" && !(URGENCY as readonly string[]).includes(v))
    throw new Error(`Unknown urgency "${v}"`);
  return v;
}

for (const r of rows) {
  const t = byId.get(r.id);
  if (!t) throw new Error(`review.csv mentions unknown ticket ${r.id}`);
  const res = r.resolution.trim();
  if (res === "rewrite") {
    rewrite.add(r.id);
    continue;
  }
  const value = res === "spec" ? r.spec_label : res === "blind" ? r.blind_label : res;
  (t.labels as unknown as Record<string, unknown>)[r.field] = parseValue(r.field, value);
  t.labelStatus = "owner-reviewed";
}
for (const id of rewrite) {
  const t = byId.get(id)!;
  t.notes = `[needs rewrite] ${t.notes}`;
  t.labelStatus = "owner-reviewed";
}
writeJsonl(p("data/tickets.jsonl"), tickets as Ticket[]);

const statusFile = p("data/label-status.json");
const status = existsSync(statusFile) ? JSON.parse(readFileSync(statusFile, "utf8")) : {};
status.reviewedDate = new Date().toISOString().slice(0, 10);
status.reviewedRows = rows.length;
status.markedForRewrite = [...rewrite];
writeFileSync(statusFile, JSON.stringify(status, null, 2) + "\n");
console.log(
  `Merged ${rows.length} answers. ${rewrite.size} tickets marked for rewriting. Update the dates in data/README.md.`,
);
