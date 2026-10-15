/**
 * Hello World for decision models in TypeScript, using this repo's core library.
 *   OPENROUTER_API_KEY=sk-or-... npx tsx examples/hello-world/hello.ts [model]
 * model defaults to typesafe/jev-1.14; try microsoft/microsoft-decision-1-20261009.
 */
import { OpenRouterDecisions } from "../../packages/core/src/index.ts";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error("Set OPENROUTER_API_KEY first.");

const model = new OpenRouterDecisions({ apiKey, modelId: process.argv[2] ?? "typesafe/jev-1.14" });
const result = await model.decide({
  context: ["Ticket: Checkout returns HTTP 500 for all users since 10:05."],
  questions: {
    urgent: {
      type: "noul",
      instructions: "Does this need someone right now?",
      criteria: { true: "Customers are blocked or data is at risk", false: "It can wait for normal hours" },
    },
    team: {
      type: "choice",
      instructions: "Which team should own this?",
      criteria: {
        payments: "Checkout and billing",
        auth: "Login and access",
        infra: "Servers, network and outages",
      },
    },
    severity: {
      type: "score",
      instructions: "How severe is the impact?",
      criteria: ["Cosmetic", "Minor", "Major", "Critical"],
    },
  },
});

for (const [id, a] of Object.entries(result.answers)) {
  console.log(id.padEnd(9), a.top.padEnd(9), a.probabilities);
}
console.log(
  `${result.latencyMs.toFixed(0)} ms, $${result.usage.costUsd.toFixed(6)}, served by ${result.servedModel}`,
);
