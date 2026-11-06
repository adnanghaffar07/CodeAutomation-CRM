// The date filter shared by every dashboard: Today, This week (Monday to Sunday), This month, This quarter. All in UTC.
export const RANGE_KEYS = ["today", "week", "month", "quarter"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const RANGE_LABEL: Record<RangeKey, string> = { today: "Today", week: "This week", month: "This month", quarter: "This quarter" };

export type Range = { key: RangeKey; label: string; start: Date; /** exclusive */ end: Date };

const DAY = 24 * 60 * 60 * 1000;

export function parseRange(v: string | string[] | undefined): RangeKey {
  const s = Array.isArray(v) ? v[0] : v;
  return (RANGE_KEYS as readonly string[]).includes(s ?? "") ? (s as RangeKey) : "month";
}

export function rangeFor(key: RangeKey, now: Date = new Date()): Range {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start = day;
  let end = new Date(day.getTime() + DAY);
  if (key === "week") {
    const sinceMonday = (day.getUTCDay() + 6) % 7;
    start = new Date(day.getTime() - sinceMonday * DAY);
    end = new Date(start.getTime() + 7 * DAY);
  } else if (key === "month") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  } else if (key === "quarter") {
    const q = Math.floor(now.getUTCMonth() / 3) * 3;
    start = new Date(Date.UTC(now.getUTCFullYear(), q, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), q + 3, 1));
  }
  return { key, label: RANGE_LABEL[key], start, end };
}

export const inRange = (d: Date | null | undefined, r: Range) => !!d && d.getTime() >= r.start.getTime() && d.getTime() < r.end.getTime();
