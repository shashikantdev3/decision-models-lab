import { useLab } from "../lib/mode.tsx";
import { labelStatusText } from "../lib/data.ts";

/** Shown wherever numbers appear. Mock numbers are made up; replayed numbers carry their date and versions. */
export function DataNotice({
  what = "numbers",
  needsTriage = false,
}: {
  what?: string;
  needsTriage?: boolean;
}) {
  const { isMockData, data, mode, hasRecorded } = useLab();
  if (needsTriage && data && !isMockData && data.triage.length === 0) {
    return (
      <div className="alert" role="note">
        <p>
          The recorded run from {data.date} is a benchmark only; no triage run has been recorded yet, so there
          are no strips to replay. Run <code>npm run triage</code> to record one, or switch to Mock to see how
          the desk works.
        </p>
      </div>
    );
  }
  if (isMockData) {
    return (
      <div className="alert warning" role="note">
        <p>
          <span className="badge mock">Mock</span> These {what} come from offline stand-in models with made-up
          behaviour. They show how the lab works, not how the real models perform.
          {hasRecorded ? " Switch to Replay to see recorded runs." : " No run has been recorded yet."}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="alert" role="note">
        <p>
          No recorded run yet{mode === "live" ? " to compare with" : ""}. Run <code>npm run bench</code> and{" "}
          <code>npm run triage</code> to record one, or switch to Mock to try the site with made-up data.
        </p>
      </div>
    );
  }
  return null;
}

export function LabelNotice() {
  const { data, isMockData } = useLab();
  if (isMockData) return null;
  const text = labelStatusText(data);
  if (!/not/.test(text)) return null;
  return (
    <p className="small" role="note">
      <strong>Accuracy caveat:</strong> {text}.
    </p>
  );
}

export function Loading() {
  return <p className="muted">Preparing mock data in your browser.</p>;
}
