import { useId, useRef, useState, type ReactNode } from "react";
import s from "./Code.module.css";

/** A code block with a copy button. */
export function Code({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard can be blocked; the text is still selectable */
    }
  }
  return (
    <div className={s.block}>
      <pre tabIndex={0} aria-label={label}>
        <code>{children}</code>
      </pre>
      <button className={`secondary ${s.copy}`} onClick={copy} aria-label={`Copy ${label ?? "code"}`}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

/** Accessible tabs: arrow keys move between tabs, the selected one is remembered for this visit. */
export function Tabs({ tabs, label, initial }: { tabs: Tab[]; label: string; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0].id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKey(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = (i + step + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div>
      <div className={s.tabs} role="tablist" aria-label={label}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            className={s.tab}
            onClick={() => setActive(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={active !== t.id}
          className={s.panel}
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
