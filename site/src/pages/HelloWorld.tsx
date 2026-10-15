import { useState } from "react";
import { OpenRouterDecisions } from "@decision-models-lab/core";
import { Code, Tabs } from "../components/Code.tsx";
import { useLab, keysFromEnv } from "../lib/mode.tsx";
import ps1 from "../../../examples/hello-world/hello.ps1?raw";
import curlSh from "../../../examples/hello-world/curl.sh?raw";
import pySrc from "../../../examples/hello-world/hello.py?raw";
import mjsSrc from "../../../examples/hello-world/hello.mjs?raw";
import s from "./HelloWorld.module.css";

interface Capture {
  _source: string;
  latencyMs: number;
  request: { model: string; state: string[]; questions: Record<string, unknown> };
  response: {
    model: string;
    answers: {
      urgent: { noul: number };
      team: { choice: string; confidence: number; probabilities: Record<string, number> };
      severity: { score: number; confidence: number; probabilities: Record<string, number> };
    };
    usage: { input_tokens: number; output_tokens: number; cost: number };
  };
}

// The real first calls, saved by `npm run hello -- --save-fixture`.
const captures = import.meta.glob("../../../packages/core/test/fixtures/live.*.json", {
  eager: true,
  import: "default",
}) as Record<string, Capture>;
const capture = (key: string) => Object.entries(captures).find(([p]) => p.includes(`live.${key}.`))?.[1];
const JEV = capture("jev");
const D1 = capture("decision-1");

const MODELS = [
  { key: "jev", id: "typesafe/jev-1.14", label: "TypeSafe Jev 1.14" },
  { key: "decision-1", id: "microsoft/microsoft-decision-1-20261009", label: "Microsoft Decision-1" },
];
const LEVELS = ["Cosmetic", "Minor", "Major", "Critical"];
const REPO = "https://github.com/shashikantdev3/decision-models-lab";
const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);

/** The same readable summary the scripts print. */
function summary(r: Capture["response"], latency: number): string {
  const f = (n: number) => n.toFixed(2);
  const { urgent, team, severity } = r.answers;
  const others = Object.entries(team.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${f(v)}`)
    .join(", ");
  const [idx, p] = Object.entries(severity.probabilities).sort((a, b) => b[1] - a[1])[0];
  return [
    `model     ${r.model}`,
    `urgent    yes ${f(urgent.noul)}`,
    `team      ${team.choice} ${f(team.probabilities[team.choice])}   confidence ${f(team.confidence)}   (${others})`,
    `severity  ${LEVELS[Number(idx)]} ${f(p)}   position ${f(severity.score)} on 0 to 3`,
    `cost      $${r.usage.cost.toFixed(7)} for ${r.usage.input_tokens} input tokens (output is free)`,
    `time      ${Math.round(latency)} ms`,
  ].join("\n");
}

function Step({
  n,
  title,
  optional,
  children,
}: {
  n: number;
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={s.step}>
      <span className={s.band} aria-hidden="true">
        {n}
      </span>
      <div className={s.body}>
        <h2>
          <span className="visually-hidden">Step {n}: </span>
          {title}
          {optional && <span className={s.optional}>optional</span>}
        </h2>
        {children}
      </div>
    </li>
  );
}

function FieldGuide({ c }: { c: Capture }) {
  const a = c.response.answers;
  const rows: [string, string, React.ReactNode][] = [
    [
      "model",
      c.response.model,
      "The exact version that answered. Pin it in your code so behaviour does not change under you.",
    ],
    [
      "answers.urgent.noul",
      String(a.urgent.noul),
      <>The probability that the answer is yes. Near 0.5 means a coin flip, not "medium".</>,
    ],
    [
      "answers.team.choice",
      a.team.choice,
      "The most likely option, picked from the options you defined. It cannot invent a new one.",
    ],
    [
      "answers.team.probabilities",
      Object.entries(a.team.probabilities)
        .map(([k, v]) => `${k} ${v}`)
        .join(", "),
      "One probability per option. They add up to 1.",
    ],
    [
      "answers.team.confidence",
      String(a.team.confidence),
      "How concentrated the whole distribution is. It is not the top probability, and it means different things on different models.",
    ],
    [
      "answers.severity.score",
      String(a.severity.score),
      "A position on your scale, weighted by probability. 0 is Cosmetic, 3 is Critical.",
    ],
    [
      "answers.severity.probabilities",
      Object.entries(a.severity.probabilities)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", "),
      <>Keyed by position in your list, so "3" means Critical. The legend repeats your labels.</>,
    ],
    [
      "usage",
      `${c.response.usage.input_tokens} in, ${c.response.usage.output_tokens} out, $${c.response.usage.cost}`,
      "You pay for input tokens only. Output tokens are free.",
    ],
  ];
  return (
    <ul className={s.fields}>
      {rows.map(([path, value, meaning]) => (
        <li key={path}>
          <span className={s.path}>{path}</span>
          <span className={s.value}>{value}</span> {meaning}
        </li>
      ))}
    </ul>
  );
}

function RunHere() {
  const { mode, setMode, keys } = useLab();
  const [model, setModel] = useState("jev");
  const [out, setOut] = useState<{ text: string; raw: unknown; note: string } | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const m = MODELS.find((x) => x.key === model)!;
  // A key from .env (local dev) or pasted in Live mode makes this a real call.
  const live = !!keys.openrouter;

  async function send() {
    setError("");
    if (!live) {
      const c = capture(model);
      if (c)
        setOut({
          text: summary(c.response, c.latencyMs),
          raw: c.response,
          note: `Recorded answer, ${c._source.replace("Live capture from ", "")}`,
        });
      return;
    }
    setBusy(true);
    try {
      const body = { ...(JEV ?? D1)!.request, model: m.id };
      const r = await new OpenRouterDecisions({ apiKey: keys.openrouter, modelId: m.id }).decide({
        context: body.state,
        questions: body.questions as never,
      });
      const raw = r.raw as Capture["response"];
      setOut({ text: summary(raw, r.latencyMs), raw, note: `Live answer from your key, just now` });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <label htmlFor="hw-model">Model</label>
        <select id="hw-model" value={model} onChange={(e) => setModel(e.target.value)}>
          {MODELS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
        <button onClick={send} disabled={busy}>
          {live ? "Send the request" : "Show the recorded answer"}
        </button>
        {!live && (
          <button className="secondary" onClick={() => setMode("live")}>
            {mode === "live" ? "Paste your OpenRouter key at the top" : "Use my own key"}
          </button>
        )}
        {busy && <span className="small">Waiting for {m.label}.</span>}
      </div>
      <p className="small muted">
        {live
          ? `This sends one request from your browser straight to openrouter.ai with ${keysFromEnv() ? "the key from your .env" : "your key"}. About $0.00002.`
          : "Without a key, this shows the answer recorded from the real API. With your key, the same button sends a live request from your browser; the key never leaves this tab except to openrouter.ai."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {out && (
        <div aria-live="polite">
          <p className="small" style={{ marginBottom: 4 }}>
            <strong>{out.note}</strong>
          </p>
          <pre className={s.output} tabIndex={0}>
            {out.text}
          </pre>
          <details>
            <summary>Raw JSON</summary>
            <pre tabIndex={0}>
              <code>{JSON.stringify(out.raw, null, 2)}</code>
            </pre>
          </details>
        </div>
      )}
    </>
  );
}

const GOOD_FIRST = `${REPO}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`;
const blob = (path: string) => `${REPO}/blob/main/${path}`;

export function HelloWorld() {
  const request = JEV?.request;
  const cmd = (lines: string[]) => lines.join("\n");
  const liveOutput =
    JEV && D1
      ? [
          "Ticket:   Checkout returns HTTP 500 for all users since 10:05.",
          "Asking:   urgent (yes/no), team (payments, auth, infra), severity (Cosmetic to Critical)",
          "",
          "TypeSafe Jev 1.14",
          summary(JEV.response, JEV.latencyMs),
          "",
          "Microsoft Decision-1",
          summary(D1.response, D1.latencyMs),
          "",
          "Next: `npm run dev` opens the site on http://localhost:5173. To pick something to build, see CONTRIBUTING.md.",
        ].join("\n")
      : undefined;
  return (
    <article>
      <section className={s.intro}>
        <h1>Hello World</h1>
        <p>
          Clone the lab, add an OpenRouter key, and run it. In about five minutes you will have sent a real
          ticket with three typed questions to both decision models, read every field of the answer, and have
          the whole lab running on your machine, ready to change.
        </p>
        <dl className={s.facts}>
          <div>
            <dt>You need</dt>
            <dd>git, Node.js 20+, $5 of credit</dd>
          </div>
          <div>
            <dt>One Hello World run</dt>
            <dd>about $0.00003</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>about 5 minutes</dd>
          </div>
        </dl>
        <p className="small" style={{ marginTop: 12 }}>
          Not ready to add credit? <a href="#offline">Run it offline first</a>; it replays real recorded
          answers.
        </p>
      </section>

      <ol className={s.steps}>
        <Step n={1} title="Get an OpenRouter key with credit">
          <ol>
            <li>
              Sign up at <a href="https://openrouter.ai">openrouter.ai</a>.
            </li>
            <li>
              Add credit on{" "}
              <a href="https://openrouter.ai/settings/credits">openrouter.ai/settings/credits</a>. $5 is more
              than enough: a Hello World run costs about $0.00003, and the full benchmark in this repo cost
              under $0.40.
            </li>
            <li>
              Create a key on <a href="https://openrouter.ai/settings/keys">openrouter.ai/settings/keys</a>{" "}
              and give it a credit limit, for example $2, so a bug can never spend more.
            </li>
          </ol>
          <p className="small">
            One key covers both Jev and Decision-1. A Claude key from Anthropic is only needed later, for the
            parts of the lab that use Claude.
          </p>
        </Step>

        <Step n={2} title="Clone and install">
          <Code label="Clone and install">
            {cmd([`git clone ${REPO}.git`, "cd decision-models-lab", "npm install"])}
          </Code>
          <p className="small">
            Check your Node.js version with <code>node -v</code>; it needs to be 20.12 or newer.
          </p>
        </Step>

        <Step n={3} title="Paste the key into .env">
          <Tabs
            label="Your terminal"
            initial={isWindows ? "ps" : "sh"}
            tabs={[
              {
                id: "ps",
                label: "Windows PowerShell",
                content: (
                  <Code label="Create .env in PowerShell">
                    {cmd(["Copy-Item .env.example .env", "notepad .env"])}
                  </Code>
                ),
              },
              {
                id: "sh",
                label: "macOS, Linux, Git Bash",
                content: (
                  <Code label="Create .env in bash">{cmd(["cp .env.example .env", "nano .env"])}</Code>
                ),
              },
            ]}
          />
          <p>Set this line and save:</p>
          <Code label=".env line">{"OPENROUTER_API_KEY=sk-or-v1-your-key-here"}</Code>
          <p className="small">
            Git ignores <code>.env</code>, so the key never ends up in a commit. Leave{" "}
            <code>ANTHROPIC_API_KEY</code> empty for now.
          </p>
        </Step>

        <Step n={4} title="Run Hello World">
          <Code label="Run Hello World">{"npm run hello"}</Code>
          <p>
            One real request to each model. You will see something like this; it is what the two models
            answered on their first real call for this lab. Your numbers will differ a little.
          </p>
          {liveOutput && (
            <pre className={s.output} tabIndex={0} aria-label="Expected output">
              {liveOutput}
            </pre>
          )}
          <p className="small">
            <code>No OpenRouter key found</code> means <code>.env</code> is missing or the line is empty.{" "}
            <code>OpenRouter rejected this key</code> means the key is wrong. <code>out of credit</code> means
            the account or the key's limit needs topping up.
          </p>
        </Step>

        {JEV && (
          <Step n={5} title="Read the answer">
            <p>
              The six lines are a summary. Run <code>npm run hello -- --verbose</code> to see the JSON each
              model actually sent back. Here is Jev's, field by field:
            </p>
            <div className={s.guide}>
              <pre tabIndex={0} aria-label="Raw response from Jev">
                <code>{JSON.stringify(JEV.response, null, 2)}</code>
              </pre>
              <FieldGuide c={JEV} />
            </div>
            {D1 && (
              <p style={{ marginTop: 16 }}>
                Compare the two: both say urgent, payments and Critical, but Decision-1 gives infra 0.38 and
                reports a team confidence of {D1.response.answers.team.confidence.toFixed(2)} against Jev's{" "}
                {JEV.response.answers.team.confidence.toFixed(2)}. Jev counted{" "}
                {JEV.response.usage.input_tokens} input tokens for the same text, Decision-1{" "}
                {D1.response.usage.input_tokens}. Same price per token, so Jev cost more.
              </p>
            )}
          </Step>
        )}

        <Step n={6} title="Make it yours">
          <p>
            Open <a href={blob("packages/cli/src/hello.ts")}>packages/cli/src/hello.ts</a>. The request is
            built from a ticket and three questions. Change the ticket text, add an option to{" "}
            <code>team</code>, or add a fourth question, then run <code>npm run hello</code> again and watch
            the probabilities move. One model at a time: <code>npm run hello -- --model decision-1</code>.
          </p>
        </Step>

        <Step n={7} title="Open the whole lab">
          <Code label="Start the site">{"npm run dev"}</Code>
          <p>
            This opens the site on <code>http://localhost:5173</code> and picks up the key from your{" "}
            <code>.env</code> automatically, so Live mode works straight away: the Playground, this page's run
            button, and the Triage Desk (the Desk also needs <code>ANTHROPIC_API_KEY</code>, because escalated
            tickets go to Claude). The published site never contains your key; only the local dev server reads{" "}
            <code>.env</code>.
          </p>
        </Step>

        <Step n={8} title="Pick something to build">
          <div className={s.next} style={{ marginTop: 0 }}>
            <div>
              <h3>
                <a href={GOOD_FIRST}>Take a good first issue</a>
              </h3>
              <p>
                Small, well-scoped tasks: a confusion-matrix chart, CSV export, keyboard shortcuts on the
                Desk.
              </p>
            </div>
            <div>
              <h3>
                <a href={blob("docs/09-extending.md")}>Add a model</a>
              </h3>
              <p>
                One entry in <code>config/models.json</code> if it uses the same API; one adapter file if not.
              </p>
            </div>
            <div>
              <h3>
                <a href={blob("data/README.md")}>Add a dataset</a>
              </h3>
              <p>
                HR requests, IT access, content moderation, or tickets in Hindi. Same file shape, your own
                labels.
              </p>
            </div>
            <div>
              <h3>
                <a href={blob("docs/09-extending.md")}>Add a metric or chart</a>
              </h3>
              <p>A pure function with a test, then one chart on the Results page.</p>
            </div>
          </div>
          <p style={{ marginTop: 20 }}>
            Before you open a pull request, run <code>npm run check</code>.{" "}
            <a href={blob("CONTRIBUTING.md")}>CONTRIBUTING.md</a> has the rest.
          </p>
        </Step>
      </ol>

      <h2 id="offline">No credit yet? Run it offline</h2>
      <p>
        Do step 2, then run Hello World without a key. Nothing is sent and nothing is spent; the lab replays
        the answers both models gave on their first real call, and labels them as recorded.
      </p>
      <Code label="Run Hello World offline">{"npm run hello -- --mock"}</Code>
      <p>
        Everything else that works offline: <code>npm test</code>, <code>npm run triage -- --mock</code>, and{" "}
        <code>npm run dev</code> in Replay and Mock modes. When you are ready, do steps 1 and 3 and run{" "}
        <code>npm run hello</code> for real.
      </p>

      <h2>Try one call without cloning</h2>
      <p>
        Ask either model from this page. With a key it is a real call from your browser; without one it shows
        the recorded answer.
      </p>
      <div className="panel">
        <RunHere />
      </div>
      <details>
        <summary>One-file examples in PowerShell, curl, Python and Node.js (nothing to install)</summary>
        <div style={{ marginTop: 12 }}>
          <Tabs
            label="Language"
            initial={isWindows ? "ps" : "curl"}
            tabs={[
              { id: "ps", label: "PowerShell", content: <Code label="hello.ps1">{ps1}</Code> },
              { id: "curl", label: "curl", content: <Code label="curl.sh">{curlSh}</Code> },
              { id: "py", label: "Python", content: <Code label="hello.py">{pySrc}</Code> },
              { id: "node", label: "Node.js", content: <Code label="hello.mjs">{mjsSrc}</Code> },
            ]}
          />
          {request && (
            <details>
              <summary>The request every example sends</summary>
              <Code label="Request body">{JSON.stringify(request, null, 2)}</Code>
            </details>
          )}
        </div>
      </details>
    </article>
  );
}
