// Small chart set for the dashboards. Plain SVG and CSS, no client JavaScript, so they render on the server and follow
// the light/dark theme through the colour tokens. Colour is never the only signal: every bar and slice has a text value.
import { cn } from "@/components/ui/cn";

export type Tone = "brand" | "success" | "warning" | "danger" | "muted" | "violet";

export const TONE_BG: Record<Tone, string> = {
  brand: "bg-brand", success: "bg-success", warning: "bg-warning", danger: "bg-destructive", muted: "bg-muted-foreground/40", violet: "bg-[hsl(var(--chip-violet-fg))]",
};
export const TONE_VAR: Record<Tone, string> = {
  brand: "hsl(var(--brand))", success: "hsl(var(--success))", warning: "hsl(var(--warning))", danger: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground) / 0.45)", violet: "hsl(var(--chip-violet-fg))",
};

/** A progress bar. `marker` (0..1) draws a tick where the person should be by now (pace). Values above 100% fill the bar. */
export function Meter({ value, tone = "brand", marker, label, className }: { value: number; tone?: Tone; marker?: number; label: string; className?: string }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} className={cn("relative h-2 w-full rounded-pill bg-muted", className)}>
      <div className={cn("h-full rounded-pill", TONE_BG[tone])} style={{ width: `${w}%` }} />
      {marker != null && <span aria-hidden className="absolute -top-0.5 h-3 w-0.5 rounded bg-foreground/60" style={{ left: `calc(${Math.min(1, marker) * 100}% - 1px)` }} />}
    </div>
  );
}

/** Tone for a 0..1 attainment or 0..100 score: green on track, amber slipping, red behind. */
export const toneForRate = (r: number | null | undefined): Tone => (r == null ? "muted" : r >= 0.85 ? "success" : r >= 0.6 ? "warning" : "danger");
export const toneForScore = (s: number | null | undefined): Tone => toneForRate(s == null ? null : s / 100);

/** Rows of horizontal bars scaled to the largest value. */
export function BarRows({ rows, className }: { rows: { label: string; value: number; display?: string; tone?: Tone; sub?: string }[]; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-footnote">
          <span className="truncate text-foreground" title={r.label}>{r.label}{r.sub && <span className="ml-1 text-muted-foreground">{r.sub}</span>}</span>
          <span className="h-2 rounded-pill bg-muted">
            <span className={cn("block h-full rounded-pill", TONE_BG[r.tone ?? "brand"])} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="min-w-[3.5rem] text-right font-medium tabular-nums text-foreground">{r.display ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export type Segment = { label: string; value: number; tone: Tone };

/** One stacked bar per row. All rows share a scale, so bar lengths compare across people or teams. */
export function StackedRows({ rows, className }: { rows: { label: string; sub?: string; segments: Segment[]; total?: string }[]; className?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)));
  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((r) => {
        const sum = r.segments.reduce((a, s) => a + s.value, 0);
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-footnote">
            <span className="truncate text-foreground" title={r.label}>{r.label}{r.sub && <span className="ml-1 text-muted-foreground">{r.sub}</span>}</span>
            <span className="flex h-2.5 overflow-hidden rounded-pill bg-muted" style={{ width: `${Math.max(4, (sum / max) * 100)}%` }} role="img" aria-label={r.segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
              {r.segments.map((s) => s.value > 0 && <span key={s.label} className={TONE_BG[s.tone]} style={{ width: `${(s.value / sum) * 100}%` }} />)}
            </span>
            <span className="min-w-[2.5rem] text-right font-medium tabular-nums text-foreground">{r.total ?? sum}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function Legend({ items }: { items: { label: string; tone: Tone; value?: string | number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2 rounded-full", TONE_BG[i.tone])} />
          {i.label}{i.value != null && <span className="font-medium tabular-nums text-foreground">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/** A ring split into slices, with the total in the middle. */
export function Donut({ slices, center, sub, size = 132 }: { slices: Segment[]; center: string | number; sub: string; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = 46, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={slices.map((s) => `${s.label} ${s.value}`).join(", ")}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="13" />
        {total > 0 && slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.label} cx="60" cy="60" r={r} fill="none" stroke={TONE_VAR[s.tone]} strokeWidth="13"
              strokeDasharray={`${Math.max(0, len - 1.5)} ${c - Math.max(0, len - 1.5)}`} strokeDashoffset={-acc} transform="rotate(-90 60 60)" />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <span className="text-title2 font-semibold tabular-nums text-foreground">{center}</span>
        <span className="text-caption text-muted-foreground">{sub}</span>
      </div>
    </div>
  );
}

/** Tasks due (grey line) against tasks completed (blue area) over the filter's period. */
export function TrendChart({ points, height = 190 }: { points: { label: string; due: number; completed: number | null }[]; height?: number }) {
  const W = 640, H = height, L = 30, R = 8, T = 10, B = 24;
  const max = Math.max(4, ...points.flatMap((p) => [p.due, p.completed ?? 0]));
  const niceMax = Math.ceil(max / 4) * 4;
  const x = (i: number) => L + (points.length <= 1 ? (W - L - R) / 2 : (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B);
  const past = points.map((p, i) => ({ p, i })).filter((q) => q.p.completed != null);
  const path = (pts: { v: number; i: number }[]) => pts.map((q, n) => `${n ? "L" : "M"}${x(q.i).toFixed(1)} ${y(q.v).toFixed(1)}`).join(" ");
  const dueLine = path(points.map((p, i) => ({ v: p.due, i })));
  const doneLine = path(past.map((q) => ({ v: q.p.completed as number, i: q.i })));
  const area = past.length ? `${doneLine} L${x(past[past.length - 1].i).toFixed(1)} ${y(0)} L${x(past[0].i).toFixed(1)} ${y(0)} Z` : "";
  const every = Math.ceil(points.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Tasks due and completed per period. ${points.map((p) => `${p.label}: ${p.due} due${p.completed != null ? `, ${p.completed} completed` : ""}`).join("; ")}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={W - R} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="hsl(var(--border))" strokeWidth="1" />
          <text x={L - 6} y={y(niceMax * f) + 3.5} textAnchor="end" fontSize="10" fill="hsl(var(--muted-foreground))">{Math.round(niceMax * f)}</text>
        </g>
      ))}
      {area && <path d={area} fill="hsl(var(--brand) / 0.14)" />}
      {points.length > 0 && <path d={dueLine} fill="none" stroke="hsl(var(--muted-foreground) / 0.7)" strokeWidth="1.75" strokeDasharray="4 3" />}
      {past.length > 0 && <path d={doneLine} fill="none" stroke="hsl(var(--brand))" strokeWidth="2.25" strokeLinejoin="round" />}
      {points.map((p, i) => (
        <g key={p.label + i}>
          {p.completed != null && <circle cx={x(i)} cy={y(p.completed)} r="2.5" fill="hsl(var(--brand))"><title>{`${p.label}: ${p.completed} completed, ${p.due} due`}</title></circle>}
          {i % every === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))">{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}

/** Revenue won per month against the target line. */
export function MonthlyBars({ data, fmt }: { data: { label: string; won: number; target: number }[]; fmt: (n: number) => string }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.won, d.target]));
  return (
    <div className="flex h-44 items-end gap-3" role="img" aria-label={data.map((d) => `${d.label}: ${fmt(d.won)} won of ${fmt(d.target)} target`).join("; ")}>
      {data.map((d, i) => {
        const last = i === data.length - 1;
        return (
          <div key={d.label} className="flex h-full flex-1 flex-col justify-end gap-1.5 text-center">
            <span className="text-caption font-medium tabular-nums text-foreground">{fmt(d.won)}</span>
            <div className="relative flex-1">
              <div className={cn("absolute inset-x-1 bottom-0 rounded-t-md", d.won >= d.target ? "bg-success" : last ? "bg-brand/60" : "bg-brand")} style={{ height: `${(d.won / max) * 100}%` }} />
              <div className="absolute inset-x-0 border-t-2 border-dashed border-foreground/40" style={{ bottom: `${(d.target / max) * 100}%` }} title={`Target ${fmt(d.target)}`} />
            </div>
            <span className="text-caption text-muted-foreground">{d.label}{last && " (so far)"}</span>
          </div>
        );
      })}
    </div>
  );
}
