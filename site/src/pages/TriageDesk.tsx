import { useEffect, useMemo, useRef, useState } from "react";
import {
  defaultPolicy,
  rerouteQueue,
  route,
  runTriage,
  findDecider,
  findWriter,
  costFromTokens,
  estimateTokens,
  buildTriageRequest,
  type EscalationPolicy,
  type TriageFile,
  type BenchFile,
} from "@decision-models-lab/core";
import { Board } from "../components/Board.tsx";
import { FullStrip } from "../components/Strip.tsx";
import { ProbBars } from "../components/ProbBars.tsx";
import { Confirm } from "../components/Confirm.tsx";
import { DataNotice, LabelNotice, Loading } from "../components/Notices.tsx";
import { useLab, usePrefersReducedMotion } from "../lib/mode.tsx";
import { useTriageFile } from "../lib/useTriage.ts";
import { baysFor, stripFrom } from "../lib/strips.ts";
import { questions, ticketById, tickets } from "../lib/data.ts";
import { deciderForMode, writerForMode } from "../lib/live.ts";
import { ms, p2, pct, usd } from "../lib/format.ts";
import s from "./TriageDesk.module.css";

const LIVE_CAP = 20;

function Detail({ file, id, policy }: { file: TriageFile; id: string; policy: EscalationPolicy }) {
  const rec = file.records.find((r) => r.ticketId === id);
  const t = ticketById.get(id);
  if (!rec || !t) return null;
  const r = route(rec.decision, policy);
  const strip = stripFrom(rec, policy);
  const final = r.action === "escalate" && rec.draft ? rec.draft.labels : undefined;
  return (
    <section className={s.detail} aria-labelledby="detail-title">
      <h2 id="detail-title">
        {t.id}: {t.subject}
      </h2>
      <FullStrip d={strip} selected />
      <p style={{ marginTop: 16 }}>
        <span className="muted small">{t.channel}</span>
        <br />
        {t.body}
      </p>
      <div className="grid2">
        <div>
          <h3>Decision ({file.decider.label})</h3>
          {Object.entries(rec.decision.answers).map(([qid, a]) => (
            <div key={qid}>
              <p className="small" style={{ margin: "8px 0 4px" }}>
                <strong>{qid}</strong>
              </p>
              <ProbBars answer={a} label={qid} />
            </div>
          ))}
          <p className="small">
            <strong>{r.action === "auto" ? "Routed automatically." : "Escalated to Claude:"}</strong>{" "}
            {r.reasons.join("; ")}
          </p>
        </div>
        <div>
          <h3>Claude ({file.writer.label})</h3>
          {rec.draft ? (
            <>
              {r.action === "auto" && (
                <p className="small muted">
                  This ticket is routed automatically at the current threshold. Claude's draft is shown
                  because the run asked Claude about every ticket.
                </p>
              )}
              <p className={s.pencil}>{rec.draft.reason}</p>
              <p className="small">
                <strong>Labels:</strong> {rec.draft.labels.team}, {rec.draft.labels.urgency}, blocked{" "}
                {String(rec.draft.labels.customer_blocked)}, personal data{" "}
                {String(rec.draft.labels.contains_personal_data)}
              </p>
              <h3>Draft reply</h3>
              <p className={s.reply}>{rec.draft.reply}</p>
              <p className="small num">
                {ms(rec.draft.latencyMs)} | tokens in {rec.draft.usage.inputTokens}, out{" "}
                {rec.draft.usage.outputTokens} | {usd(rec.draft.usage.costUsd)}
              </p>
              {rec.verification && (
                <>
                  <h3>Verification by {file.decider.label}</h3>
                  {rec.verification.outcome.passed ? (
                    <p>All checks passed.</p>
                  ) : (
                    <ul className="error">
                      {rec.verification.outcome.failures.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  )}
                  <p className="small num">
                    answers {p2(Number(rec.verification.result.answers.reply_answers_the_question?.value))} |
                    leaks {p2(Number(rec.verification.result.answers.reply_leaks_personal_data?.value))} |
                    promises{" "}
                    {p2(Number(rec.verification.result.answers.reply_promises_something_unapproved?.value))} |
                    tone {rec.verification.result.answers.reply_tone?.top}
                  </p>
                </>
              )}
            </>
          ) : (
            <p className="muted">Claude did not see this ticket in the recorded run.</p>
          )}
          <h3>Dataset label</h3>
          <p className="small">
            {t.labels.team}, {t.labels.urgency}, blocked {String(t.labels.customer_blocked)}, personal data{" "}
            {String(t.labels.contains_personal_data)} ({t.difficulty}).{" "}
            {final
              ? final.team === t.labels.team
                ? "Claude's team matches."
                : "Claude's team differs."
              : rec.decision.answers.team?.top === t.labels.team
                ? "The decision model's team matches."
                : "The decision model's team differs."}
          </p>
          <p className="small muted">{t.notes}</p>
        </div>
      </div>
    </section>
  );
}

function Race({ benches }: { benches: BenchFile[] }) {
  const reduced = usePrefersReducedMotion();
  const lanes = useMemo(
    () =>
      ["jev", "decision-1", "claude-haiku", "claude-haiku-5-5", "claude-sonnet", "claude-opus"]
        .map((k) => benches.find((b) => b.model.key === k))
        .filter((b): b is BenchFile => !!b)
        .slice(0, 3)
        .map((b) => {
          const calls = b.calls.filter((c) => c.run === 1 && !c.error).slice(0, 20);
          const total = calls.reduce((x, c) => x + c.latencyMs, 0);
          const correct = calls.filter(
            (c) => c.answers.team?.top === ticketById.get(c.ticketId)?.labels.team,
          ).length;
          return { b, calls, total, accuracy: calls.length ? correct / calls.length : NaN };
        }),
    [benches],
  );
  const [t, setT] = useState(reduced ? Infinity : 0);
  const raf = useRef<number>(0);
  const max = Math.max(...lanes.map((l) => l.total), 1);

  function start() {
    cancelAnimationFrame(raf.current);
    if (reduced) {
      setT(Infinity);
      return;
    }
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now() - t0;
      setT(now);
      if (now < max) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!lanes.length) return <p className="muted">No benchmark recorded yet, so there is no race to show.</p>;
  const colour: Record<string, string> = { jev: "var(--routed)", "decision-1": "var(--manila)" };
  return (
    <>
      <p>
        The first 20 tickets of run 1, one call after another, at the speed each call was recorded. Each tick
        on a track is one ticket.
      </p>
      <div className={s.lanes}>
        {lanes.map((l) => {
          let done = 0;
          let acc = 0;
          for (const c of l.calls) {
            if (acc + c.latencyMs <= t) {
              acc += c.latencyMs;
              done++;
            } else break;
          }
          const finished = done === l.calls.length;
          return (
            <div key={l.b.model.key} className={s.lane}>
              <span className="small">
                <strong>{l.b.model.label}</strong>
                <br />
                <span className="num">
                  {done}/{l.calls.length} tickets {finished ? `in ${ms(l.total)}` : ""}
                </span>
              </span>
              <div
                className={s.track}
                role="img"
                aria-label={`${l.b.model.label}: ${done} of ${l.calls.length} tickets`}
              >
                <div
                  className={s.progress}
                  style={{
                    width: `${(done / l.calls.length) * 100}%`,
                    background: colour[l.b.model.key] ?? "var(--escalated)",
                  }}
                />
                <div className={s.ticks} aria-hidden="true">
                  {l.calls.map((c) => (
                    <span key={c.ticketId} />
                  ))}
                </div>
                {finished && (
                  <span className={s.finish}>
                    team {pct(l.accuracy)} | {usd(l.b.metrics.cost.per1000Usd)} per 1,000
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row">
        <button onClick={start}>Replay the race</button>
        <button className="secondary" onClick={() => setT(Infinity)}>
          Show the finish
        </button>
      </div>
    </>
  );
}

export function TriageDesk() {
  const lab = useLab();
  const { mode, keys, decider, writer, data, loading } = lab;
  const recordedFile = useTriageFile();
  const [liveFile, setLiveFile] = useState<TriageFile | undefined>();
  const file = mode === "live" ? (liveFile ?? recordedFile) : recordedFile;
  const [threshold, setThreshold] = useState(defaultPolicy.teamConfidenceThreshold);
  const [critical, setCritical] = useState(defaultPolicy.criticalProbabilityThreshold);
  const [selected, setSelected] = useState<string | undefined>();
  const [view, setView] = useState<"board" | "rack">("board");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const policy: EscalationPolicy = {
    ...defaultPolicy,
    teamConfidenceThreshold: threshold,
    criticalProbabilityThreshold: critical,
  };
  const ticketMap = useMemo(() => new Map(tickets.map((t) => [t.id, t])), []);
  const writerAvg = useMemo(() => {
    const ds = file?.records.filter((r) => r.draft) ?? [];
    if (!ds.length) return { cost: 0, time: 0 };
    return {
      cost:
        ds.reduce((x, r) => x + r.draft!.usage.costUsd + (r.verification?.result.usage.costUsd ?? 0), 0) /
        ds.length,
      time:
        ds.reduce((x, r) => x + r.draft!.latencyMs + (r.verification?.result.latencyMs ?? 0), 0) / ds.length,
    };
  }, [file]);
  const stats = file
    ? rerouteQueue(file.records, ticketMap, policy, writerAvg.cost, writerAvg.time).stats
    : undefined;
  const strips = file ? file.records.map((r) => stripFrom(r, policy)) : [];

  const d = findDecider(decider);
  const w = findWriter(writer);
  const liveTickets = tickets.slice(0, LIVE_CAP);
  const avgTok =
    liveTickets.reduce((x, t) => x + estimateTokens(buildTriageRequest(t, questions)), 0) /
    liveTickets.length;
  const estimate =
    costFromTokens(d.id, LIVE_CAP * avgTok, 0) +
    LIVE_CAP * 0.5 * (costFromTokens(w.id, 900, 350) + costFromTokens(d.id, avgTok + 200, 0));

  async function runLive() {
    setConfirmOpen(false);
    setError("");
    if (!keys.openrouter) return setError("Paste your OpenRouter key at the top of the page first.");
    if (!keys.anthropic)
      return setError("Paste your Anthropic key at the top of the page; escalated tickets go to Claude.");
    setBusy(`Running ${LIVE_CAP} tickets`);
    try {
      let n = 0;
      const records = await runTriage({
        tickets: liveTickets,
        decider: deciderForMode(decider, "live", keys),
        writer: writerForMode(writer, "live", keys),
        questions,
        policy,
        concurrency: 4,
        onRecord: () => setBusy(`Running ${LIVE_CAP} tickets: ${++n} done`),
      });
      setLiveFile({
        schema: 1,
        kind: "triage",
        provenance: {
          date: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          gitCommit: "browser",
          region: "your browser",
          questionSet: questions.version,
          dataset: { version: "v1", sha256: "", count: LIVE_CAP, labelStatus: "" },
          runs: 1,
          mock: false,
        },
        decider: { key: d.key, id: d.id, label: d.label },
        writer: { key: w.key, id: w.id, label: w.label },
        policy,
        draftAll: false,
        records,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <article>
      <h1>Contoso Triage Desk</h1>
      <p>
        Tickets come in on the left. The decision model prints its calls on each strip. Confident strips drop
        into a team's bay; unsure, likely critical, or unclear personal-data strips go to Claude's desk, where
        Claude writes a note and a draft reply, and the decision model checks the draft.
      </p>
      <DataNotice what="tickets and numbers" />
      {loading && <Loading />}

      {mode === "live" && (
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            Live run: the first {LIVE_CAP} tickets through {d.label}, with escalations to {w.label} (replies
            capped at 600 tokens). Estimated cost {usd(estimate)}.
          </p>
          <div className="row">
            <button onClick={() => setConfirmOpen(true)} disabled={!!busy}>
              Run {LIVE_CAP} tickets
            </button>
            {busy && <span className="small">{busy}</span>}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Confirm
            open={confirmOpen}
            title={`Run ${LIVE_CAP} tickets?`}
            confirmLabel={`Run ${LIVE_CAP} tickets`}
            onConfirm={runLive}
            onCancel={() => setConfirmOpen(false)}
          >
            <p>
              This sends {LIVE_CAP} decision calls to OpenRouter and about half as many Claude calls to
              Anthropic, using your keys. Estimated cost {usd(estimate)}. The real cost depends on how many
              tickets are escalated.
            </p>
          </Confirm>
        </div>
      )}

      {file && stats && (
        <>
          <div className={s.controls}>
            <div className={s.slider}>
              <label htmlFor="th">
                <span>Team confidence threshold</span>
                <span className="num">{threshold.toFixed(2)}</span>
              </label>
              <input
                id="th"
                type="range"
                min={0.5}
                max={0.99}
                step={0.01}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="small muted">Below this, a ticket goes to Claude.</span>
            </div>
            <div className={s.slider}>
              <label htmlFor="crit">
                <span>Escalate when P(Critical) is above</span>
                <span className="num">{critical.toFixed(2)}</span>
              </label>
              <input
                id="crit"
                type="range"
                min={0.05}
                max={0.95}
                step={0.05}
                value={critical}
                onChange={(e) => setCritical(Number(e.target.value))}
              />
              <span className="small muted">
                Personal data between {policy.personalDataUncertainBand[0]} and{" "}
                {policy.personalDataUncertainBand[1]} also escalates.
              </span>
            </div>
          </div>

          <dl className={s.stats} aria-live="polite">
            <div className={s.stat}>
              <dt>Handled automatically</dt>
              <dd>{pct(stats.autoShare)}</dd>
            </div>
            <div className={s.stat}>
              <dt>Team accuracy, auto</dt>
              <dd>{pct(stats.autoTeamAccuracy)}</dd>
            </div>
            <div className={s.stat}>
              <dt>Escalated to Claude</dt>
              <dd>{stats.escalated}</dd>
            </div>
            <div className={s.stat}>
              <dt>Drafts flagged</dt>
              <dd>{stats.draftsFailed}</dd>
            </div>
            <div className={s.stat}>
              <dt>Total cost</dt>
              <dd>{usd(stats.costUsd)}</dd>
            </div>
            <div className={s.stat}>
              <dt>Total call time</dt>
              <dd>{ms(stats.timeMs)}</dd>
            </div>
          </dl>
          <p className="small muted">
            {file.decider.label} with {file.writer.label}, {file.records.length} tickets, recorded{" "}
            {file.provenance.date}. Total call time adds every call end to end; tickets in parallel finish
            sooner.
          </p>
          <LabelNotice />

          <div className={`row ${s.viewSwitch}`} role="group" aria-label="View">
            <button
              className={view === "board" ? "" : "secondary"}
              aria-pressed={view === "board"}
              onClick={() => setView("board")}
            >
              Board
            </button>
            <button
              className={view === "rack" ? "" : "secondary"}
              aria-pressed={view === "rack"}
              onClick={() => setView("rack")}
            >
              Full strips
            </button>
          </div>
          {view === "board" ? (
            <Board
              bays={baysFor(strips)}
              selectedId={selected}
              onSelect={setSelected}
              maxHeight={620}
              label="Triage board"
            />
          ) : (
            <div className={s.rack}>
              {strips.map((x) => (
                <FullStrip key={x.id} d={x} selected={x.id === selected} onSelect={setSelected} />
              ))}
            </div>
          )}
          {selected ? (
            <Detail file={file} id={selected} policy={policy} />
          ) : (
            <p className="small" style={{ marginTop: 12 }}>
              Select a strip to see the probabilities, Claude's reasoning, the draft reply and the checks.
            </p>
          )}
        </>
      )}

      <h2>Race</h2>
      {data ? <Race benches={data.bench} /> : <p className="muted">No benchmark recorded yet.</p>}
    </article>
  );
}
