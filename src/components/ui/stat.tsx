// Design v2 §9.14 — Stat / StatGroup / StatCarousel. The one KPI (metric) card.
// Colour lives on the numeral only (tone), never on borders or gradients;
// a zero reads as muted, never red.
import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { CountUp } from "@/components/ui/count-up";

type Tone = "neutral" | "success" | "warning" | "danger" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  brand: "text-brand-text",
};

/** Icon-chip hues (globals.css .chip-*). Decorative; meaning stays with tone. */
export type ChipAccent = "blue" | "violet" | "sky" | "amber" | "emerald" | "rose";

// Literal class names: Tailwind only emits @layer classes it finds verbatim
// in source, so never build them as `chip-${accent}`.
const CHIP: Record<ChipAccent, string> = {
  blue: "chip-blue", violet: "chip-violet", sky: "chip-sky", amber: "chip-amber", emerald: "chip-emerald", rose: "chip-rose",
};

/** The chip hue a tone implies when no accent is given. */
export function chipFor(tone: Tone = "neutral", accent?: ChipAccent): string {
  if (accent) return CHIP[accent];
  return CHIP[tone === "danger" ? "rose" : tone === "warning" ? "amber" : tone === "success" ? "emerald" : "blue"];
}

/** Small icon chip (28px) for list rows and card headers. */
export const ICON_CHIP =
  "grid size-7 shrink-0 place-items-center rounded-control transition-transform duration-base ease-standard group-hover:scale-105 [&_svg]:size-4";

/** Large icon block (40–44px) that leads a metric card. */
export const ICON_BLOCK =
  "grid size-10 shrink-0 place-items-center rounded-control transition-transform duration-base ease-standard group-hover:scale-105 sm:size-11 [&_svg]:size-5";

const DELTA: Record<"up" | "down" | "flat", string> = {
  up: "bg-success-tint text-success",
  down: "bg-destructive-tint text-destructive",
  flat: "bg-muted text-muted-foreground",
};

export type StatProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: { value: string; tone: "up" | "down" | "flat" };
  tone?: Tone;
  icon?: React.ReactNode;
  /** Icon chip hue; defaults from tone (danger → rose, warning → amber, success → emerald, else blue). */
  accent?: ChipAccent;
  onClick?: () => void;
  active?: boolean;
  href?: string;
  isZero?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Stat({
  label, value, hint, delta, tone = "neutral", icon, accent, onClick, active, href, isZero, className, children,
}: StatProps) {
  const interactive = !!onClick || !!href;
  // Metric card (UI polish, 10/12/26 — after the Tarento CRM reference): a
  // tinted icon block on the left, label + value beside it, and the hint /
  // delta in a footer under a hairline. The value always sits right under the
  // label, so a row of cards keeps its numerals on one line.
  const cls = cn(
    "group relative flex min-w-0 flex-col gap-3 rounded-card bg-card p-4 text-left shadow-e1",
    interactive &&
      "surface-interactive tap-clean aria-pressed:ring-2 aria-pressed:ring-brand aria-pressed:ring-offset-2 aria-pressed:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  const DeltaIcon = delta?.tone === "up" ? ArrowUpRight : delta?.tone === "down" ? ArrowDownRight : Minus;
  const body = (
    <>
      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-3">
        {icon && (
          <span aria-hidden className={cn(ICON_BLOCK, chipFor(tone, accent))}>
            {icon}
          </span>
        )}
        <div className={cn("min-w-0 flex-1", interactive && "pr-3")}>
          <span className="block min-w-0 text-footnote font-medium text-muted-foreground">{label}</span>
          <span className={cn("mt-0.5 block text-kpi font-semibold tabular-nums", isZero ? "text-tertiary" : TONE[tone])}><CountUp value={value} /></span>
        </div>
      </div>
      {interactive && (
        <ChevronRight aria-hidden className="absolute right-3 top-3 size-4 text-tertiary transition-[transform,color] duration-fast group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      )}
      {(hint || delta) && (
        <div className="mt-auto flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-border/70 pt-2.5 text-caption text-muted-foreground">
          {delta && (
            <span className={cn("inline-flex h-5 items-center gap-0.5 rounded-pill px-1.5 text-caption2 font-semibold tabular-nums", DELTA[delta.tone])}>
              <DeltaIcon aria-hidden className="size-3" />
              {delta.value}
            </span>
          )}
          {hint && <span className="min-w-0">{hint}</span>}
        </div>
      )}
      {children}
    </>
  );
  if (href) {
    return <Link href={href} className={cls} aria-current={active ? "true" : undefined}>{body}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{body}</button>;
  }
  return <div className={cls}>{body}</div>;
}

/** A responsive grid of separate metric cards (2 / 3 sm / 6 xl). */
export function StatGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6", className)} {...props} />;
}

/** Mobile: a snap-scrolling row of stats. */
export function StatCarousel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [&>*]:w-[44vw] [&>*]:max-w-[200px] [&>*]:shrink-0 [&>*]:snap-start",
        className,
      )}
      {...props}
    />
  );
}
