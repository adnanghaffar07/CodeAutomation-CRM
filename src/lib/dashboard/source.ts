// The single place dashboards get their data. Today it is the generated demo organisation (src/lib/demo/dataset.ts).
// To use real data, return a `Dataset` built from real tables here; no dashboard code needs to change.
// Set DASHBOARD_DEMO_DATA=off to refuse to show demo numbers (the dashboards then show an empty state).
import { buildDemoDataset, type Dataset } from "@/lib/demo/dataset";

let cache: { day: number; ds: Dataset } | null = null;

export function demoEnabled(): boolean {
  return (process.env.DASHBOARD_DEMO_DATA ?? "on").toLowerCase() !== "off";
}

/** The dataset for today (built once per day per server process). Null when demo data is switched off and no real source exists yet. */
export function getDataset(now: Date = new Date()): Dataset | null {
  if (!demoEnabled()) return null;
  // Rebuilt hourly so "2h ago" style times stay believable; the numbers themselves only move with the date.
  const day = Math.floor(now.getTime() / 3_600_000);
  if (!cache || cache.day !== day) cache = { day, ds: buildDemoDataset(now) };
  return cache.ds;
}
