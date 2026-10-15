import type { CSSProperties } from "react";
import { ms, p2, usd } from "../lib/format.ts";
import s from "./Strip.module.css";

export type StripState = "incoming" | "routed" | "escalated";

export interface StripData {
  id: string;
  subject: string;
  state: StripState;
  printed: boolean;
  team?: string;
  teamP?: number;
  urgency?: string;
  blockedP?: number;
  personalP?: number;
  latencyMs?: number;
  costUsd?: number;
  /** Claude's pencil note on escalated strips. */
  note?: string;
  noteWriting?: boolean;
  writeMs?: number;
  flagged?: boolean;
}

/** 0.94 becomes .94 so compact strips stay narrow. */
const short = (n?: number) => (n === undefined ? "" : n >= 0.995 ? "1.0" : n.toFixed(2).replace(/^0/, ""));

function Cell({
  printed,
  children,
  className = "",
}: {
  printed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`${s.cell} ${className} ${printed ? s.printed : s.blank}`} aria-hidden={!printed}>
      {printed ? children : "----"}
    </span>
  );
}

function describe(d: StripData): string {
  if (!d.printed) return `${d.id}, ${d.subject}, waiting for a decision`;
  const where = d.state === "escalated" ? "escalated to Claude" : `routed to ${d.team}`;
  return `${d.id}, ${d.subject}, ${where}, team ${d.team} ${p2(d.teamP)}, urgency ${d.urgency}`;
}

/** Compact strip for bays on the board. */
export function Strip({
  d,
  selected,
  onSelect,
}: {
  d: StripData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const style = { "--write-ms": `${d.writeMs ?? 2400}ms` } as CSSProperties;
  const Tag = onSelect ? "button" : "div";
  return (
    <Tag
      className={s.strip}
      data-state={d.state}
      data-flip={d.id}
      aria-pressed={onSelect ? !!selected : undefined}
      aria-label={describe(d)}
      onClick={onSelect ? () => onSelect(d.id) : undefined}
      style={style}
    >
      <span className={s.band} />
      <span className={s.body}>
        <span className={s.row}>
          <span className={`${s.cell} ${s.id} ${s.grow}`}>{d.id}</span>
          <Cell printed={d.printed}>{d.latencyMs !== undefined ? ms(d.latencyMs) : ""}</Cell>
        </span>
        <span className={s.row}>
          <span className={`${s.subject} ${s.grow}`}>{d.subject}</span>
        </span>
        <span className={s.row}>
          <Cell printed={d.printed} className={s.grow}>
            {d.team}
          </Cell>
          <Cell printed={d.printed}>{short(d.teamP)}</Cell>
        </span>
        <span className={s.row}>
          <Cell printed={d.printed} className={s.grow}>
            {d.urgency}
          </Cell>
          <Cell printed={d.printed} className={s.flagCell}>
            <abbr title={`P(customer blocked) = ${p2(d.blockedP)}`}>
              {(d.blockedP ?? 0) >= 0.5 ? "blk" : "---"}
            </abbr>
          </Cell>
          <Cell printed={d.printed} className={s.flagCell}>
            <abbr title={`P(personal data) = ${p2(d.personalP)}`}>
              {(d.personalP ?? 0) >= 0.5 ? "pd" : "--"}
            </abbr>
          </Cell>
        </span>
        {d.note && (
          <span className={`${s.note} ${d.noteWriting ? s.writing : ""}`}>
            {d.flagged && <span className={s.flag}>check failed. </span>}
            {d.note}
          </span>
        )}
      </span>
    </Tag>
  );
}

/** Full-width strip: every field on one line, as printed on a real strip. */
export function FullStrip({
  d,
  selected,
  onSelect,
}: {
  d: StripData;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      className={`${s.strip} ${s.full}`}
      data-state={d.state}
      data-flip={d.id}
      aria-pressed={!!selected}
      aria-label={describe(d)}
      onClick={() => onSelect?.(d.id)}
    >
      <span className={s.band} />
      <span className={s.body}>
        <span className={`${s.cell} ${s.id}`}>{d.id}</span>
        <span className={s.subject}>{d.subject}</span>
        <Cell printed={d.printed}>
          <span className={s.label}>team</span>
          {d.team} {p2(d.teamP)}
        </Cell>
        <Cell printed={d.printed}>
          <span className={s.label}>urgency</span>
          {d.urgency}
        </Cell>
        <Cell printed={d.printed}>
          <span className={s.label}>blocked</span>
          {p2(d.blockedP)}
        </Cell>
        <Cell printed={d.printed}>
          <span className={s.label}>personal data</span>
          {p2(d.personalP)}
        </Cell>
        <Cell printed={d.printed}>
          <span className={s.label}>time</span>
          {d.latencyMs !== undefined ? ms(d.latencyMs) : ""}
        </Cell>
        <Cell printed={d.printed}>
          <span className={s.label}>cost</span>
          {d.costUsd !== undefined ? usd(d.costUsd) : ""}
        </Cell>
      </span>
    </button>
  );
}
