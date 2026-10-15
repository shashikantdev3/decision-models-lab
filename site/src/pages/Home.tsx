import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { route, type TriageRecord } from "@decision-models-lab/core";
import { Board } from "../components/Board.tsx";
import { DataNotice, Loading } from "../components/Notices.tsx";
import { useLab, usePrefersReducedMotion } from "../lib/mode.tsx";
import { useTriageFile } from "../lib/useTriage.ts";
import { baysFor, stripFrom, emptyBays } from "../lib/strips.ts";
import { ms } from "../lib/format.ts";
import type { StripData } from "../components/Strip.tsx";
import s from "./Home.module.css";

type Phase = "incoming" | "printed" | "placed";

/** Picks six strips for the intro: five that route on their own and one that goes to Claude. */
function pickSix(records: TriageRecord[], policy: Parameters<typeof route>[1]): TriageRecord[] {
  const auto = records.filter((r) => route(r.decision, policy).action === "auto");
  const esc = records.filter((r) => route(r.decision, policy).action === "escalate" && r.draft);
  const teams = new Set<string>();
  const spread = auto.filter((r) => {
    const t = r.decision.answers.team?.top;
    if (teams.has(t)) return false;
    teams.add(t);
    return true;
  });
  const five = [...spread, ...auto.filter((r) => !spread.includes(r))].slice(0, 5);
  const one = esc[0] ? [esc[0]] : [];
  const out = [...five.slice(0, 3), ...one, ...five.slice(3)];
  return out.slice(0, 6);
}

export function Home() {
  const { loading, isMockData } = useLab();
  const file = useTriageFile();
  const reduced = usePrefersReducedMotion();
  const six = useMemo(() => (file ? pickSix(file.records, file.policy) : []), [file]);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!file || !six.length) return;
    if (reduced) {
      setPhase(Object.fromEntries(six.map((r) => [r.ticketId, "placed"])));
      return;
    }
    setPhase(Object.fromEntries(six.map((r) => [r.ticketId, "incoming"])));
    const timers: number[] = [];
    six.forEach((r, i) => {
      const sent = 700 + i * 450;
      const back = sent + r.decision.latencyMs; // the recorded decision time, at real speed
      timers.push(window.setTimeout(() => setPhase((p) => ({ ...p, [r.ticketId]: "printed" })), back));
      timers.push(window.setTimeout(() => setPhase((p) => ({ ...p, [r.ticketId]: "placed" })), back + 380));
    });
    return () => timers.forEach(clearTimeout);
  }, [file, six, reduced, run]);

  const strips: StripData[] = six.map((r) => {
    const base = stripFrom(r, file!.policy);
    const ph = phase[r.ticketId] ?? "incoming";
    if (ph === "incoming") return { ...base, state: "incoming", printed: false, note: undefined };
    if (ph === "printed") return { ...base, state: "incoming", printed: true, note: undefined };
    return {
      ...base,
      noteWriting: !reduced,
      writeMs: Math.min(4000, Math.max(1200, r.draft?.latencyMs ?? 2400)),
    };
  });

  const decisionTimes = six.map((r) => r.decision.latencyMs);
  const esc = six.find((r) => route(r.decision, file!.policy).action === "escalate");

  return (
    <>
      <section className={s.hero}>
        <h1>Decision models make the quick calls. Claude takes the hard ones.</h1>
        <p className={s.lede}>
          TypeSafe Jev and Microsoft Decision-1 read a ticket and return probabilities, not prose, in a
          fraction of a second. When they are unsure, the ticket goes to Claude, and a decision model checks
          Claude's reply before it is sent.
        </p>
        <div className="row">
          <Link className="button" to="/hello">
            Start with Hello World
          </Link>
          <Link className="button secondary" to="/desk">
            Watch the desk
          </Link>
        </div>
      </section>

      <DataNotice what="strips" needsTriage />
      {loading && <Loading />}
      {file ? (
        <>
          <Board
            bays={six.length ? baysFor(strips) : emptyBays()}
            label="Six tickets moving through the strip board"
          />
          <div className={s.caption}>
            <span className="muted">
              Each ticket is a strip. Printed fields are the decision model's calls; the pencil note is
              Claude's reasoning.
            </span>
            <span className="num">
              {file.decider.label} {isMockData ? "(mock)" : ""} decided in {ms(Math.min(...decisionTimes))} to{" "}
              {ms(Math.max(...decisionTimes))}
              {esc?.draft ? `; Claude took ${ms(esc.draft.latencyMs)}` : ""}.{" "}
              <button
                className="secondary"
                style={{ padding: "2px 8px", fontSize: 13 }}
                onClick={() => setRun((n) => n + 1)}
              >
                Replay the board
              </button>
            </span>
          </div>
        </>
      ) : (
        !loading && <Board bays={emptyBays()} />
      )}

      <section className={s.parts} aria-label="What is in the lab">
        <div>
          <h2>
            <Link to="/hello">Hello World</Link>
          </h2>
          <p>
            Clone, run it offline, add your key, run it live. Five minutes to a working lab you can change.
          </p>
        </div>
        <div>
          <h2>
            <Link to="/learn">Learn</Link>
          </h2>
          <p>What a decision model is, the three question types, and when confidence means something.</p>
        </div>
        <div>
          <h2>
            <Link to="/playground">Playground</Link>
          </h2>
          <p>
            Write your own questions, run them on Jev, Decision-1 or Claude, and reword them to see what
            moves.
          </p>
        </div>
        <div>
          <h2>
            <Link to="/desk">Triage Desk</Link>
          </h2>
          <p>
            48 fictional Contoso tickets. Move the threshold and watch tickets move between the teams and
            Claude.
          </p>
        </div>
        <div>
          <h2>
            <Link to="/results">Results</Link>
          </h2>
          <p>Accuracy, calibration, speed and cost from recorded runs, with dates and model versions.</p>
        </div>
      </section>
    </>
  );
}
