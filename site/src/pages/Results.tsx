import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Legend,
} from "recharts";
import type { BenchFile } from "@decision-models-lab/core";
import { DataNotice, LabelNotice, Loading } from "../components/Notices.tsx";
import { useLab } from "../lib/mode.tsx";
import { ms, pct, usd } from "../lib/format.ts";

const SERIES: Record<string, { color: string; shape: "circle" | "square" | "triangle" }> = {
  jev: { color: "var(--series-jev)", shape: "circle" },
  "decision-1": { color: "var(--series-decision1)", shape: "square" },
};
const style = (key: string) => SERIES[key] ?? { color: "var(--series-claude)", shape: "triangle" as const };
const short = (b: BenchFile) =>
  b.model.label.replace(" (as decider)", "").replace("TypeSafe ", "").replace("Microsoft ", "");

/** Powers of ten that cover the values, for readable log-scale ticks. */
function decades(values: number[]): number[] {
  const v = values.filter((x) => x > 0);
  if (!v.length) return [];
  const lo = Math.floor(Math.log10(Math.min(...v)));
  const hi = Math.ceil(Math.log10(Math.max(...v)));
  return Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i));
}

const axis = {
  stroke: "var(--ink)",
  tick: { fill: "var(--ink)", fontSize: 12, fontFamily: "var(--font-mono)" },
};
const tooltip = {
  contentStyle: {
    background: "var(--panel)",
    border: "1px solid var(--ink)",
    borderRadius: 0,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--ink)" },
  itemStyle: { color: "var(--ink)" },
};

/** Marker every tenth point so lines can be told apart without colour. */
function Marker({
  cx,
  cy,
  index,
  shape,
  color,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  shape: string;
  color: string;
}) {
  if (cx === undefined || cy === undefined || (index ?? 0) % 10 !== 0) return <g />;
  if (shape === "square") return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill={color} />;
  if (shape === "triangle")
    return <path d={`M${cx},${cy - 5} L${cx + 5},${cy + 4} L${cx - 5},${cy + 4} Z`} fill={color} />;
  return <circle cx={cx} cy={cy} r={4} fill={color} />;
}

function Figure({
  title,
  children,
  note,
  height = 280,
}: {
  title: string;
  children: React.ReactElement;
  note?: string;
  height?: number;
}) {
  return (
    <figure className="panel" style={{ margin: 0 }}>
      <figcaption>
        <span className="visually-hidden">Chart. The same numbers are in the summary table above. </span>
        <strong>{title}</strong>
        {note && <span className="small muted"> {note}</span>}
      </figcaption>
      <div style={{ width: "100%", height }} aria-hidden="true">
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </figure>
  );
}

export function Results() {
  const { data, loading, isMockData } = useLab();
  const benches = data?.bench ?? [];
  const p = benches[0]?.provenance;

  const accRows = ["team", "urgency", "customer_blocked", "contains_personal_data"].map((q) => {
    const row: Record<string, unknown> = { q: q.replace("customer_", "").replace("contains_", "") };
    for (const b of benches) {
      const a = b.metrics.accuracy[q as keyof typeof b.metrics.accuracy];
      row[b.model.key] = a.mean;
      row[`${b.model.key}_err`] = [a.mean - a.min, a.max - a.mean];
    }
    return row;
  });
  const perModel = benches.map((b) => ({
    name: short(b),
    key: b.model.key,
    p50: b.metrics.latency.p50,
    p95: b.metrics.latency.p95,
    per1000: b.metrics.cost.per1000Usd,
    f1: b.metrics.teamMacroF1.mean,
    mae: b.metrics.urgencyMAE.mean,
  }));
  const thresholds = benches[0]?.metrics.coverage.map((c) => c.threshold) ?? [];
  const coverageRows = thresholds.map((t, i) => {
    const row: Record<string, number | undefined> = { t };
    for (const b of benches) {
      row[`${b.model.key}_cov`] = b.metrics.coverage[i]?.coverage;
      row[`${b.model.key}_acc`] = b.metrics.coverage[i]?.accuracy;
    }
    return row;
  });
  const wording = data?.wording ?? [];
  const flipRows = ["team", "urgency", "customer_blocked", "contains_personal_data"].map((q) => {
    const row: Record<string, unknown> = { q: q.replace("customer_", "").replace("contains_", "") };
    for (const w of wording) row[w.model.key] = w.metrics.byQuestion[q]?.flipRate;
    return row;
  });

  return (
    <article>
      <h1>Results</h1>
      <DataNotice />
      {loading && <Loading />}
      {benches.length > 0 && p && (
        <>
          <table style={{ maxWidth: 820, marginBottom: 16 }}>
            <tbody>
              <tr>
                <th>Recorded</th>
                <td className="mono">
                  {p.date} {isMockData && <span className="badge mock">Mock</span>}
                </td>
              </tr>
              <tr>
                <th>Models</th>
                <td className="mono">
                  {benches
                    .map((b) => {
                      const served = b.calls.find((c) => c.servedModel)?.servedModel;
                      return `${b.model.id}${served && served !== b.model.id && !isMockData ? ` (served as ${served})` : ""}`;
                    })
                    .join(", ")}
                </td>
              </tr>
              <tr>
                <th>Dataset</th>
                <td>
                  {p.dataset.count} tickets, version {p.dataset.version}, question set {p.questionSet},{" "}
                  {p.runs} runs per model
                </td>
              </tr>
              <tr>
                <th>Measured from</th>
                <td>
                  {p.region}, code {p.gitCommit}
                </td>
              </tr>
            </tbody>
          </table>
          <LabelNotice />

          <h2>Summary</h2>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th className="num">team accuracy (min to max)</th>
                  <th className="num">team macro-F1</th>
                  <th className="num">urgency MAE</th>
                  <th className="num">ECE</th>
                  <th className="num">p50</th>
                  <th className="num">p95</th>
                  <th className="num">per 1,000 decisions</th>
                </tr>
              </thead>
              <tbody>
                {benches.map((b) => (
                  <tr key={b.model.key}>
                    <td>{b.model.label}</td>
                    <td className="num">
                      {pct(b.metrics.accuracy.team.mean, 1)} ({pct(b.metrics.accuracy.team.min)} to{" "}
                      {pct(b.metrics.accuracy.team.max)})
                    </td>
                    <td className="num">{b.metrics.teamMacroF1.mean.toFixed(3)}</td>
                    <td className="num">{b.metrics.urgencyMAE.mean.toFixed(2)}</td>
                    <td className="num">{b.metrics.ece.toFixed(3)}</td>
                    <td className="num">{ms(b.metrics.latency.p50)}</td>
                    <td className="num">{ms(b.metrics.latency.p95)}</td>
                    <td className="num">{usd(b.metrics.cost.per1000Usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Charts</h2>
          <div
            className="grid2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))" }}
          >
            <Figure title="Accuracy per question" note="Mean of the runs; whiskers show min to max.">
              <BarChart data={accRows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="q" {...axis} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axis} />
                <Tooltip {...tooltip} formatter={(v: number) => pct(v, 1)} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink)" }} />
                {benches.map((b) => (
                  <Bar
                    key={b.model.key}
                    dataKey={b.model.key}
                    name={short(b)}
                    fill={style(b.model.key).color}
                    isAnimationActive={false}
                  >
                    <ErrorBar dataKey={`${b.model.key}_err`} stroke="var(--ink)" width={4} />
                  </Bar>
                ))}
              </BarChart>
            </Figure>

            <Figure
              height={320}
              title="Reliability diagram"
              note="x: stated confidence, y: share right. Each point is a confidence bin; on the dashed diagonal, confidence matches how often it was right."
            >
              <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="var(--rule)" />
                <XAxis type="number" dataKey="x" domain={[0, 1]} name="confidence" {...axis} />
                <YAxis type="number" dataKey="y" domain={[0, 1]} name="right" {...axis} />
                <ZAxis type="number" dataKey="n" range={[30, 220]} name="answers" />
                <Tooltip {...tooltip} formatter={(v: number) => (v <= 1 ? v.toFixed(2) : v)} />
                <Scatter
                  data={[
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ]}
                  line={{ stroke: "var(--ink-soft)", strokeDasharray: "4 4" }}
                  shape={() => <g />}
                  name="perfect calibration"
                  legendType="none"
                  isAnimationActive={false}
                />
                {benches.map((b) => (
                  <Scatter
                    key={b.model.key}
                    name={short(b)}
                    data={b.metrics.reliability
                      .filter((r) => r.count)
                      .map((r) => ({ x: r.meanConfidence, y: r.accuracy, n: r.count }))}
                    fill={style(b.model.key).color}
                    shape={style(b.model.key).shape}
                    line={{ stroke: style(b.model.key).color }}
                    legendType={style(b.model.key).shape}
                    isAnimationActive={false}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </ScatterChart>
            </Figure>

            <Figure title="Latency per call" note="Measured in the client, warm-up calls excluded.">
              <BarChart data={perModel} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--rule)" horizontal={false} />
                <XAxis
                  type="number"
                  scale="log"
                  domain={[
                    (m: number) => 10 ** Math.floor(Math.log10(m)),
                    (m: number) => 10 ** Math.ceil(Math.log10(m)),
                  ]}
                  ticks={decades(perModel.flatMap((m) => [m.p50, m.p95]))}
                  tickFormatter={(v) => ms(v)}
                  {...axis}
                />
                <YAxis type="category" dataKey="name" width={110} {...axis} />
                <Tooltip {...tooltip} formatter={(v: number) => ms(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="p50" name="p50" fill="var(--ink-soft)" isAnimationActive={false} />
                <Bar dataKey="p95" name="p95" fill="var(--ink)" isAnimationActive={false} />
              </BarChart>
            </Figure>

            <Figure
              title="Cost per 1,000 decisions"
              note="Log scale. One decision = one call with four questions."
            >
              <BarChart data={perModel} layout="vertical" margin={{ top: 8, right: 64, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--rule)" horizontal={false} />
                <XAxis
                  type="number"
                  scale="log"
                  domain={[
                    (m: number) => 10 ** Math.floor(Math.log10(m)),
                    (m: number) => 10 ** Math.ceil(Math.log10(m)),
                  ]}
                  ticks={decades(perModel.map((m) => m.per1000))}
                  tickFormatter={(v) => usd(v)}
                  {...axis}
                />
                <YAxis type="category" dataKey="name" width={110} {...axis} />
                <Tooltip {...tooltip} formatter={(v: number) => usd(v)} />
                <Bar dataKey="per1000" name="USD per 1,000" isAnimationActive={false} fill="var(--ink)">
                  <LabelList
                    dataKey="per1000"
                    position="right"
                    formatter={(v: number) => usd(v)}
                    style={{ fill: "var(--ink)", fontSize: 11 }}
                  />
                </Bar>
              </BarChart>
            </Figure>

            <Figure
              height={320}
              title="Coverage and accuracy by threshold"
              note="x: team-confidence threshold. Solid: share of tickets at or above it. Dashed: team accuracy on those."
            >
              <LineChart data={coverageRows} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid stroke="var(--rule)" />
                <XAxis dataKey="t" type="number" domain={[0.5, 0.99]} {...axis} />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axis} />
                <Tooltip
                  {...tooltip}
                  formatter={(v: number) => pct(v, 1)}
                  labelFormatter={(v) => `threshold ${Number(v).toFixed(2)}`}
                />
                {benches.flatMap((b) => [
                  <Line
                    key={`${b.model.key}c`}
                    dataKey={`${b.model.key}_cov`}
                    name={`${short(b)} coverage`}
                    stroke={style(b.model.key).color}
                    strokeWidth={2}
                    dot={(props: { cx?: number; cy?: number; index?: number }) => (
                      <Marker
                        key={props.index}
                        {...props}
                        shape={style(b.model.key).shape}
                        color={style(b.model.key).color}
                      />
                    )}
                    legendType={style(b.model.key).shape}
                    isAnimationActive={false}
                  />,
                  <Line
                    key={`${b.model.key}a`}
                    dataKey={`${b.model.key}_acc`}
                    name={`${short(b)} accuracy`}
                    stroke={style(b.model.key).color}
                    strokeDasharray="5 4"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    legendType="plainline"
                    isAnimationActive={false}
                  />,
                ])}
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </Figure>

            <Figure
              title="Flip rate under rewording"
              note="How often the top answer changed when only the question wording changed."
            >
              {wording.length ? (
                <BarChart data={flipRows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="var(--rule)" vertical={false} />
                  <XAxis dataKey="q" {...axis} />
                  <YAxis domain={[0, "auto"]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axis} />
                  <Tooltip {...tooltip} formatter={(v: number) => pct(v, 1)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {wording.map((w) => (
                    <Bar
                      key={w.model.key}
                      dataKey={w.model.key}
                      name={w.model.label}
                      fill={style(w.model.key).color}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              ) : (
                <p className="muted">No wording test recorded. Run npm run wording.</p>
              )}
            </Figure>
          </div>

          <h2>Methodology</h2>
          <p>
            One dataset of {p.dataset.count} fictional tickets, labelled by construction and cross-checked by
            a second model, measured from one region. Each model answered every ticket {p.runs} times.
            Accuracy is the mean across runs with the spread shown. Calibration pools every top answer: its
            stated probability against whether it was right, in 10 bins. These results teach; they are not a
            general benchmark. The full method is in{" "}
            <a href="https://github.com/shashikantdev3/decision-models-lab/blob/main/docs/11-results-methodology.md">
              docs/11-results-methodology.md
            </a>
            .
          </p>
        </>
      )}
    </article>
  );
}
