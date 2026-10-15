import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { modelsConfig } from "@decision-models-lab/core";
import { useLab, type Mode } from "../lib/mode.tsx";
import s from "./Layout.module.css";

const REPO = "https://github.com/shashikantdev3/decision-models-lab";

function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  const effective = theme ?? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  useEffect(() => {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    try {
      if (theme) localStorage.setItem("dml-theme", theme);
    } catch {
      /* storage can be blocked; the toggle still works for this visit */
    }
  }, [theme]);
  return (
    <button className={s.linkButton} onClick={() => setTheme(effective === "dark" ? "light" : "dark")}>
      {effective === "dark" ? "Light theme" : "Dark theme"}
    </button>
  );
}

function ModeSwitch() {
  const { mode, setMode, hasRecorded } = useLab();
  const opts: { m: Mode; label: string; title: string; disabled?: boolean }[] = [
    {
      m: "replay",
      label: "Replay",
      title: hasRecorded
        ? "Replay recorded runs. Free, no key."
        : "No recorded run yet. Run npm run bench to record one.",
      disabled: !hasRecorded,
    },
    { m: "live", label: "Live", title: "Call the models with your own keys." },
    { m: "mock", label: "Mock", title: "Offline stand-in models. Made-up numbers, for trying the site." },
  ];
  return (
    <div className={s.segmented} role="group" aria-label="Run mode">
      {opts.map((o) => (
        <button
          key={o.m}
          aria-pressed={mode === o.m}
          title={o.title}
          disabled={o.disabled}
          onClick={() => setMode(o.m)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KeyPanel() {
  const { keys, setKeys } = useLab();
  return (
    <div className={s.keys}>
      <div>
        <label htmlFor="key-or">Paste your OpenRouter key</label>
        <input
          id="key-or"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-or-..."
          value={keys.openrouter}
          onChange={(e) => setKeys({ ...keys, openrouter: e.target.value.trim() })}
        />
      </div>
      <div>
        <label htmlFor="key-an">Paste your Anthropic key (optional, for Claude)</label>
        <input
          id="key-an"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-..."
          value={keys.anthropic}
          onChange={(e) => setKeys({ ...keys, anthropic: e.target.value.trim() })}
        />
      </div>
      <p className="small muted">
        Keys stay in this tab's memory and are sent only to openrouter.ai and api.anthropic.com. Closing or
        reloading the tab forgets them. Use a key with a credit limit.
      </p>
    </div>
  );
}

export function Layout() {
  const { mode, decider, setDecider, writer, setWriter, isMockData, data } = useLab();
  const deciders = modelsConfig.deciders.filter((d) => d.kind === "decision");
  return (
    <>
      <a href="#main" className="visually-hidden">
        Skip to content
      </a>
      <header className={s.header}>
        <div className={s.inner}>
          <div className={s.top}>
            <NavLink to="/" className={s.brand} end>
              Decision Models Lab
            </NavLink>
            <nav className={s.nav} aria-label="Main">
              <NavLink to="/learn">Learn</NavLink>
              <NavLink to="/playground">Playground</NavLink>
              <NavLink to="/desk">Desk</NavLink>
              <NavLink to="/results">Results</NavLink>
              <NavLink to="/extend">Extend</NavLink>
            </nav>
          </div>
          <div className={s.controls}>
            <ModeSwitch />
            {isMockData && <span className="badge mock">Mock</span>}
            {mode === "replay" && data && <span className="small muted num">recorded {data.date}</span>}
            <span className={s.field}>
              <label htmlFor="pick-decider">Decider</label>
              <select id="pick-decider" value={decider} onChange={(e) => setDecider(e.target.value)}>
                {deciders.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </span>
            <span className={s.field}>
              <label htmlFor="pick-writer">Writer</label>
              <select id="pick-writer" value={writer} onChange={(e) => setWriter(e.target.value)}>
                {modelsConfig.writers.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            </span>
            <span className={s.spacer}>
              <ThemeToggle />
              <a href={REPO}>GitHub</a>
            </span>
          </div>
          {mode === "live" && <KeyPanel />}
        </div>
      </header>
      <main id="main" className={s.main}>
        <Outlet />
      </main>
      <footer className={s.footer}>
        <div className={s.inner}>
          <p>
            Not affiliated with TypeSafe, Microsoft or Anthropic. Contoso and every ticket here are fictional.
            Numbers come from our own runs on the dates shown; vendor figures are labelled as vendor claims.
          </p>
          <p>
            MIT licence. Source and docs on <a href={REPO}>GitHub</a>.
          </p>
        </div>
      </footer>
    </>
  );
}
