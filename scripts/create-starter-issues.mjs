/**
 * Creates the ten starter issues on GitHub, labelled "good first issue", using the GitHub CLI (gh).
 * Safe to run twice: an issue whose title already exists is skipped.
 *
 *   gh auth login                 (once)
 *   node scripts/create-starter-issues.mjs          shows what it would create
 *   node scripts/create-starter-issues.mjs --yes    creates them
 */
import { execFileSync } from "node:child_process";

const REPO = "shashikantdev3/decision-models-lab";
const gh = (args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const issues = [
  {
    title: "Add a confusion-matrix chart for team",
    labels: ["good first issue", "site"],
    body: `The Results page shows team accuracy but not which teams get mixed up.

**Do**
- Add a pure function \`confusionMatrix(pred, truth, labels)\` in \`packages/core/src/metrics/basic.ts\` with a unit test.
- Draw it on \`site/src/pages/Results.tsx\` for each model: rows are true teams, columns predicted, cells show counts.
- Use the existing tokens in \`site/src/styles/tokens.css\`; no new colours.

**Done when** the chart shows the recorded run, works in both themes, and \`npm run check\` passes.`,
  },
  {
    title: "Export a run as CSV",
    labels: ["good first issue", "site"],
    body: `Let visitors download the recorded triage run as CSV from the Triage Desk.

**Do**
- One row per ticket: id, subject, decided team and probability, urgency, route, Claude's team, verification passed, cost, time.
- A button on \`site/src/pages/TriageDesk.tsx\` labelled "Download as CSV".

**Done when** the file opens cleanly in Excel and Google Sheets and \`npm run check\` passes.`,
  },
  {
    title: "Keyboard shortcuts on the Triage Desk",
    labels: ["good first issue", "site", "accessibility"],
    body: `Make the desk usable without a mouse.

**Do**
- \`j\` / \`k\` move between strips, \`Enter\` opens the detail, \`[\` / \`]\` move the threshold by 0.01.
- Show the shortcuts in a short line under the board.
- Do not trigger while typing in an input.

**Done when** the Playwright smoke test still passes and the shortcuts are documented on the page.`,
  },
  {
    title: "Clear error panel for rate limits in Live mode",
    labels: ["good first issue", "site"],
    body: `When OpenRouter or Anthropic returns 429, Live mode shows a one-line error. Make it a clear panel.

**Do**
- Detect \`ProviderError\` with status 429 in the Playground and Triage Desk.
- Say what happened and what to do ("Wait a minute or lower the batch size"), with a "Try again" button.
- Retry with backoff using the same approach as \`packages/cli/src/shared.ts\` \`withRetry\`.

**Done when** a unit test covers the retry and \`npm run check\` passes.`,
  },
  {
    title: "Cost-of-mistakes threshold picker",
    labels: ["good first issue", "core", "site"],
    body: `Choosing a threshold should come from costs, not round numbers.

**Do**
- Inputs: cost of a wrong auto-route, cost of one escalation to Claude.
- A pure function in \`packages/core/src/policy/\` that scans the recorded coverage curve and returns the threshold with the lowest total cost, with a unit test.
- Show the suggestion next to the slider on the Triage Desk.

**Done when** the suggestion changes sensibly as the costs change and \`npm run check\` passes.`,
  },
  {
    title: "Add an HR requests dataset",
    labels: ["good first issue", "dataset"],
    body: `A second domain shows whether the lessons transfer.

**Do**
- 30 to 50 fictional HR requests (leave, payroll, onboarding, policy questions) in the same JSONL shape as \`data/tickets.jsonl\`.
- A question set and a dataset card like \`data/README.md\`.
- Use \`npm run data:plan\`, \`data:draft\` and \`data:crosscheck\` if you have a key; otherwise write and label them by hand and say so in the card.

**Rules** fictional people only, \`@example.com\` emails, no real company data.`,
  },
  {
    title: "Add a Hindi ticket set and compare",
    labels: ["good first issue", "dataset"],
    body: `How do the models handle Hindi and Hinglish?

**Do**
- Translate 20 tickets from \`data/tickets.jsonl\` into Hindi or natural Hinglish, keeping the labels.
- Run \`npm run bench -- --dataset data/tickets.hi.jsonl\` and add a short write-up of the differences.

**Done when** the dataset validates (\`npm run data:validate\`) and results are recorded with their date.`,
  },
  {
    title: "Adapter for Jev box questions with an image example",
    labels: ["good first issue", "core"],
    body: `Jev 1.14 can locate things in images with \`box\` questions. The lab is text-only today.

**Do**
- Extend \`QuestionType\` with \`box\` and map the answer in \`packages/core/src/adapters/normalize.ts\`.
- Add one image example under \`examples/\` (a fictional screenshot) and a live fixture.
- Note in the docs that box questions run in Jev's slower long-context mode and are not supported by Decision-1.`,
  },
  {
    title: "TypeSafe SDK adapter (System One API)",
    labels: ["good first issue", "core"],
    body: `TypeSafe also exposes the model through its own SDK and the System One endpoint.

**Do**
- Add an adapter that uses \`@typesafe-ai/sdk\` and implements \`DecisionModel\`.
- Add a config entry and compare it with the Decisions API on the Hello World request: same answers? same latency?

**Done when** a recorded comparison is in \`results/\` and the adapter has a fixture test.`,
  },
  {
    title: "Translate the Learn page",
    labels: ["good first issue", "docs"],
    body: `Make the Learn page available in another language (Hindi first).

**Do**
- Move the page's text into a small dictionary file and add a language switch.
- Keep the plain style: short sentences, no marketing words.

**Done when** both languages render and the accessibility smoke test still passes.`,
  },
];

const yes = process.argv.includes("--yes");
try {
  gh(["--version"]);
} catch {
  console.error(
    "The GitHub CLI (gh) is not installed. Get it from https://cli.github.com and run gh auth login.",
  );
  process.exit(1);
}

const existing = new Set(
  JSON.parse(gh(["issue", "list", "-R", REPO, "--state", "all", "--limit", "200", "--json", "title"])).map(
    (i) => i.title,
  ),
);
const labels = [...new Set(issues.flatMap((i) => i.labels))];
for (const issue of issues) {
  if (existing.has(issue.title)) {
    console.log(`skip    ${issue.title} (already exists)`);
    continue;
  }
  if (!yes) {
    console.log(`would create  ${issue.title}  [${issue.labels.join(", ")}]`);
    continue;
  }
  for (const l of issue.labels) {
    try {
      gh(["label", "create", l, "-R", REPO, "--force"]);
    } catch {
      /* label exists */
    }
  }
  const url = gh([
    "issue",
    "create",
    "-R",
    REPO,
    "--title",
    issue.title,
    "--body",
    issue.body,
    ...issue.labels.flatMap((l) => ["--label", l]),
  ]).trim();
  console.log(`created ${url}`);
}
if (!yes)
  console.log(`\nNothing created. Run again with --yes to create these. Labels used: ${labels.join(", ")}.`);
