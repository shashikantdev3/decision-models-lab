/**
 * Step 3 of labels-by-construction: a different Claude model labels every ticket blind (it never sees the spec).
 * Agreements are accepted. Disagreements go to data/review.csv for the owner.
 *   npm run data:crosscheck -- --model claude-sonnet [--yes]
 * Use a model that did not write the tickets. The v1 tickets were written by Claude Opus 5.5.
 */
import { writeFileSync } from "node:fs";
import { p, loadEnv, loadTickets, writeJsonl, toCsv, confirm, arg, flag } from "./lib.ts";
import {
  callToolOnce,
  costFromTokens,
  findWriter,
  mapPool,
  ticketContext,
  TEAMS,
  URGENCY,
  type TicketLabels,
} from "../packages/core/src/index.ts";

loadEnv();
const model = findWriter(arg("model", "claude-sonnet")!);
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("No Anthropic key. Put ANTHROPIC_API_KEY in .env.");
  process.exit(1);
}
const tickets = loadTickets();
const qs = JSON.parse((await import("node:fs")).readFileSync(p("data/questions.v1.json"), "utf8"));
const estimate = costFromTokens(model.id, 1100 * tickets.length, 120 * tickets.length);
console.log(
  `Blind-labelling ${tickets.length} tickets with ${model.label}. Estimated cost: $${estimate.toFixed(3)}.`,
);
if (!flag("yes") && !(await confirm("Go ahead?"))) {
  console.log("Stopped. Nothing was spent.");
  process.exit(0);
}

const definitions = [
  `team: ${qs.triage.team.instructions}`,
  ...Object.entries(qs.triage.team.criteria as Record<string, string>).map(([k, v]) => `  ${k}: ${v}`),
  `urgency: ${qs.triage.urgency.instructions}`,
  `customer_blocked: ${qs.triage.customer_blocked.instructions} true = ${qs.triage.customer_blocked.criteria.true}; false = ${qs.triage.customer_blocked.criteria.false}`,
  `contains_personal_data: ${qs.triage.contains_personal_data.instructions} true = ${qs.triage.contains_personal_data.criteria.true}; false = ${qs.triage.contains_personal_data.criteria.false}`,
].join("\n");

const blind = await mapPool(tickets, 4, async (t) => {
  const call = await callToolOnce<TicketLabels>(
    { apiKey: key, modelId: model.id, maxTokens: 300 },
    {
      system: "You are a careful support lead. Label the ticket using the definitions. Call the tool only.",
      user: `Definitions:\n${definitions}\n\nTicket:\n${ticketContext(t).join("\n")}`,
      tool: {
        name: "label_ticket",
        description: "Record the labels.",
        input_schema: {
          type: "object",
          properties: {
            team: { type: "string", enum: [...TEAMS] },
            urgency: { type: "string", enum: [...URGENCY] },
            customer_blocked: { type: "boolean" },
            contains_personal_data: { type: "boolean" },
          },
          required: ["team", "urgency", "customer_blocked", "contains_personal_data"],
        },
      },
    },
  );
  return { id: t.id, labels: call.input };
});

const fields = ["team", "urgency", "customer_blocked", "contains_personal_data"] as const;
const review: Record<string, string>[] = [];
let agreedTickets = 0;
let agreedFields = 0;
const updated = tickets.map((t) => {
  const b = blind.find((x) => x.id === t.id)!.labels;
  let all = true;
  for (const f of fields) {
    if (String(b[f]) === String(t.labels[f])) agreedFields++;
    else {
      all = false;
      review.push({
        id: t.id,
        subject: t.subject,
        field: f,
        spec_label: String(t.labels[f]),
        blind_label: String(b[f]),
        resolution: "",
        notes: t.notes,
      });
    }
  }
  if (all) agreedTickets++;
  return { ...t, labelStatus: all ? "agreed" : "spec-only" };
});

writeJsonl(p("data/tickets.jsonl"), updated);
writeFileSync(
  p("data/review.csv"),
  toCsv(review, ["id", "subject", "field", "spec_label", "blind_label", "resolution", "notes"]),
);
const status = {
  crosscheckDate: new Date().toISOString().slice(0, 10),
  crosscheckModel: model.id,
  ticketAgreement: agreedTickets / tickets.length,
  fieldAgreement: agreedFields / (tickets.length * fields.length),
  disagreements: review.length,
  reviewedDate: null,
};
writeFileSync(p("data/label-status.json"), JSON.stringify(status, null, 2) + "\n");
console.log(
  `Tickets fully agreed: ${agreedTickets}/${tickets.length}. Field agreement: ${(status.fieldAgreement * 100).toFixed(1)}%.`,
);
console.log(`${review.length} disagreements written to data/review.csv.`);
console.log(
  'Fill the "resolution" column with: spec, blind, rewrite, or the exact label value. Then run npm run data:merge.',
);
