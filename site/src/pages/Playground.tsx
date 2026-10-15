import { useState } from "react";
import {
  modelsConfig,
  findDecider,
  toDecisionsBody,
  validateQuestion,
  meanProbabilityShift,
  type DecisionRequest,
  type DecisionResult,
  type Question,
  type QuestionType,
} from "@decision-models-lab/core";
import { ProbBars } from "../components/ProbBars.tsx";
import { useLab } from "../lib/mode.tsx";
import { useTriageFile } from "../lib/useTriage.ts";
import { deciderForMode, freeMock } from "../lib/live.ts";
import { ticketById } from "../lib/data.ts";
import { ms, p2, usd } from "../lib/format.ts";

interface Draft {
  id: string;
  type: QuestionType;
  instructions: string;
  /** One option per line. choice: "id: description". score: levels, lowest first. noul: "true: ..." and "false: ...". */
  options: string;
  /** Alternative wordings for the Reword button, one per line. */
  rewordings: string;
}

const START: Draft[] = [
  {
    id: "urgent",
    type: "noul",
    instructions: "Does this need someone right now?",
    options: "true: Customers are blocked or data is at risk\nfalse: It can wait for normal hours",
    rewordings: "Should someone be paged for this now?\nIs this an emergency?",
  },
  {
    id: "team",
    type: "choice",
    instructions: "Which team should own this?",
    options: "payments: Checkout and billing\nauth: Login and access\ninfra: Servers, network and outages",
    rewordings: "Who should fix this?\nRoute this ticket to the right team.",
  },
  {
    id: "severity",
    type: "score",
    instructions: "How severe is the impact?",
    options: "Cosmetic\nMinor\nMajor\nCritical",
    rewordings: "How bad is this for the customer?\nRate the business impact.",
  },
];

function toQuestion(d: Draft): Question {
  const lines = d.options
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (d.type === "score") return { type: "score", instructions: d.instructions, criteria: lines };
  const pairs = Object.fromEntries(
    lines.map((l) => {
      const i = l.indexOf(":");
      return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, l];
    }),
  );
  if (d.type === "noul")
    return {
      type: "noul",
      instructions: d.instructions,
      criteria: { true: pairs.true ?? "", false: pairs.false ?? "" },
    };
  return { type: "choice", instructions: d.instructions, criteria: pairs };
}

function Output({ r, title }: { r: DecisionResult; title: string }) {
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>
        {title} {r.mock && <span className="badge mock">Mock</span>}
      </h3>
      {Object.entries(r.answers).map(([id, a]) => (
        <div key={id}>
          <p className="small" style={{ margin: "8px 0 4px" }}>
            <strong>{id}</strong> <span className="muted">({a.type})</span>{" "}
            <span className="num">confidence {p2(a.confidence)}</span>
          </p>
          <ProbBars answer={a} label={`${id} probabilities`} />
        </div>
      ))}
      <p className="small num">
        {ms(r.latencyMs)} | tokens in {r.usage.inputTokens}, out {r.usage.outputTokens} |{" "}
        {usd(r.usage.costUsd)}
      </p>
      <details>
        <summary>Raw JSON</summary>
        <pre tabIndex={0}>
          <code>{JSON.stringify(r.raw, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}

function ReplayPlayground() {
  const file = useTriageFile();
  const [id, setId] = useState(file?.records[0]?.ticketId ?? "");
  const rec = file?.records.find((r) => r.ticketId === id);
  if (!file) return <p>No recorded triage run yet.</p>;
  return (
    <>
      <p>
        Replay mode plays recorded runs only, so here you can browse what {file.decider.label} answered for
        each recorded ticket. Switch to Live (your own key) or Mock to run your own questions.
      </p>
      <div className="row">
        <label htmlFor="pg-ticket">Recorded ticket</label>
        <select id="pg-ticket" value={id} onChange={(e) => setId(e.target.value)}>
          {file.records.map((r) => (
            <option key={r.ticketId} value={r.ticketId}>
              {r.ticketId}: {ticketById.get(r.ticketId)?.subject}
            </option>
          ))}
        </select>
      </div>
      {rec && (
        <>
          <pre tabIndex={0}>
            <code>{ticketById.get(rec.ticketId)?.body}</code>
          </pre>
          <Output r={rec.decision} title={file.decider.label} />
        </>
      )}
    </>
  );
}

export function Playground() {
  const { mode, keys } = useLab();
  const [modelKey, setModelKey] = useState("jev");
  const [compareKey, setCompareKey] = useState("decision-1");
  const [context, setContext] = useState(ticketById.get("T-016")?.body ?? "");
  const [drafts, setDrafts] = useState<Draft[]>(START);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ title: string; r: DecisionResult }[]>([]);
  const [reword, setReword] = useState<{ id: string; wording: string; top: string; shift: number }[]>([]);

  if (mode === "replay") {
    return (
      <article>
        <h1>Playground</h1>
        <ReplayPlayground />
      </article>
    );
  }

  const request = (ds = drafts): DecisionRequest => ({
    context: context
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean),
    questions: Object.fromEntries(ds.map((d) => [d.id, toQuestion(d)])),
  });

  function check(): string {
    if (!context.trim()) return "Add some context first.";
    if (!drafts.length) return "Add at least one question.";
    const ids = new Set<string>();
    for (const d of drafts) {
      if (!/^[a-z][a-z0-9_]*$/.test(d.id))
        return `Question id "${d.id}" must be lowercase letters, digits and underscores.`;
      if (ids.has(d.id)) return `Two questions share the id "${d.id}".`;
      ids.add(d.id);
      const errs = validateQuestion(d.id, toQuestion(d));
      if (errs.length) return errs[0];
    }
    if (mode === "live") {
      const needs = [modelKey].map((k) => findDecider(k).provider);
      if (needs.includes("openrouter") && !keys.openrouter)
        return "Paste your OpenRouter key at the top of the page first.";
      if (needs.includes("anthropic") && !keys.anthropic)
        return "Paste your Anthropic key at the top of the page to use Claude.";
    }
    return "";
  }

  const model = (k: string) =>
    mode === "mock" ? freeMock(findDecider(k).id) : deciderForMode(k, mode, keys);

  async function go(fn: () => Promise<void>) {
    const e = check();
    setError(e);
    if (e) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const run = () =>
    go(async () => {
      setReword([]);
      const r = await model(modelKey).decide(request());
      setResults([{ title: findDecider(modelKey).label, r }]);
    });

  const compare = () =>
    go(async () => {
      setReword([]);
      if (mode === "live" && findDecider(compareKey).provider === "anthropic" && !keys.anthropic)
        throw new Error("Paste your Anthropic key at the top of the page to compare with Claude.");
      if (mode === "live" && findDecider(compareKey).provider === "openrouter" && !keys.openrouter)
        throw new Error("Paste your OpenRouter key at the top of the page first.");
      const [a, b] = await Promise.all([
        model(modelKey).decide(request()),
        model(compareKey).decide(request()),
      ]);
      setResults([
        { title: findDecider(modelKey).label, r: a },
        { title: findDecider(compareKey).label, r: b },
      ]);
    });

  const rewordAll = () =>
    go(async () => {
      const m = model(modelKey);
      const base = await m.decide(request());
      setResults([{ title: findDecider(modelKey).label, r: base }]);
      const rows: typeof reword = [];
      for (const d of drafts) {
        for (const w of d.rewordings
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)) {
          const alt = await m.decide(
            request(drafts.map((x) => (x.id === d.id ? { ...x, instructions: w } : x))),
          );
          const a0 = base.answers[d.id];
          const a1 = alt.answers[d.id];
          rows.push({
            id: d.id,
            wording: w,
            top: a1.top,
            shift: meanProbabilityShift([[a0.probabilities, a1.probabilities]]),
          });
        }
      }
      setReword(rows);
    });

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts(drafts.map((d, j) => (i === j ? { ...d, ...patch } : d)));
  const deciders = modelsConfig.deciders;

  return (
    <article>
      <h1>Playground</h1>
      <p>
        Write a context and a few questions, then run them.{" "}
        {mode === "mock" &&
          "In Mock mode the answers are made up, so use it to learn the shapes, not the numbers."}
        {mode === "live" &&
          " Each run is one call with your key; a decision call costs a fraction of a cent."}
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        <label htmlFor="pg-model">Model</label>
        <select id="pg-model" value={modelKey} onChange={(e) => setModelKey(e.target.value)}>
          {deciders.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <label htmlFor="pg-compare">Compare with</label>
        <select id="pg-compare" value={compareKey} onChange={(e) => setCompareKey(e.target.value)}>
          {deciders.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <label htmlFor="pg-context">Context (blank lines split it into separate state items)</label>
      <textarea id="pg-context" rows={5} value={context} onChange={(e) => setContext(e.target.value)} />

      <h2>Questions</h2>
      {drafts.map((d, i) => (
        <fieldset key={i} className="panel" style={{ margin: "0 0 12px" }}>
          <legend className="small">
            <strong>Question {i + 1}</strong>
          </legend>
          <div className="row">
            <label htmlFor={`q-id-${i}`}>Id</label>
            <input
              id={`q-id-${i}`}
              value={d.id}
              onChange={(e) => update(i, { id: e.target.value })}
              style={{ width: 140 }}
            />
            <label htmlFor={`q-type-${i}`}>Type</label>
            <select
              id={`q-type-${i}`}
              value={d.type}
              onChange={(e) => update(i, { type: e.target.value as QuestionType })}
            >
              <option value="noul">noul (yes or no)</option>
              <option value="choice">choice (pick one)</option>
              <option value="score">score (ordered scale)</option>
            </select>
            <button className="secondary" onClick={() => setDrafts(drafts.filter((_, j) => j !== i))}>
              Remove question
            </button>
          </div>
          <div style={{ marginTop: 8 }}>
            <label htmlFor={`q-ins-${i}`}>Instructions</label>
            <input
              id={`q-ins-${i}`}
              value={d.instructions}
              onChange={(e) => update(i, { instructions: e.target.value })}
              style={{ width: "100%" }}
            />
          </div>
          <div className="grid2" style={{ marginTop: 8, gap: 12 }}>
            <div>
              <label htmlFor={`q-opt-${i}`}>
                {d.type === "score"
                  ? "Levels, lowest first, one per line"
                  : d.type === "noul"
                    ? 'Criteria: "true: ..." and "false: ..."'
                    : 'Options, one per line as "id: description"'}
              </label>
              <textarea
                id={`q-opt-${i}`}
                rows={4}
                value={d.options}
                onChange={(e) => update(i, { options: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`q-rw-${i}`}>Rewordings for the Reword button, one per line</label>
              <textarea
                id={`q-rw-${i}`}
                rows={4}
                value={d.rewordings}
                onChange={(e) => update(i, { rewordings: e.target.value })}
              />
            </div>
          </div>
        </fieldset>
      ))}
      <div className="row">
        <button
          className="secondary"
          onClick={() =>
            setDrafts([
              ...drafts,
              {
                id: `q${drafts.length + 1}`,
                type: "noul",
                instructions: "",
                options: "true: \nfalse: ",
                rewordings: "",
              },
            ])
          }
        >
          Add a question
        </button>
      </div>

      <div className="row" style={{ margin: "24px 0" }}>
        <button onClick={run} disabled={busy}>
          Run
        </button>
        <button className="secondary" onClick={compare} disabled={busy}>
          Compare the two models
        </button>
        <button className="secondary" onClick={rewordAll} disabled={busy}>
          Reword and run
        </button>
        {busy && <span className="small">Waiting for the model.</span>}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="grid2">
          {results.map((x) => (
            <Output key={x.title} r={x.r} title={x.title} />
          ))}
        </div>
      )}

      {reword.length > 0 && (
        <>
          <h2>Wording sensitivity</h2>
          <p>
            Each row reruns one question with a different wording and compares it with the original. Shift is
            the share of probability that moved (0 means identical, 1 means completely different).
          </p>
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Wording</th>
                <th>Top answer</th>
                <th className="num">Shift</th>
              </tr>
            </thead>
            <tbody>
              {reword.map((r, i) => {
                const orig = results[0]?.r.answers[r.id]?.top;
                return (
                  <tr key={i}>
                    <td>{r.id}</td>
                    <td>{r.wording}</td>
                    <td className={r.top !== orig ? "error" : ""}>
                      {r.top}
                      {r.top !== orig ? ` (was ${orig})` : ""}
                    </td>
                    <td className="num">{r.shift.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      <details style={{ marginTop: 24 }}>
        <summary>The request body this page sends</summary>
        <pre tabIndex={0}>
          <code>{JSON.stringify(toDecisionsBody(findDecider(modelKey).id, request()), null, 2)}</code>
        </pre>
      </details>
    </article>
  );
}
