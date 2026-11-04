// Appearance preferences — density (Comfortable / Compact). Client-safe.
//
// Mitch, 9/23/26: "have the ability to toggle in settings. Comfort or
// Compact. Should be robust in toggling back & forth, shouldnt need to
// refresh."
//
// Density is ONE attribute on <html> (data-density). Every text size and
// control height reads CSS variables keyed off it (src/app/globals.css), so
// flipping it re-lays the whole app instantly — no reload, no re-render.
// The choice is kept per device in localStorage and applied before first
// paint by DENSITY_BOOT_SCRIPT, so a page never flashes the other density.
// Other open tabs follow along through the storage event.

export type Density = "comfortable" | "compact";
export const DENSITY_KEY = "bbi:density";
export const DENSITY_EVENT = "bbi:density-change";

export function readDensity(): Density {
  try { return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable"; } catch { return "comfortable"; }
}

export function applyDensity(d: Density): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.density = d;
}

export function setDensity(d: Density): void {
  try { localStorage.setItem(DENSITY_KEY, d); } catch { /* storage blocked: still apply for this page */ }
  applyDensity(d);
  try { window.dispatchEvent(new CustomEvent(DENSITY_EVENT, { detail: d })); } catch { /* old browsers */ }
}

/** Inlined in <head>: sets the density before the first paint. */
export const DENSITY_BOOT_SCRIPT =
  `try{document.documentElement.dataset.density=localStorage.getItem(${JSON.stringify(DENSITY_KEY)})==="compact"?"compact":"comfortable"}catch(e){document.documentElement.dataset.density="comfortable"}`;
