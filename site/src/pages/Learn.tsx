import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildTriageRequest, toDecisionsBody, type Answer } from "@decision-models-lab/core";
import { ProbBars } from "../components/ProbBars.tsx";
import { Limits } from "../components/Limits.tsx";
import { DataNotice, Loading } from "../components/Notices.tsx";
import { useLab } from "../lib/mode.tsx";
import { useTriageFile } from "../lib/useTriage.ts";
import { questions, ticketById } from "../lib/data.ts";
import { ms, p2, pct, usd } from "../lib/format.ts";

function QuestionWidget({ id, answer, title }: { id: string; answer?: Answer; title: string }) {
  const q = questions.triage[id];
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p className="small">
        <code>{id}</code> asks: {q.instructions.split(/(?<=[.?])\s/)[0]}
      </p>
      {answer ? (
        <>
          <ProbBars answer={answer} label={`${id} probabilities`} />
          <p className="small num" style={{ margin: 0 }}>
            {answer.type === "noul" && <>value = P(yes) = {p2(Number(answer.value))}</>}
            {answer.type === "choice" && (
              <>
                choice = {answer.top}, confidence = {p2(answer.confidence)}
              </>
            )}
            {answer.type === "score" && (
              <>
                score = {Number(answer.value).toFixed(2)} on 0 to {(q.criteria as string[]).length - 1}, top ={" "}
                {answer.top}
              </>
            )}
          </p>
        </>
      ) : (
        <p className="muted small">No recorded answer for this ticket.</p>
      )}
    </div>
  );
}

export function Learn() {
  const { data, loading, isMockData } = useLab();
  const file = useTriageFile();
  const ids = file?.records.map((r) => r.ticketId) ?? [];
  const [picked, setPicked] = useState("T-016");
  const rec = file?.records.find((r) => r.ticketId === picked) ?? file?.records[0];
  const ticket = rec ? ticketById.get(rec.ticketId) : undefined;
  const claudeCall = useMemo(() => {
    const b = data?.bench.find((x) => x.model.kind === "llm-as-decider");
    const c = b?.calls.find((x) => x.ticketId === rec?.ticketId && !x.error);
    return b && c ? { label: b.model.label, call: c } : undefined;
  }, [data, rec]);
  const jevCurve = data?.bench.find((b) => b.model.key === file?.decider.key)?.metrics.coverage;

  return (
    <article>
      <h1>How decision models work</h1>
      <p>
        This page uses the Contoso Triage Desk to explain decision models. Everything here shows inputs,
        outputs, probabilities, speed and cost. Nothing here shows the models' internals; we do not have them.
      </p>

      <h2>The problem</h2>
      <p>
        Plenty of software needs a quick judgement: which team owns this ticket, is this urgent, does this
        text contain personal data. The usual shortcut is to ask a chat model and parse its answer. That
        works, but it is a slow and costly <code>if</code> statement: you pay for every word it writes, wait
        for it to finish, and then parse prose that may not match the options you allowed.
      </p>
      <pre>
        <code>{`// The chat-model way
const text = await chat("Which team should own this ticket? " + ticket);
const team = parseTeamSomehow(text);   // "I think this is probably payments, because..."

// The decision-model way
const { answers } = await decide({ state: [ticket], questions: { team: { type: "choice", ... } } });
answers.team.choice;           // "payments"
answers.team.probabilities;    // { payments: 0.94, auth: 0.01, infra: 0.05 }`}</code>
      </pre>

      <h2>Decision models in one picture</h2>
      <p>
        You send context plus a set of typed questions. The model returns a probability for every allowed
        answer, in one pass, and writes about two tokens. You pay for input tokens; output tokens are free.
        Below is a real request and response from the recording
        {isMockData ? " (here a mock response in the documented shape)" : ""}.
      </p>
      <DataNotice what="examples" />
      {loading && <Loading />}
      {rec && ticket && file && (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <label htmlFor="learn-ticket">Ticket</label>
            <select id="learn-ticket" value={rec.ticketId} onChange={(e) => setPicked(e.target.value)}>
              {ids.map((id) => (
                <option key={id} value={id}>
                  {id}: {ticketById.get(id)?.subject}
                </option>
              ))}
            </select>
          </div>
          <div className="grid2">
            <div>
              <h3 style={{ marginTop: 0 }}>Request to {file.decider.label}</h3>
              <pre style={{ maxHeight: 420 }} tabIndex={0}>
                <code>
                  {JSON.stringify(
                    toDecisionsBody(file.decider.id, buildTriageRequest(ticket, questions)),
                    null,
                    2,
                  )}
                </code>
              </pre>
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Response</h3>
              <pre style={{ maxHeight: 420 }} tabIndex={0}>
                <code>{JSON.stringify(rec.decision.raw, null, 2)}</code>
              </pre>
            </div>
          </div>
          <table style={{ maxWidth: 640 }}>
            <thead>
              <tr>
                <th>Same ticket, same four questions</th>
                <th className="num">output tokens</th>
                <th className="num">time</th>
                <th className="num">cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{file.decider.label}</td>
                <td className="num">{rec.decision.usage.outputTokens}</td>
                <td className="num">{ms(rec.decision.latencyMs)}</td>
                <td className="num">{usd(rec.decision.usage.costUsd)}</td>
              </tr>
              {claudeCall && (
                <tr>
                  <td>{claudeCall.label}</td>
                  <td className="num">{claudeCall.call.usage.outputTokens}</td>
                  <td className="num">{ms(claudeCall.call.latencyMs)}</td>
                  <td className="num">{usd(claudeCall.call.usage.costUsd)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      <h2>The three question types</h2>
      <p>
        Every question has a type, instructions and criteria. All questions in one request are answered in
        parallel and cannot see each other's answers, so do not write a question that depends on another.
      </p>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <QuestionWidget
          id="customer_blocked"
          title="noul: yes or no"
          answer={rec?.decision.answers.customer_blocked}
        />
        <QuestionWidget id="team" title="choice: pick one option" answer={rec?.decision.answers.team} />
        <QuestionWidget
          id="urgency"
          title="score: a place on a scale"
          answer={rec?.decision.answers.urgency}
        />
      </div>
      <p className="small">
        A <code>noul</code> value near 0.5 means a coin flip, not "medium". A <code>score</code> value is a
        probability-weighted position, so 1.5 means the mass sits between two levels, not that there is a
        level 1.5. Jev 1.14 also has <code>box</code> questions for images; this lab does not use them yet.
      </p>

      <h2>System One and System Two</h2>
      <p>
        The pattern comes from the idea of a fast, intuitive mind and a slow, deliberate one. On the strip
        board each ticket is a strip: printed fields are the fast model's calls, and a pencil note is the slow
        model's reasoning.
      </p>
      <ol>
        <li>
          <strong>Decide (fast).</strong> One decision call per ticket answers team, urgency, customer blocked
          and personal data.
        </li>
        <li>
          <strong>Route or escalate.</strong> A plain rule reads the probabilities. Confident tickets go
          straight to a team. Unsure ones, likely critical ones, and ones where personal data is unclear go to
          Claude.
        </li>
        <li>
          <strong>Reason (slow).</strong> Claude reads the ticket and the probabilities, settles the labels,
          writes a short reason and drafts a reply.
        </li>
        <li>
          <strong>Verify (fast again).</strong> The decision model checks Claude's draft: does it answer the
          question, does it leak personal data, does it promise a refund or a date, and how does the tone
          read. A failed check sends the draft to a person.
        </li>
        <li>
          <strong>Record.</strong> Every step logs the model, version, time, tokens and cost.
        </li>
      </ol>
      <p>
        The lesson is the loop: the fast model decides, the slow model handles the hard cases, and the fast
        model checks the slow one. <Link to="/desk">Watch it on the desk.</Link>
      </p>

      <h2>Thresholds</h2>
      <p>
        <code>confidence</code> says how concentrated the answer distribution is. It does not say the answer
        is right. It is only useful once you have checked, on labelled data, how often answers at that
        confidence are right. That check is the reliability diagram on the <Link to="/results">Results</Link>{" "}
        page.
      </p>
      {jevCurve && (
        <table style={{ maxWidth: 520 }}>
          <caption className="small" style={{ textAlign: "left", marginBottom: 6 }}>
            {file?.decider.label}
            {isMockData ? " (mock)" : ""}: share of tickets above each team-confidence threshold, and team
            accuracy on those
          </caption>
          <thead>
            <tr>
              <th className="num">threshold</th>
              <th className="num">handled automatically</th>
              <th className="num">accuracy on those</th>
            </tr>
          </thead>
          <tbody>
            {jevCurve
              .filter((c) => [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].includes(c.threshold))
              .map((c) => (
                <tr key={c.threshold}>
                  <td className="num">{c.threshold.toFixed(2)}</td>
                  <td className="num">{pct(c.coverage)}</td>
                  <td className="num">{pct(c.accuracy)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      <p>
        Raising the threshold hands fewer tickets to the fast path and sends more to Claude, which costs more
        and takes longer. Pick it from the cost of a wrong auto-route, not from a round number.
      </p>

      <Limits />
    </article>
  );
}
