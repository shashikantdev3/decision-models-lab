import { useLab } from "./mode.tsx";
import type { TriageFile } from "@decision-models-lab/core";

/** The recorded (or mock) triage run for the decider and writer picked in the header, with fallbacks. */
export function useTriageFile(): TriageFile | undefined {
  const { data, decider, writer } = useLab();
  const all = data?.triage ?? [];
  return (
    all.find((t) => t.decider.key === decider && t.writer.key === writer) ??
    all.find((t) => t.decider.key === decider) ??
    all[0]
  );
}
