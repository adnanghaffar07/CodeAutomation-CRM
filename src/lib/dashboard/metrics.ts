// Every dashboard number is computed here, from one `Dataset`, for the people the viewer may see (access.ts).
// Nothing is hard-coded per dashboard: a team total is the sum of its members, the organisation total is the sum of
// its teams, so the figures agree on every screen. Pure functions, covered by tests/dashboard.test.ts.
import { flagsFor } from "@/lib/assignments";
import type { Dataset, FollowUp, LeadStatusKey, Opportunity, Person, Stage, Task, Team } from "@/lib/demo/dataset";
import { OPEN_STAGES, STAGES, STAGE_WEIGHT } from "@/lib/demo/dataset";
import { inRange, type Range } from "@/lib/dashboard/range";
import { ratio } from "@/lib/dashboard/format";

const DAY = 24 * 60 * 60 * 1000;
export const isEmployee = (p: Person) => p.role === "sales_bd" || p.role === "data_researcher";

// ───────────────────────────── tasks ─────────────────────────────

/**
 * Assigned = Completed + Pending + Overdue, always.
 *  - Completed: approved by a manager.
 *  - Overdue: still to do (To do / In progress) and past its deadline (the same rule the Assignments screen flags).
 *  - Pending: everything else not finished: not started yet, in progress, on hold, awaiting approval, or rejected (needs redoing).
 */
export type TaskStats = {
  assigned: number; completed: number; pending: number; overdue: number;
  /** The pending pool, split out. `rejected` is also counted inside `pending`. */
  notStarted: number; inProgress: number; onHold: number; awaitingReview: number; rejected: number;
};

export function isOverdue(t: Task, now: Date): boolean {
  return flagsFor({ status: t.status, dueAt: t.dueAt, requiresEvidence: t.requiresEvidence, evidenceCount: t.evidenceCount }, now).overdue;
}

export function taskStats(tasks: Task[], now: Date): TaskStats {
  const s: TaskStats = { assigned: tasks.length, completed: 0, pending: 0, overdue: 0, notStarted: 0, inProgress: 0, onHold: 0, awaitingReview: 0, rejected: 0 };
  for (const t of tasks) {
    if (t.status === "approved") { s.completed++; continue; }
    if (isOverdue(t, now)) { s.overdue++; continue; }
    s.pending++;
    if (t.status === "open") s.notStarted++;
    else if (t.status === "in_progress") s.inProgress++;
    else if (t.status === "on_hold") s.onHold++;
    else if (t.status === "verified") s.awaitingReview++;
    else if (t.status === "rejected") s.rejected++;
  }
  return s;
}

export type Kpis = {
  /** Tasks whose deadline has already passed. The rates below only use these, so work not yet due does not drag a score down. */
  dueSoFar: number;
  completionRate: number | null; // approved ÷ due so far
  onTimeRate: number | null;     // approved and submitted by the deadline ÷ approved
  qualityRate: number | null;    // approved ÷ (approved + rejected)
  /** 0..100: 40% completion, 30% on time, 30% quality. Null until there are at least 3 tasks due. */
  taskScore: number | null;
};

export function taskKpis(tasks: Task[], now: Date): Kpis {
  const due = tasks.filter((t) => t.dueAt.getTime() <= now.getTime());
  const done = due.filter((t) => t.status === "approved");
  const onTime = done.filter((t) => t.submittedAt && t.submittedAt.getTime() <= t.dueAt.getTime());
  const rejected = due.filter((t) => t.status === "rejected");
  const completionRate = ratio(done.length, due.length);
  const onTimeRate = ratio(onTime.length, done.length);
  const qualityRate = ratio(done.length, done.length + rejected.length);
  const taskScore = due.length >= 3 && completionRate != null && onTimeRate != null && qualityRate != null
    ? Math.round((0.4 * completionRate + 0.3 * onTimeRate + 0.3 * qualityRate) * 100) : null;
  return { dueSoFar: due.length, completionRate, onTimeRate, qualityRate, taskScore };
}

export const tasksFor = (ds: Dataset, ids: Set<string>) => ds.tasks.filter((t) => ids.has(t.assigneeId));
export const tasksIn = (tasks: Task[], r: Range) => tasks.filter((t) => inRange(t.dueAt, r));

// ───────────────────────────── sales ─────────────────────────────

/** `rate` is won ÷ the full period target. `pace` is won ÷ what should be won by today if the target is met evenly (1 = on track). */
export type Attainment = { target: number; won: number; rate: number | null; pace: number | null; expected: number };

const monthStartOf = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const quarterStartOf = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));

export const opportunitiesFor = (ds: Dataset, ids: Set<string>) => ds.opportunities.filter((o) => ids.has(o.ownerId));
const wonValue = (opps: Opportunity[], from: Date, to: Date) =>
  opps.filter((o) => o.stage === "won" && o.closedAt && o.closedAt >= from && o.closedAt < to).reduce((a, o) => a + o.value, 0);

/** Target tracking for the current month and quarter. Only people who are active carry a target. */
export function attainment(ds: Dataset, ids: Set<string>, now: Date): { month: Attainment; quarter: Attainment } {
  const opps = opportunitiesFor(ds, ids);
  const monthly = ds.people.filter((p) => ids.has(p.id) && p.role === "sales_bd" && p.status === "active").reduce((a, p) => a + (ds.monthlyTarget[p.id] ?? 0), 0);
  const mStart = monthStartOf(now), qStart = quarterStartOf(now);
  const far = new Date(now.getTime() + 400 * DAY);
  const mWon = wonValue(opps, mStart, far), qWon = wonValue(opps, qStart, far);
  const elapsed = (from: Date, to: Date) => Math.min(1, Math.max(0.02, (now.getTime() - from.getTime()) / (to.getTime() - from.getTime())));
  const mEl = elapsed(mStart, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)));
  const qEl = elapsed(qStart, new Date(Date.UTC(qStart.getUTCFullYear(), qStart.getUTCMonth() + 3, 1)));
  return {
    month: { target: monthly, won: mWon, rate: ratio(mWon, monthly), pace: ratio(mWon, monthly * mEl), expected: monthly * mEl },
    quarter: { target: monthly * 3, won: qWon, rate: ratio(qWon, monthly * 3), pace: ratio(qWon, monthly * 3 * qEl), expected: monthly * 3 * qEl },
  };
}

export type StageRow = { stage: Stage; count: number; value: number; weighted: number };

export type SalesSummary = {
  leads: number; leadsByStatus: Record<LeadStatusKey, number>; qualifiedLeads: number; leadToQualified: number | null;
  openDeals: number; pipelineValue: number; weightedValue: number; stages: StageRow[]; staleDeals: Opportunity[];
  won: { count: number; value: number }; lost: { count: number; value: number }; winRate: number | null; avgDeal: number | null;
  attainment: { month: Attainment; quarter: Attainment };
  followUps: { overdue: number; dueToday: number; next7: number; open: FollowUp[] };
  monthly: { label: string; won: number; target: number }[];
  lostReasons: { reason: string; count: number }[];
};

const STALE_DAYS = 14;

export function salesSummary(ds: Dataset, ids: Set<string>, range: Range, now: Date): SalesSummary {
  const opps = opportunitiesFor(ds, ids);
  const leads = ds.leads.filter((l) => ids.has(l.ownerId) && inRange(l.createdAt, range));
  const leadsByStatus: Record<LeadStatusKey, number> = { new: 0, researching: 0, contacted: 0, engaged: 0, qualified: 0, disqualified: 0 };
  for (const l of leads) leadsByStatus[l.status]++;

  const open = opps.filter((o) => OPEN_STAGES.includes(o.stage));
  const stages: StageRow[] = STAGES.map((stage) => {
    const rows = stage === "won" || stage === "lost"
      ? opps.filter((o) => o.stage === stage && inRange(o.closedAt, range))
      : open.filter((o) => o.stage === stage);
    const value = rows.reduce((a, o) => a + o.value, 0);
    return { stage, count: rows.length, value, weighted: value * STAGE_WEIGHT[stage] };
  });
  const wonRows = opps.filter((o) => o.stage === "won" && inRange(o.closedAt, range));
  const lostRows = opps.filter((o) => o.stage === "lost" && inRange(o.closedAt, range));
  const won = { count: wonRows.length, value: wonRows.reduce((a, o) => a + o.value, 0) };
  const lost = { count: lostRows.length, value: lostRows.reduce((a, o) => a + o.value, 0) };

  const fu = ds.followUps.filter((f) => ids.has(f.ownerId) && !f.done);
  const startToday = ds.today.getTime();
  const overdueFu = fu.filter((f) => f.dueAt.getTime() < now.getTime());
  const todayFu = fu.filter((f) => f.dueAt.getTime() >= now.getTime() && f.dueAt.getTime() < startToday + DAY);
  const next7 = fu.filter((f) => f.dueAt.getTime() >= startToday + DAY && f.dueAt.getTime() < startToday + 8 * DAY);

  const monthly = Array.from({ length: 4 }, (_, i) => {
    const back = 3 - i;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back + 1, 1));
    // The target for a past month counts only people who were selling in it.
    const sellers = ds.people.filter((p) => ids.has(p.id) && p.role === "sales_bd" && (p.status === "active" || opps.some((o) => o.ownerId === p.id && o.closedAt && o.closedAt >= start && o.closedAt < end)));
    return {
      label: start.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      won: wonValue(opps, start, end),
      target: sellers.reduce((a, p) => a + (ds.monthlyTarget[p.id] ?? 0), 0),
    };
  });

  const reasons = new Map<string, number>();
  for (const o of lostRows) if (o.lostReason) reasons.set(o.lostReason, (reasons.get(o.lostReason) ?? 0) + 1);

  return {
    leads: leads.length, leadsByStatus, qualifiedLeads: leadsByStatus.qualified, leadToQualified: ratio(leadsByStatus.qualified, leads.length),
    openDeals: open.length, pipelineValue: open.reduce((a, o) => a + o.value, 0),
    weightedValue: open.reduce((a, o) => a + o.value * STAGE_WEIGHT[o.stage], 0), stages,
    staleDeals: open.filter((o) => now.getTime() - o.lastActivityAt.getTime() > STALE_DAYS * DAY).sort((a, b) => b.value - a.value),
    won, lost, winRate: ratio(won.count, won.count + lost.count), avgDeal: ratio(won.value, won.count),
    attainment: attainment(ds, ids, now),
    followUps: { overdue: overdueFu.length, dueToday: todayFu.length, next7: next7.length, open: fu.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()) },
    monthly,
    lostReasons: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

// ───────────────────────────── people and teams ─────────────────────────────

export type PersonRow = {
  person: Person; stats: TaskStats; kpis: Kpis;
  /** Month target tracking, sales staff only. */
  month: Attainment | null;
  /** 0..100 overall. Sales: half target pace (capped at 100%), half task score. Others: the task score. */
  score: number | null;
  /** Work still on their plate now (not finished), regardless of the date filter. */
  load: number; loadOverdue: number;
};

export function personRow(ds: Dataset, p: Person, range: Range, now: Date): PersonRow {
  const all = ds.tasks.filter((t) => t.assigneeId === p.id);
  const inR = tasksIn(all, range);
  const stats = taskStats(inR, now);
  const kpis = taskKpis(inR, now);
  const month = p.role === "sales_bd" ? attainment(ds, new Set([p.id]), now).month : null;
  let score = kpis.taskScore;
  if (month && p.status === "active" && month.pace != null) {
    const a = Math.min(1, month.pace) * 100;
    score = kpis.taskScore == null ? Math.round(a) : Math.round(0.5 * a + 0.5 * kpis.taskScore);
  }
  const open = all.filter((t) => t.status !== "approved" && t.status !== "rejected");
  return { person: p, stats, kpis, month, score, load: open.length, loadOverdue: open.filter((t) => isOverdue(t, now)).length };
}

export type TeamRow = { team: Team; manager: Person; members: number; activeMembers: number; stats: TaskStats; kpis: Kpis; score: number | null };

export function teamRow(ds: Dataset, team: Team, rows: PersonRow[], range: Range, now: Date): TeamRow {
  const members = ds.people.filter((p) => p.teamId === team.id && isEmployee(p));
  const ids = new Set(members.map((m) => m.id));
  const tasks = tasksIn(tasksFor(ds, ids), range);
  const scores = rows.filter((r) => ids.has(r.person.id) && r.score != null).map((r) => r.score as number);
  return {
    team, manager: ds.people.find((p) => p.id === team.managerId)!, members: members.length, activeMembers: members.filter((m) => m.status === "active").length,
    stats: taskStats(tasks, now), kpis: taskKpis(tasks, now),
    score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

// ───────────────────────────── trend and feed ─────────────────────────────

export type Bucket = { label: string; start: Date; end: Date };

/** Chart buckets for the filter: today shows the last 7 days for context; week and month are daily; quarter is weekly. */
export function buckets(range: Range, now: Date): Bucket[] {
  const out: Bucket[] = [];
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  if (range.key === "quarter") {
    for (let s = range.start.getTime(); s < Math.min(range.end.getTime(), now.getTime() + 7 * DAY); s += 7 * DAY) {
      out.push({ label: fmt(new Date(s), { day: "numeric", month: "short" }), start: new Date(s), end: new Date(s + 7 * DAY) });
    }
    return out;
  }
  const start = range.key === "today" ? new Date(range.start.getTime() - 6 * DAY) : range.start;
  const stop = range.key === "today" ? range.end : new Date(Math.min(range.end.getTime(), range.key === "week" ? range.end.getTime() : range.start.getTime() + 31 * DAY));
  for (let s = start.getTime(); s < stop.getTime(); s += DAY) {
    out.push({ label: fmt(new Date(s), range.key === "week" ? { weekday: "short" } : { day: "numeric" }), start: new Date(s), end: new Date(s + DAY) });
  }
  return out;
}

/** `completed` is null for periods that have not started yet, so the chart stops at today instead of falling to zero. */
export type TrendPoint = { label: string; due: number; completed: number | null };

export function trend(tasks: Task[], range: Range, now: Date): TrendPoint[] {
  return buckets(range, now).map((b) => ({
    label: b.label,
    due: tasks.filter((t) => t.dueAt >= b.start && t.dueAt < b.end).length,
    completed: b.start.getTime() > now.getTime() ? null : tasks.filter((t) => t.completedAt && t.completedAt >= b.start && t.completedAt < b.end).length,
  }));
}

export type FeedItem = { id: string; at: Date; actor: Person; text: string; tone: "success" | "info" | "warning" | "danger" };

export function activityFeed(ds: Dataset, ids: Set<string>, now: Date, limit = 10): FeedItem[] {
  const byId = new Map(ds.people.map((p) => [p.id, p]));
  const items: FeedItem[] = [];
  const cut = now.getTime() - 14 * DAY;
  for (const t of ds.tasks) {
    const actor = byId.get(t.assigneeId);
    if (!actor || !ids.has(actor.id)) continue;
    if (t.completedAt && t.completedAt.getTime() <= now.getTime() && t.completedAt.getTime() > cut) items.push({ id: `${t.id}-a`, at: t.completedAt, actor, text: `completed “${t.title}”`, tone: "success" });
    else if (t.status === "verified" && t.submittedAt && t.submittedAt.getTime() > cut) items.push({ id: `${t.id}-s`, at: t.submittedAt, actor, text: `submitted “${t.title}” for approval`, tone: "info" });
    else if (t.status === "rejected" && t.submittedAt && t.submittedAt.getTime() > cut) items.push({ id: `${t.id}-r`, at: t.submittedAt, actor, text: `had “${t.title}” rejected`, tone: "danger" });
  }
  for (const o of ds.opportunities) {
    const actor = byId.get(o.ownerId);
    if (!actor || !ids.has(actor.id) || !o.closedAt || o.closedAt.getTime() > now.getTime() || o.closedAt.getTime() < cut) continue;
    items.push(o.stage === "won"
      ? { id: `${o.id}-w`, at: o.closedAt, actor, text: `won ${o.company} ($${o.value.toLocaleString("en-US")})`, tone: "success" }
      : { id: `${o.id}-l`, at: o.closedAt, actor, text: `lost ${o.company} (${o.lostReason ?? "no reason given"})`, tone: "warning" });
  }
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}

// ───────────────────────────── the dashboards ─────────────────────────────

export type WorkBlock = {
  stats: TaskStats; kpis: Kpis; rows: PersonRow[]; teams: TeamRow[];
  top: PersonRow[]; bottom: PersonRow[]; topTeams: TeamRow[];
  trend: TrendPoint[]; byType: { type: string; count: number }[]; byPriority: { priority: string; count: number }[];
  overdueTasks: (Task & { assignee: Person })[];
};

/** Task performance for a group of people. The organisation, a team and one person all use this one function. */
export function workBlock(ds: Dataset, ids: Set<string>, range: Range, now: Date): WorkBlock {
  const staff = ds.people.filter((p) => ids.has(p.id) && isEmployee(p));
  const rows = staff.map((p) => personRow(ds, p, range, now));
  const staffIds = new Set(staff.map((p) => p.id));
  const tasks = tasksIn(tasksFor(ds, staffIds), range);
  const ranked = rows.filter((r) => r.score != null && r.person.status === "active").sort((a, b) => (b.score as number) - (a.score as number));
  const teams = ds.teams.map((t) => teamRow(ds, t, rows, range, now)).filter((t) => rows.some((r) => r.person.teamId === t.team.id));
  const byId = new Map(ds.people.map((p) => [p.id, p]));
  const count = <K extends string>(key: (t: Task) => K) => {
    const m = new Map<K, number>();
    for (const t of tasks) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
    return [...m].map(([k, c]) => ({ k, c }));
  };
  return {
    stats: taskStats(tasks, now), kpis: taskKpis(tasks, now), rows, teams,
    top: ranked.slice(0, 5), bottom: ranked.slice(-3).reverse(),
    topTeams: [...teams].filter((t) => t.score != null).sort((a, b) => (b.score as number) - (a.score as number)),
    trend: trend(tasks, range, now),
    byType: count((t) => t.type).map(({ k, c }) => ({ type: k, count: c })),
    byPriority: count((t) => t.priority).map(({ k, c }) => ({ priority: k, count: c })),
    overdueTasks: tasks.filter((t) => isOverdue(t, now)).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime()).map((t) => ({ ...t, assignee: byId.get(t.assigneeId)! })),
  };
}

export type Alert = { id: string; tone: "danger" | "warning" | "info"; text: string };

/** Things the CEO should notice, derived from the same data. */
export function executiveAlerts(ds: Dataset, work: WorkBlock, sales: SalesSummary, now: Date): Alert[] {
  const alerts: Alert[] = [];
  if (work.stats.overdue > 0) {
    const worst = [...work.rows].sort((a, b) => b.stats.overdue - a.stats.overdue)[0];
    alerts.push({ id: "overdue", tone: "danger", text: `${work.stats.overdue} tasks are overdue${worst && worst.stats.overdue ? `, most with ${worst.person.name} (${worst.stats.overdue})` : ""}.` });
  }
  if (work.stats.awaitingReview > 0) alerts.push({ id: "review", tone: "warning", text: `${work.stats.awaitingReview} submissions are waiting for a manager to approve.` });
  if (sales.staleDeals.length) {
    const atRisk = Math.round(sales.staleDeals.reduce((a, o) => a + o.value, 0) / 1000);
    alerts.push({ id: "stale", tone: "warning", text: `${sales.staleDeals.length} open deals have had no activity for ${STALE_DAYS}+ days ($${atRisk}k at risk).` });
  }
  const broken = ds.integrations.filter((i) => i.status !== "healthy");
  if (broken.length) alerts.push({ id: "integrations", tone: broken.some((b) => b.status === "error") ? "danger" : "warning", text: `${broken.map((b) => b.name).join(" and ")} ${broken.length > 1 ? "need" : "needs"} attention.` });
  if (ds.exportRequests.length) alerts.push({ id: "exports", tone: "info", text: `${ds.exportRequests.length} export requests are waiting for your approval.` });
  void now;
  return alerts;
}

export type AdminSummary = {
  total: number; active: number; suspended: number; employees: number; activeEmployees: number;
  byRole: { role: string; count: number }[]; byDepartment: { department: string; count: number }[];
  pending: { exports: number; invitations: number; reviews: number; total: number };
};

export function adminSummary(ds: Dataset, now: Date): AdminSummary {
  const count = (key: (p: Person) => string) => {
    const m = new Map<string, number>();
    for (const p of ds.people) m.set(key(p), (m.get(key(p)) ?? 0) + 1);
    return [...m].map(([k, c]) => ({ k, c }));
  };
  const reviews = ds.tasks.filter((t) => t.status === "verified").length;
  void now;
  return {
    total: ds.people.length, active: ds.people.filter((p) => p.status === "active").length, suspended: ds.people.filter((p) => p.status === "suspended").length,
    employees: ds.people.filter(isEmployee).length, activeEmployees: ds.people.filter((p) => isEmployee(p) && p.status === "active").length,
    byRole: count((p) => p.role).map(({ k, c }) => ({ role: k, count: c })),
    byDepartment: count((p) => p.department).map(({ k, c }) => ({ department: k, count: c })),
    pending: { exports: ds.exportRequests.length, invitations: ds.invitations.length, reviews, total: ds.exportRequests.length + ds.invitations.length + reviews },
  };
}

/** A person's own to-do list: what is still on their plate (soonest deadline first), and what they finished recently. */
export function personalTasks(ds: Dataset, personId: string, now: Date) {
  const mine = ds.tasks.filter((t) => t.assigneeId === personId);
  const open = mine.filter((t) => t.status !== "approved" && t.status !== "rejected").sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const recent = mine.filter((t) => t.completedAt && t.completedAt.getTime() <= now.getTime()).sort((a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime());
  return { open, recent };
}
