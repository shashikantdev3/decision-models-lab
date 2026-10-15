/**
 * Step 2 of labels-by-construction: Claude writes each ticket from its spec, so the right answer exists
 * before the text does.
 *   npm run data:draft -- --writer claude-sonnet [--limit 5] [--yes]
 * Writes data/tickets.drafted.jsonl. It does not touch data/tickets.jsonl unless you pass --replace.
 * The v1 tickets in data/tickets.jsonl were written this way during the build (see data/README.md).
 */
import { existsSync, readFileSync, copyFileSync } from "node:fs";
import { p, loadEnv, writeJsonl, readJsonl, confirm, arg, flag } from "./lib.ts";
import {
  callToolOnce,
  costFromTokens,
  findWriter,
  mapPool,
  type Ticket,
} from "../packages/core/src/index.ts";

loadEnv();
const writer = findWriter(arg("writer", "claude-sonnet")!);
const limit = Number(arg("limit", "0"));
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("No Anthropic key. Put ANTHROPIC_API_KEY in .env.");
  process.exit(1);
}

interface Spec {
  id: string;
  channel: Ticket["channel"];
  labels: Ticket["labels"];
  difficulty: Ticket["difficulty"];
  twist?: string;
}
const { specs } = JSON.parse(readFileSync(p("data/specs.v1.json"), "utf8")) as { specs: Spec[] };
const out = p("data/tickets.drafted.jsonl");
const done = existsSync(out) ? readJsonl<Ticket>(out) : [];
const doneIds = new Set(done.map((t) => t.id));
let todo = specs.filter((s) => !doneIds.has(s.id));
if (limit) todo = todo.slice(0, limit);

const estimate = costFromTokens(writer.id, 900 * todo.length, 350 * todo.length);
console.log(`${todo.length} tickets to draft with ${writer.label}. Estimated cost: $${estimate.toFixed(3)}.`);
if (!todo.length) process.exit(0);
if (!flag("yes") && !(await confirm("Go ahead?"))) {
  console.log("Stopped. Nothing was spent.");
  process.exit(0);
}

const SYSTEM = `You write realistic support tickets for Contoso, a fictional SaaS company (projects, invoicing, reports, API).
Write the ticket so that a careful support lead would give it exactly the labels in the spec.
Rules: plain customer language, 1 to 5 sentences, no markdown. Any personal data must be obviously fake:
emails end in @example.com, phone numbers use 555-01xx, names are invented. If the spec says contains_personal_data is false,
include no email, phone, card digits, address or full name. Follow the twist if there is one.`;

const results = [...done];
await mapPool(todo, 3, async (s) => {
  const call = await callToolOnce<{ subject: string; body: string; notes: string }>(
    { apiKey: key, modelId: writer.id, maxTokens: 700 },
    {
      system: SYSTEM,
      user: `Spec:\n${JSON.stringify(s, null, 2)}\n\nTeams: payments (checkout, invoices, charges), auth (sign-in, MFA, SSO, keys, permissions), infra (outages, errors, slowness, webhooks), data (exports, imports, reports, sync), account (plans, seats, settings, ownership).`,
      tool: {
        name: "write_ticket",
        description: "Return the ticket.",
        input_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            notes: { type: "string", description: "One or two sentences: why the labels are what they are." },
          },
          required: ["subject", "body", "notes"],
        },
      },
    },
  );
  results.push({ ...s, ...call.input, labelStatus: "spec-only" } as Ticket);
  writeJsonl(
    out,
    results.sort((a, b) => a.id.localeCompare(b.id)),
  );
  console.log(`drafted ${s.id}`);
});

console.log(`Wrote ${out}`);
if (flag("replace")) {
  copyFileSync(out, p("data/tickets.jsonl"));
  console.log("Replaced data/tickets.jsonl. Run npm run data:crosscheck next.");
}
