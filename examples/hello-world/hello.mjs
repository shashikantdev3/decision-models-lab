/**
 * Hello World for decision models in plain Node.js 18+. No packages to install.
 *
 *   OPENROUTER_API_KEY=sk-or-... node examples/hello-world/hello.mjs
 *   OPENROUTER_API_KEY=sk-or-... node examples/hello-world/hello.mjs microsoft/microsoft-decision-1-20261009
 *   add --raw to print the untouched JSON response
 *
 * One request, three questions. Costs about $0.00002. Output tokens are free.
 */
const model = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "typesafe/jev-1.14";
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error("Set OPENROUTER_API_KEY first.");
  process.exit(1);
}

const levels = ["Cosmetic", "Minor", "Major", "Critical"];
const body = {
  model,
  state: ["Ticket: Checkout returns HTTP 500 for all users since 10:05."],
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
    severity: { type: "score", instructions: "How severe is the impact?", criteria: levels },
  },
};

const started = performance.now();
const res = await fetch("https://openrouter.ai/api/alpha/decisions", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const ms = Math.round(performance.now() - started);
const data = await res.json();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`);
  process.exit(1);
}
if (process.argv.includes("--raw")) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const { urgent, team, severity } = data.answers;
const f = (n) => Number(n).toFixed(2);
const others = Object.entries(team.probabilities)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${f(v)}`)
  .join(", ");
const [topIdx, topP] = Object.entries(severity.probabilities).sort((a, b) => b[1] - a[1])[0];
console.log(`model     ${data.model}`);
console.log(`urgent    yes ${f(urgent.noul)}`);
console.log(
  `team      ${team.choice} ${f(team.probabilities[team.choice])}   confidence ${f(team.confidence)}   (${others})`,
);
console.log(`severity  ${levels[Number(topIdx)]} ${f(topP)}   position ${f(severity.score)} on 0 to 3`);
console.log(
  `cost      $${Number(data.usage.cost).toFixed(7)} for ${data.usage.input_tokens} input tokens (output is free)`,
);
console.log(`time      ${ms} ms`);
