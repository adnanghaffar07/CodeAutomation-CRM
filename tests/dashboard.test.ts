import { describe, expect, it } from "vitest";
import { buildDemoDataset, isDemoId } from "@/lib/demo/dataset";
import { allowedViews, assertVisible, resolveView, resolveViewer, visibilityFor } from "@/lib/dashboard/access";
import { RANGE_KEYS, rangeFor } from "@/lib/dashboard/range";
import { adminSummary, attainment, personRow, salesSummary, taskStats, workBlock } from "@/lib/dashboard/metrics";

// A fixed "now" mid-month, mid-week, after the 17:00 UTC deadline hour, so the numbers are stable.
const NOW = new Date("2026-11-11T10:00:00Z");
const ds = buildDemoDataset(NOW);
const all = new Set(ds.people.map((p) => p.id));

describe("demo dataset", () => {
  it("is deterministic", () => {
    const again = buildDemoDataset(NOW);
    expect(again.tasks.length).toBe(ds.tasks.length);
    expect(again.opportunities.map((o) => o.value)).toEqual(ds.opportunities.map((o) => o.value));
  });
  it("marks every row as demo and reports itself as demo", () => {
    expect(ds.isDemo).toBe(true);
    expect([...ds.people, ...ds.tasks, ...ds.opportunities, ...ds.leads].every((r) => isDemoId(r.id))).toBe(true);
  });
  it("has a consistent reporting structure", () => {
    for (const p of ds.people) if (p.managerId) expect(ds.people.some((m) => m.id === p.managerId)).toBe(true);
    for (const t of ds.teams) expect(ds.people.find((p) => p.id === t.managerId)?.role).toBe("manager");
    expect(ds.people.filter((p) => p.status === "suspended").length).toBeGreaterThan(0);
    expect(new Set(ds.people.map((p) => p.role)).size).toBe(4);
  });
  it("never gives a task to a manager or the CEO", () => {
    const ok = new Set(ds.people.filter((p) => p.role === "sales_bd" || p.role === "data_researcher").map((p) => p.id));
    expect(ds.tasks.every((t) => ok.has(t.assigneeId))).toBe(true);
  });
  it("has no work for suspended people in the last 40 days", () => {
    const cut = new Date(NOW.getTime() - 39 * 86400000);
    const sus = new Set(ds.people.filter((p) => p.status === "suspended").map((p) => p.id));
    expect(ds.tasks.filter((t) => sus.has(t.assigneeId) && t.dueAt > cut)).toHaveLength(0);
  });
});

describe("task numbers add up", () => {
  for (const key of RANGE_KEYS) {
    it(`assigned = completed + pending + overdue (${key})`, () => {
      const w = workBlock(ds, all, rangeFor(key, NOW), NOW);
      expect(w.stats.completed + w.stats.pending + w.stats.overdue).toBe(w.stats.assigned);
      expect(w.stats.notStarted + w.stats.inProgress + w.stats.onHold + w.stats.awaitingReview + w.stats.rejected).toBe(w.stats.pending);
    });
    it(`organisation total = sum of employees = sum of teams (${key})`, () => {
      const r = rangeFor(key, NOW);
      const w = workBlock(ds, all, r, NOW);
      const sum = (f: (s: ReturnType<typeof taskStats>) => number, xs: { stats: ReturnType<typeof taskStats> }[]) => xs.reduce((a, x) => a + f(x.stats), 0);
      expect(sum((s) => s.assigned, w.rows)).toBe(w.stats.assigned);
      expect(sum((s) => s.completed, w.rows)).toBe(w.stats.completed);
      expect(sum((s) => s.overdue, w.rows)).toBe(w.stats.overdue);
      expect(sum((s) => s.assigned, w.teams)).toBe(w.stats.assigned);
      expect(sum((s) => s.overdue, w.teams)).toBe(w.stats.overdue);
    });
  }
  it("a longer range never has fewer tasks than a shorter one", () => {
    const n = (k: (typeof RANGE_KEYS)[number]) => workBlock(ds, all, rangeFor(k, NOW), NOW).stats.assigned;
    expect(n("quarter")).toBeGreaterThanOrEqual(n("month"));
    expect(n("month")).toBeGreaterThanOrEqual(n("week"));
    expect(n("week")).toBeGreaterThanOrEqual(n("today"));
  });
  it("produces a mix of outcomes, so the dashboards are not empty or all green", () => {
    const s = workBlock(ds, all, rangeFor("quarter", NOW), NOW).stats;
    expect(s.completed).toBeGreaterThan(100);
    expect(s.overdue).toBeGreaterThan(10);
    expect(s.awaitingReview).toBeGreaterThan(0);
    expect(s.overdue / s.assigned).toBeLessThan(0.2);
  });
  it("scores stay between 0 and 100", () => {
    const w = workBlock(ds, all, rangeFor("quarter", NOW), NOW);
    for (const r of w.rows) if (r.score != null) expect(r.score >= 0 && r.score <= 100).toBe(true);
    expect(w.top.length).toBeGreaterThan(0);
  });
});

describe("sales numbers add up", () => {
  const sales = new Set(ds.people.filter((p) => p.role === "sales_bd").map((p) => p.id));
  const r = rangeFor("quarter", NOW);
  it("team attainment equals the sum of its people", () => {
    const org = attainment(ds, sales, NOW);
    const each = [...sales].map((id) => attainment(ds, new Set([id]), NOW));
    expect(each.reduce((a, x) => a + x.month.won, 0)).toBe(org.month.won);
    expect(each.reduce((a, x) => a + x.quarter.target, 0)).toBe(org.quarter.target);
  });
  it("won this quarter in the summary equals quarter achievement", () => {
    const s = salesSummary(ds, sales, r, NOW);
    expect(s.won.value).toBe(s.attainment.quarter.won);
  });
  it("pipeline value equals the sum of the open stages", () => {
    const s = salesSummary(ds, sales, r, NOW);
    const open = s.stages.filter((x) => ["qualified", "discovery", "proposal", "negotiation"].includes(x.stage));
    expect(open.reduce((a, x) => a + x.value, 0)).toBe(s.pipelineValue);
    expect(open.reduce((a, x) => a + x.count, 0)).toBe(s.openDeals);
    expect(s.weightedValue).toBeLessThan(s.pipelineValue);
  });
  it("win rate is won / (won + lost) and targets are realistic", () => {
    const s = salesSummary(ds, sales, r, NOW);
    expect(s.winRate).toBeCloseTo(s.won.count / (s.won.count + s.lost.count), 6);
    expect(s.attainment.month.rate).toBeGreaterThan(0.4);
    expect(s.attainment.month.rate).toBeLessThan(1.6);
  });
  it("the monthly chart's current month equals month achievement", () => {
    const s = salesSummary(ds, sales, r, NOW);
    expect(s.monthly[3].won).toBe(s.attainment.month.won);
  });
});

describe("access control", () => {
  const person = (role: "ceo_admin" | "manager" | "sales_bd" | "data_researcher") => resolveViewer(ds, { userId: "11111111-2222-4333-8444-555555555555", role });
  it("maps a signed-in user to a demo person of the same role", () => {
    for (const role of ["ceo_admin", "manager", "sales_bd", "data_researcher"] as const) expect(person(role).role).toBe(role);
  });
  it("only the CEO / Admin can open the executive and admin views", () => {
    expect(allowedViews("ceo_admin")).toEqual(["executive", "sales", "admin"]);
    for (const role of ["manager", "sales_bd", "data_researcher"] as const) {
      expect(allowedViews(role, person(role))).not.toContain("executive");
      expect(allowedViews(role, person(role))).not.toContain("admin");
      expect(resolveView(role, person(role), "admin")).not.toBe("admin");
      expect(resolveView(role, person(role), "executive")).not.toBe("executive");
    }
  });
  it("an unknown or missing view falls back to the role's default", () => {
    expect(resolveView("data_researcher", undefined, "sales")).toBe("personal");
    expect(resolveView("ceo_admin", undefined, undefined)).toBe("executive");
  });
  it("a researcher sees only themselves", () => {
    const p = person("data_researcher");
    const v = visibilityFor(ds, p);
    expect(v.scope).toBe("self");
    expect([...v.ids]).toEqual([p.id]);
    const w = workBlock(ds, v.ids, rangeFor("quarter", NOW), NOW);
    expect(w.rows.every((x) => x.person.id === p.id)).toBe(true);
    expect(() => assertVisible(v, [ds.people.find((x) => x.id !== p.id)!.id])).toThrow();
  });
  it("a sales person sees no one else's deals", () => {
    const p = person("sales_bd");
    const v = visibilityFor(ds, p);
    const s = salesSummary(ds, v.ids, rangeFor("quarter", NOW), NOW);
    expect(s.followUps.open.every((f) => f.ownerId === p.id)).toBe(true);
    const mine = ds.opportunities.filter((o) => o.ownerId === p.id && ["qualified", "discovery", "proposal", "negotiation"].includes(o.stage));
    expect(s.openDeals).toBe(mine.length);
  });
  it("a manager sees exactly their direct reports plus themselves", () => {
    const m = person("manager");
    const v = visibilityFor(ds, m);
    expect(v.scope).toBe("team");
    const expected = ds.people.filter((p) => p.managerId === m.id).length + 1;
    expect(v.ids.size).toBe(expected);
    const w = workBlock(ds, v.ids, rangeFor("quarter", NOW), NOW);
    expect(w.rows.every((x) => x.person.managerId === m.id)).toBe(true);
  });
  it("a manager's team total equals the same people in the organisation view", () => {
    const m = person("manager");
    const v = visibilityFor(ds, m);
    const r = rangeFor("quarter", NOW);
    const team = workBlock(ds, v.ids, r, NOW);
    const org = workBlock(ds, all, r, NOW);
    const fromOrg = org.rows.filter((x) => x.person.managerId === m.id);
    expect(team.stats.assigned).toBe(fromOrg.reduce((a, x) => a + x.stats.assigned, 0));
    expect(personRow(ds, team.rows[0].person, r, NOW).stats).toEqual(team.rows[0].stats);
  });
  it("admin counts agree with the people list", () => {
    const a = adminSummary(ds, NOW);
    expect(a.active + a.suspended).toBe(a.total);
    expect(a.byRole.reduce((x, y) => x + y.count, 0)).toBe(a.total);
    expect(a.byDepartment.reduce((x, y) => x + y.count, 0)).toBe(a.total);
    expect(a.pending.reviews).toBe(ds.tasks.filter((t) => t.status === "verified").length);
  });
});
