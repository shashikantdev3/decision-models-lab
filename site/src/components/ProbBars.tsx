import type { Answer } from "@decision-models-lab/core";
import s from "./ProbBars.module.css";

/** One bar per answer option. Score options keep their order; choice and noul are sorted by probability. */
export function ProbBars({ answer, label }: { answer: Answer; label?: string }) {
  const entries = Object.entries(answer.probabilities);
  if (answer.type !== "score") entries.sort((a, b) => b[1] - a[1]);
  return (
    <div className={s.list} role="list" aria-label={label}>
      {entries.map(([k, p]) => (
        <div key={k} role="listitem" className={`${s.item} ${k === answer.top ? s.top : ""}`}>
          <span className={s.name}>{answer.type === "noul" ? (k === "true" ? "yes" : "no") : k}</span>
          <span className={s.track} aria-hidden="true">
            <span className={s.fill} style={{ width: `${(p * 100).toFixed(1)}%` }} />
          </span>
          <span className={`num ${s.value}`}>{p.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}
