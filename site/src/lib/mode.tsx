import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { latestRecorded, type ResultSet } from "./data.ts";
import { mockResultSet } from "./mockData.ts";

export type Mode = "replay" | "live" | "mock";

const EMPTY = { openrouter: "", anthropic: "" };
/** Keys from .env when running `npm run dev` locally; always empty in the published site. */
export function devKeys(): Keys {
  return typeof __DEV_KEYS__ === "undefined" ? EMPTY : __DEV_KEYS__;
}
export const keysFromEnv = () => !!devKeys().openrouter;

interface Keys {
  openrouter: string;
  anthropic: string;
}

interface Lab {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** Data the pages read: recorded runs in Replay and Live, generated data in Mock. */
  data: ResultSet | undefined;
  loading: boolean;
  isMockData: boolean;
  hasRecorded: boolean;
  keys: Keys;
  setKeys: (k: Keys) => void;
  decider: string;
  setDecider: (k: string) => void;
  writer: string;
  setWriter: (k: string) => void;
}

const Ctx = createContext<Lab | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const hasRecorded = !!latestRecorded;
  const [mode, setMode] = useState<Mode>(hasRecorded ? "replay" : "mock");
  const [mock, setMock] = useState<ResultSet | undefined>();
  // Keys live in React state only: never localStorage, never sent anywhere except the provider.
  const [keys, setKeys] = useState<Keys>(() => ({ ...EMPTY, ...devKeys() }));
  // Start on the models of the recorded triage run, so the header matches what the board shows.
  const recordedTriage = latestRecorded?.triage[0];
  const [decider, setDecider] = useState(recordedTriage?.decider.key ?? "decision-1");
  const [writer, setWriter] = useState(recordedTriage?.writer.key ?? "claude-sonnet");

  useEffect(() => {
    if (mode === "mock" && !mock) mockResultSet().then(setMock);
  }, [mode, mock]);

  const value = useMemo<Lab>(() => {
    const data = mode === "mock" ? mock : latestRecorded;
    return {
      mode,
      setMode,
      data,
      loading: mode === "mock" && !mock,
      isMockData: mode === "mock",
      hasRecorded,
      keys,
      setKeys,
      decider,
      setDecider,
      writer,
      setWriter,
    };
  }, [mode, mock, hasRecorded, keys, decider, writer]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLab(): Lab {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLab outside LabProvider");
  return v;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}
