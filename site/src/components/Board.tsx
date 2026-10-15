import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Strip, type StripData } from "./Strip.tsx";
import { usePrefersReducedMotion } from "../lib/mode.tsx";
import s from "./Board.module.css";

export interface Bay {
  id: string;
  title: string;
  strips: StripData[];
  desk?: boolean;
}

/** Slides strips from their old position to the new one when they change bays (FLIP). */
function useFlip(ref: React.RefObject<HTMLElement | null>) {
  const prev = useRef(new Map<string, DOMRect>());
  const reduced = usePrefersReducedMotion();
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((el) => {
      const id = el.dataset.flip!;
      const r = el.getBoundingClientRect();
      next.set(id, r);
      const p = prev.current.get(id);
      if (!p || reduced || !r.width) return;
      const dx = p.left - r.left;
      const dy = p.top - r.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
          duration: 420,
          easing: "cubic-bezier(.2,.7,.2,1)",
        });
      }
    });
    prev.current = next;
  });
}

export function Board({
  bays,
  selectedId,
  onSelect,
  maxHeight,
  label = "Strip board",
}: {
  bays: Bay[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  maxHeight?: number;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFlip(ref);
  const firstBusy = bays.find((b) => b.strips.length)?.id ?? bays[0]?.id;
  const [tab, setTab] = useState<string | undefined>(undefined);
  const active = tab ?? firstBusy;
  const style = maxHeight ? ({ "--board-max": `${maxHeight}px` } as CSSProperties) : undefined;
  return (
    <section className={s.board} ref={ref} aria-label={label} style={style}>
      <div className={s.tabs} role="group" aria-label="Show bay">
        {bays.map((b) => (
          <button key={b.id} aria-pressed={active === b.id} onClick={() => setTab(b.id)}>
            {b.title} <span className="num">{b.strips.length}</span>
          </button>
        ))}
      </div>
      <div className={s.bays}>
        {bays.map((b) => (
          <div key={b.id} className={`${s.bay} ${b.desk ? s.desk : ""}`} data-active={active === b.id}>
            <h3>
              <span>{b.title}</span>
              <span className="num">{b.strips.length}</span>
            </h3>
            <div className={s.slots} tabIndex={0} role="region" aria-label={`${b.title} bay`}>
              {b.strips.length === 0 && <div className={s.empty}>Empty</div>}
              {b.strips.map((d) => (
                <Strip key={d.id} d={d} selected={d.id === selectedId} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
