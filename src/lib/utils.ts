import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge that knows this app's design tokens (Design v2, 9/23/26).
// Stock twMerge treats the named type sizes (text-body, text-footnote,
// text-nano …) as text COLOURS and silently dropped the size whenever a
// colour class followed ("text-body text-muted-foreground" → size lost).
// Styling only — no behaviour depends on this beyond which classes survive.
const twMergeTokens = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "caption2", "caption", "footnote", "body", "callout", "headline",
        "title3", "title2", "title1", "large-title", "kpi",
        "nano", "micro", "mini", "lead",
      ],
      radius: [
        "xs", "control", "card", "overlay", "sheet", "pill",
        "control-inner", "card-inner", "overlay-inner",
      ],
      shadow: ["e1", "e2", "e3", "e4"],
      ease: ["standard", "enter", "exit", "sheet", "spring"],
    },
    classGroups: {
      duration: [{ duration: ["instant", "fast", "base", "moderate", "slow"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMergeTokens(clsx(inputs));
}

export function formatCurrency(n: number | null | undefined, dp = 0): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function formatNumber(n: number | null | undefined, dp = 0): string {
  if (n == null || !isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

// Round-10c — thousand-separator formatter for any number-like value
// rendered in the UI (areas, dimensions, setbacks, KPIs, etc.). Rule:
//   • null/undefined/""  → em dash
//   • integer-looking    → "20000" → "20,000"
//   • decimal-looking    → preserve original decimal digits ("0.4596" stays)
//   • non-numeric strings → returned unchanged (Block "4103" stays "4103"
//     when the caller decides to skip this helper — it always formats
//     when called)
// Intentionally exclude Block + Lot field IDs at the CALL SITE, not here,
// since those are identifiers and Block "4103" looks the same with or
// without commas anyway (it has 4 digits).
export function formatThousands(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const s = String(v).trim();
  if (s === "") return "—";
  // Strip any commas the caller already added so we can re-format
  // deterministically.
  const clean = s.replace(/,/g, "");
  const n = Number(clean);
  if (!Number.isFinite(n)) return s;
  if (clean.includes(".")) {
    const decimals = clean.split(".")[1].length;
    return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  return x.toISOString().slice(0, 10);
}

export function formatElapsed(s: number): string {
  const m = Math.floor(s / 60); const sec = s % 60;
  return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

// ==== EST / America/New_York formatters ============================
// BBI operates on EST regardless of user locale. All datetime displays in
// the deal detail, timeline, correspondence tables, and stage history go
// through these helpers. Server stores UTC; UI formats to America/New_York.

const EST_TZ = "America/New_York";

/** "Apr 22, 2026" */
export function formatDateEST(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (!isFinite(x.getTime())) return "—";
  return x.toLocaleDateString("en-US", {
    timeZone: EST_TZ, year: "numeric", month: "short", day: "numeric",
  });
}

/** "Apr 22, 2026 01:00 PM" */
export function formatDateTimeEST(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (!isFinite(x.getTime())) return "—";
  const date = x.toLocaleDateString("en-US", {
    timeZone: EST_TZ, year: "numeric", month: "short", day: "numeric",
  });
  const time = x.toLocaleTimeString("en-US", {
    timeZone: EST_TZ, hour: "2-digit", minute: "2-digit", hour12: true,
  });
  return `${date} ${time}`;
}

/** "01:00 PM" */
export function formatTimeEST(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const x = typeof d === "string" ? new Date(d) : d;
  if (!isFinite(x.getTime())) return "—";
  return x.toLocaleTimeString("en-US", {
    timeZone: EST_TZ, hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
