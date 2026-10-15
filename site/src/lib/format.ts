export const p2 = (n: number | undefined) => (n === undefined || Number.isNaN(n) ? "n/a" : n.toFixed(2));
export const pct = (n: number | undefined, digits = 0) =>
  n === undefined || Number.isNaN(n) ? "n/a" : `${(n * 100).toFixed(digits)}%`;
export const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${Math.round(n)} ms`);
export function usd(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  if (n === 0) return "$0";
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}
export const TEAM_LABEL: Record<string, string> = {
  payments: "Payments",
  auth: "Auth",
  infra: "Infra",
  data: "Data",
  account: "Account",
};
