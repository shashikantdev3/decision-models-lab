/**
 * Step 1 of labels-by-construction: write the intended labels for every ticket before any text exists.
 * Deterministic: the same seed always gives the same plan.
 *   npm run data:plan            writes data/specs.v1.json
 */
import { writeFileSync } from "node:fs";
import { p } from "./lib.ts";
import { seeded, TEAMS, URGENCY } from "../packages/core/src/index.ts";

const COUNT = 48;
const rand = seeded("decision-models-lab/specs/v1");

interface Twist {
  text: string;
  /** Urgency levels this twist makes sense with. Missing = any. */
  urgency?: string[];
  blocked?: boolean;
}

const TWISTS: Record<"ambiguous" | "adversarial", Twist[]> = {
  ambiguous: [
    { text: "could belong to two teams; the label says which one owns the first fix" },
    { text: "urgency is vague; the customer never says how bad it is" },
    { text: "symptom points at one team, root cause sits with another" },
    { text: "mixes a question and a complaint", urgency: ["Low", "Normal", "High"] },
  ],
  adversarial: [
    {
      text: "sarcasm: sounds calm or positive but describes a real block",
      urgency: ["High", "Critical"],
      blocked: true,
    },
    { text: "urgent words in the subject, nothing urgent in the body", urgency: ["Low", "Normal"] },
    { text: "uses another team's vocabulary, but the problem belongs to the labelled team" },
    { text: "all caps and anger about something minor", urgency: ["Low", "Normal"], blocked: false },
    { text: "calm, polite and short, but describes something serious", urgency: ["High", "Critical"] },
  ],
};

function pickTwist(list: Twist[], urgency: string, blocked: boolean): string {
  const ok = list.filter(
    (t) => (!t.urgency || t.urgency.includes(urgency)) && (t.blocked === undefined || t.blocked === blocked),
  );
  return ok[Math.floor(rand() * ok.length)].text;
}

const difficulties: ("clear" | "ambiguous" | "adversarial")[] = [
  ...Array(29).fill("clear"),
  ...Array(12).fill("ambiguous"),
  ...Array(7).fill("adversarial"),
];
// Shuffle difficulty so it is not tied to team or urgency order.
for (let i = difficulties.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [difficulties[i], difficulties[j]] = [difficulties[j], difficulties[i]];
}

const channels = ["email", "chat", "form"] as const;
const specs = Array.from({ length: COUNT }, (_, i) => {
  const team = TEAMS[i % TEAMS.length];
  // 4 urgency levels and 5 teams share no factor, so cycling both gives every team every level.
  const urgency = URGENCY[i % URGENCY.length];
  const blockedChance = { Low: 0.05, Normal: 0.3, High: 0.75, Critical: 0.95 }[urgency];
  const difficulty = difficulties[i];
  const blocked = rand() < blockedChance;
  const twist = difficulty === "clear" ? undefined : pickTwist(TWISTS[difficulty], urgency, blocked);
  return {
    id: `T-${String(i + 1).padStart(3, "0")}`,
    channel: channels[Math.floor(rand() * 3)],
    labels: {
      team,
      urgency,
      customer_blocked: blocked,
      contains_personal_data: rand() < 0.35,
    },
    difficulty,
    twist,
  };
});

writeFileSync(
  p("data/specs.v1.json"),
  JSON.stringify({ version: "v1", seed: "decision-models-lab/specs/v1", specs }, null, 2) + "\n",
);
const count = (f: (s: (typeof specs)[number]) => string) =>
  specs.reduce<Record<string, number>>((m, s) => ((m[f(s)] = (m[f(s)] ?? 0) + 1), m), {});
console.log("Wrote data/specs.v1.json");
console.log(
  "team",
  count((s) => s.labels.team),
);
console.log(
  "urgency",
  count((s) => s.labels.urgency),
);
console.log(
  "difficulty",
  count((s) => s.difficulty),
);
console.log(
  "blocked",
  count((s) => String(s.labels.customer_blocked)),
);
console.log(
  "personal data",
  count((s) => String(s.labels.contains_personal_data)),
);
