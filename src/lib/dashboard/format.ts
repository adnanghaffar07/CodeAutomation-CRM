export const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 10_000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n).toLocaleString("en-US")}`);
export const moneyFull = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** A 0..1 ratio as a whole percentage, or an em dash when there is nothing to divide. */
export const pct = (r: number | null | undefined) => (r == null || Number.isNaN(r) ? "—" : `${Math.round(r * 100)}%`);
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
export function ago(d: Date, now: Date = new Date()): string {
  const m = Math.max(0, Math.round((now.getTime() - d.getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return days < 14 ? `${days}d ago` : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
export const dueLabel = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
