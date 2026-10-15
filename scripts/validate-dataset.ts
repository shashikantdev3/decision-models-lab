/** Checks data/tickets.jsonl, the question set and the rewordings. Used in CI. */
import { readFileSync } from "node:fs";
import { p, loadTickets, loadQuestions } from "./lib.ts";
import { TEAMS, URGENCY, validateQuestion } from "../packages/core/src/index.ts";

const errors: string[] = [];
const tickets = loadTickets();
const ids = new Set<string>();
for (const t of tickets) {
  if (ids.has(t.id)) errors.push(`${t.id}: duplicate id`);
  ids.add(t.id);
  if (!["email", "chat", "form"].includes(t.channel)) errors.push(`${t.id}: bad channel`);
  if (!(TEAMS as readonly string[]).includes(t.labels.team)) errors.push(`${t.id}: bad team`);
  if (!(URGENCY as readonly string[]).includes(t.labels.urgency)) errors.push(`${t.id}: bad urgency`);
  if (typeof t.labels.customer_blocked !== "boolean") errors.push(`${t.id}: customer_blocked not boolean`);
  if (typeof t.labels.contains_personal_data !== "boolean")
    errors.push(`${t.id}: contains_personal_data not boolean`);
  if (!["clear", "ambiguous", "adversarial"].includes(t.difficulty)) errors.push(`${t.id}: bad difficulty`);
  const emails = t.body.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
  for (const e of emails)
    if (!e.endsWith("@example.com")) errors.push(`${t.id}: email ${e} is not @example.com`);
  if (Buffer.byteLength(t.body) > 4000) errors.push(`${t.id}: body is longer than 4,000 bytes`);
}
const qs = loadQuestions();
for (const [id, q] of Object.entries({ ...qs.triage, ...qs.verify })) errors.push(...validateQuestion(id, q));
const rw = JSON.parse(readFileSync(p("data/rewordings.v1.json"), "utf8"));
for (const [id, list] of Object.entries(
  rw.rewordings as Record<string, { instructions: string; criteria: unknown }[]>,
)) {
  if (!qs.triage[id]) errors.push(`rewordings: unknown question ${id}`);
  if (list.length !== 3) errors.push(`rewordings: ${id} needs 3 rewordings`);
  for (const r of list) {
    const orig = qs.triage[id];
    const keysA = JSON.stringify(
      Array.isArray(orig.criteria) ? orig.criteria : Object.keys(orig.criteria).sort(),
    );
    const keysB = JSON.stringify(
      Array.isArray(r.criteria) ? r.criteria : Object.keys(r.criteria as object).sort(),
    );
    if (keysA !== keysB) errors.push(`rewordings: ${id} changes the answer keys`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Dataset OK: ${tickets.length} tickets, question set ${qs.version}, rewordings v1.`);
