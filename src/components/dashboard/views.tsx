// The five dashboards. Each one receives numbers already computed (and already limited to what the viewer may see) by
// src/lib/dashboard/metrics.ts, so nothing here decides who sees what; it only lays the numbers out.
import {
  AlertTriangle, BadgeDollarSign, CalendarClock, CheckCircle2, ClipboardCheck, Clock, Gauge, Handshake, Target, TrendingUp, UserCheck, Users, Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Stat, StatGroup } from "@/components/ui/stat";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, NUMERIC } from "@/components/ui/table";
import { cn } from "@/components/ui/cn";
import { BarRows, Donut, Legend, Meter, MonthlyBars, StackedRows, TrendChart, toneForRate, toneForScore, type Tone } from "@/components/dashboard/charts";
import { Feed, PerformanceTable, Panel, PersonCell, SCORE_NOTE, ScoreCell, StatusPill } from "@/components/dashboard/parts";
import { dueLabel, money, moneyFull, pct, ago } from "@/lib/dashboard/format";
import { TASK_LABEL, PRIORITY_LABEL, STATUS_LABEL, flagsFor, type TaskType, type Priority } from "@/lib/assignments";
import { ROLE_LABEL } from "@/lib/permissions";
import { STAGE_LABEL } from "@/lib/demo/dataset";
import type { Dataset, Person, Task } from "@/lib/demo/dataset";
import type { AdminSummary, Alert, FeedItem, SalesSummary, WorkBlock } from "@/lib/dashboard/metrics";
import type { Range } from "@/lib/dashboard/range";

const TASK_SEGMENTS = (s: WorkBlock["stats"]) => [
  { label: "Completed", value: s.completed, tone: "success" as const },
  { label: "Pending", value: s.pending, tone: "brand" as const },
  { label: "Overdue", value: s.overdue, tone: "danger" as const },
];

// ───────────────────────────── shared sections ─────────────────────────────

function TaskTiles({ work, label }: { work: WorkBlock; label: string }) {
  const s = work.stats, k = work.kpis;
  return (
    <StatGroup className="xl:grid-cols-5">
      <Stat label="Assigned" value={s.assigned} icon={<ClipboardCheck />} accent="blue" hint={label} />
      <Stat label="Completed" value={s.completed} tone="success" icon={<CheckCircle2 />} accent="emerald" hint={`${pct(s.assigned ? s.completed / s.assigned : null)} of assigned`} isZero={s.completed === 0} />
      <Stat label="Pending" value={s.pending} icon={<Clock />} accent="sky" hint={`${s.awaitingReview} awaiting approval`} isZero={s.pending === 0} />
      <Stat label="Overdue" value={s.overdue} tone={s.overdue ? "danger" : "neutral"} icon={<AlertTriangle />} accent="rose" hint={s.overdue ? "Past deadline, not submitted" : "Nothing overdue"} isZero={s.overdue === 0} />
      <Stat label="On-time completion" value={pct(k.onTimeRate)} tone={k.onTimeRate == null ? "neutral" : k.onTimeRate >= 0.8 ? "success" : "warning"} icon={<Gauge />} accent="violet" hint={k.dueSoFar ? `${k.dueSoFar} tasks due so far` : "Nothing due yet"} />
    </StatGroup>
  );
}

function TrendPanel({ work, range }: { work: WorkBlock; range: Range }) {
  return (
    <Panel title="Tasks over time" description={range.key === "today" ? "Last 7 days, for context" : range.label}
      right={<Legend items={[{ label: "Completed", tone: "brand" }, { label: "Due", tone: "muted" }]} />}>
      <TrendChart points={work.trend} />
    </Panel>
  );
}

function StatusPanel({ work }: { work: WorkBlock }) {
  const s = work.stats;
  return (
    <Panel title="Task status" description="Where every assigned task stands">
      {s.assigned === 0 ? <EmptyState title="No tasks in this period" size="sm" /> : (
        <div className="flex flex-wrap items-center gap-6">
          <Donut slices={TASK_SEGMENTS(s)} center={s.assigned} sub="tasks" />
          <div className="min-w-[10rem] flex-1 space-y-2.5">
            <Legend items={TASK_SEGMENTS(s).map((x) => ({ label: x.label, tone: x.tone, value: x.value }))} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption text-muted-foreground">
              <dt>Not started</dt><dd className="text-right tabular-nums text-foreground">{s.notStarted}</dd>
              <dt>In progress</dt><dd className="text-right tabular-nums text-foreground">{s.inProgress}</dd>
              <dt>Awaiting approval</dt><dd className="text-right tabular-nums text-foreground">{s.awaitingReview}</dd>
              <dt>On hold</dt><dd className="text-right tabular-nums text-foreground">{s.onHold}</dd>
              <dt>Rejected</dt><dd className="text-right tabular-nums text-foreground">{s.rejected}</dd>
            </dl>
          </div>
        </div>
      )}
    </Panel>
  );
}

function WorkloadPanel({ work }: { work: WorkBlock }) {
  const rows = [...work.rows].filter((r) => r.person.status === "active").sort((a, b) => b.load - a.load).slice(0, 10);
  return (
    <Panel title="Workload" description="Work still on each person's plate today, whatever the date filter">
      {rows.length === 0 ? <EmptyState title="No open work" size="sm" /> : (
        <>
          <StackedRows rows={rows.map((r) => ({
            label: r.person.name, segments: [
              { label: "On track", value: r.load - r.loadOverdue, tone: "brand" },
              { label: "Overdue", value: r.loadOverdue, tone: "danger" },
            ],
          }))} />
          <div className="mt-3"><Legend items={[{ label: "On track", tone: "brand" }, { label: "Overdue", tone: "danger" }]} /></div>
        </>
      )}
    </Panel>
  );
}

function Leaderboard({ work }: { work: WorkBlock }) {
  return (
    <Panel title="Top performers" description="Highest overall score in this period">
      {work.top.length === 0 ? <EmptyState title="Not enough finished work yet" hint="Scores appear once at least 3 tasks are due." size="sm" /> : (
        <ol className="space-y-3">
          {work.top.map((r, i) => (
            <li key={r.person.id} className="flex items-center gap-3">
              <span className="w-4 text-caption font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1"><PersonCell name={r.person.name} sub={r.person.title} /></span>
              <ScoreCell score={r.score} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function TeamsPanel({ work }: { work: WorkBlock }) {
  return (
    <Panel title="Teams" description="Task results and score by team">
      <div className="space-y-4">
        {work.topTeams.length === 0 && <EmptyState title="Not enough finished work yet" size="sm" />}
        {work.topTeams.map((t) => (
          <div key={t.team.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-footnote">
              <span className="font-medium text-foreground">{t.team.name} <span className="font-normal text-muted-foreground">· {t.manager.name}</span></span>
              <span className="font-semibold tabular-nums">{t.score}</span>
            </div>
            <Meter value={(t.score ?? 0) / 100} tone={toneForScore(t.score)} label={`${t.team.name} score`} />
            <p className="text-caption text-muted-foreground">
              {t.activeMembers} active · {t.stats.assigned} assigned · {t.stats.completed} done · <span className={cn(t.stats.overdue && "text-destructive")}>{t.stats.overdue} overdue</span>
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MixPanel({ work }: { work: WorkBlock }) {
  const types = work.byType.sort((a, b) => b.count - a.count).map((t) => ({ label: TASK_LABEL[t.type as TaskType], value: t.count }));
  const order: Priority[] = ["urgent", "high", "normal", "low"];
  const tone: Record<Priority, Tone> = { urgent: "danger", high: "warning", normal: "brand", low: "muted" };
  return (
    <Panel title="What the work is" description="By task type and priority">
      <BarRows rows={types} />
      <div className="mt-4 border-t border-border/70 pt-3">
        <Legend items={order.map((p) => ({ label: PRIORITY_LABEL[p], tone: tone[p], value: work.byPriority.find((x) => x.priority === p)?.count ?? 0 }))} />
      </div>
    </Panel>
  );
}

function OverduePanel({ work, limit = 6 }: { work: WorkBlock; limit?: number }) {
  const rows = work.overdueTasks.slice(0, limit);
  return (
    <Panel title="Overdue tasks" description={work.overdueTasks.length ? `${work.overdueTasks.length} past their deadline, oldest first` : undefined}>
      {rows.length === 0 ? <EmptyState title="Nothing is overdue" hint="Everything due so far has been handled." size="sm" /> : (
        <ul className="divide-y divide-border/70">
          {rows.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-footnote font-medium text-foreground">{t.title}</p>
                <p className="truncate text-caption text-muted-foreground">{t.assignee.name} · {TASK_LABEL[t.type]} · due {dueLabel(t.dueAt)}</p>
              </div>
              <Badge variant="destructive">Overdue</Badge>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ───────────────────────────── 1. CEO / executive ─────────────────────────────

export function ExecutiveView(p: { ds: Dataset; work: WorkBlock; sales: SalesSummary; admin: AdminSummary; alerts: Alert[]; feed: FeedItem[]; range: Range; now: Date }) {
  const { work, sales, admin, alerts, feed, range, now } = p;
  const sellers = work.rows.filter((r) => r.person.role === "sales_bd");
  const att = sales.attainment.quarter;
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="Organisation" context={`${admin.employees} employees across ${work.teams.length} teams, ${range.label.toLowerCase()}`} />
        <StatGroup className="xl:grid-cols-4">
          <Stat label="Total people" value={admin.total} icon={<Users />} accent="blue" hint={`${admin.employees} employees, ${admin.total - admin.employees} leaders and admins`} />
          <Stat label="Active" value={admin.active} tone="success" icon={<UserCheck />} accent="emerald" hint={`${admin.suspended} suspended`} />
          <Stat label="Task completion" value={pct(work.kpis.completionRate)} icon={<Gauge />} accent="violet" tone={work.kpis.completionRate != null && work.kpis.completionRate >= 0.8 ? "success" : "warning"} hint="Of work already due" />
          <Stat label="Quarter revenue" value={money(att.won)} icon={<BadgeDollarSign />} accent="sky" hint={`${pct(att.rate)} of ${money(att.target)} target`} />
        </StatGroup>
      </section>

      <section>
        <SectionHeader title="Tasks" context="Assigned, completed, pending and overdue across the organisation" />
        <TaskTiles work={work} label={range.label} />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><TrendPanel work={work} range={range} /></div>
          <StatusPanel work={work} />
        </div>
      </section>

      <section>
        <SectionHeader title="Performance" context="Employees and teams ranked on the same score" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Leaderboard work={work} />
          <TeamsPanel work={work} />
          <Panel title="Needs attention" description="Alerts from across the organisation">
            {alerts.length === 0 ? <EmptyState title="All clear" size="sm" /> : (
              <ul className="space-y-2.5">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-footnote">
                    <AlertTriangle aria-hidden className={cn("mt-0.5 size-4 shrink-0", a.tone === "danger" ? "text-destructive" : a.tone === "warning" ? "text-warning" : "text-brand-text")} />
                    <span className="text-foreground">{a.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="mt-4">
          <SectionHeader title="All employees" context={SCORE_NOTE} className="pb-2" />
          <PerformanceTable rows={work.rows} showTeam />
        </div>
      </section>

      <section>
        <SectionHeader title="Sales snapshot" context="Revenue against target and pipeline; open the Sales tab for the detail" />
        <StatGroup className="xl:grid-cols-4">
          <Stat label="Pipeline value" value={money(sales.pipelineValue)} icon={<Workflow />} accent="blue" hint={`${sales.openDeals} open deals · ${money(sales.weightedValue)} weighted`} />
          <Stat label="Won this period" value={money(sales.won.value)} tone="success" icon={<Handshake />} accent="emerald" hint={`${sales.won.count} deals`} isZero={sales.won.count === 0} />
          <Stat label="Win rate" value={pct(sales.winRate)} icon={<TrendingUp />} accent="violet" hint={`${sales.won.count} won, ${sales.lost.count} lost`} />
          <Stat label="Sellers on pace" value={`${sellers.filter((r) => (r.month?.pace ?? 0) >= 1).length}/${sellers.filter((r) => r.person.status === "active").length}`} icon={<Target />} accent="amber" hint="Meeting this month's target pace" />
        </StatGroup>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><WorkloadPanel work={work} /></div>
        <MixPanel work={work} />
        <div className="lg:col-span-2"><OverduePanel work={work} /></div>
        <Panel title="Recent activity" description="Across the organisation, last 14 days"><Feed items={feed} now={now} /></Panel>
      </section>
    </div>
  );
}

// ───────────────────────────── 2. Admin ─────────────────────────────

export function AdminView({ ds, admin, work, now }: { ds: Dataset; admin: AdminSummary; work: WorkBlock; now: Date }) {
  const byId = new Map(ds.people.map((p) => [p.id, p]));
  const roleRows = admin.byRole.map((r) => ({ label: ROLE_LABEL[r.role as Person["role"]], value: r.count }));
  const dept = admin.byDepartment.sort((a, b) => b.count - a.count).map((d) => ({ label: d.department, value: d.count }));
  const s = work.stats;
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="People" context="Accounts in this workspace" />
        <StatGroup className="xl:grid-cols-4">
          <Stat label="Total users" value={admin.total} icon={<Users />} accent="blue" hint={`${admin.employees} employees`} />
          <Stat label="Active" value={admin.active} tone="success" icon={<UserCheck />} accent="emerald" hint={`${pct(admin.active / admin.total)} of users`} />
          <Stat label="Suspended" value={admin.suspended} icon={<AlertTriangle />} accent="amber" hint="Locked out immediately" isZero={admin.suspended === 0} />
          <Stat label="Pending actions" value={admin.pending.total} tone={admin.pending.total ? "warning" : "neutral"} icon={<ClipboardCheck />} accent="rose" hint={`${admin.pending.reviews} reviews · ${admin.pending.exports} exports · ${admin.pending.invitations} invites`} isZero={admin.pending.total === 0} />
        </StatGroup>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Roles" description="How access is distributed"><BarRows rows={roleRows} /></Panel>
        <Panel title="Departments" description="People by department"><BarRows rows={dept.map((d) => ({ ...d, tone: "violet" as const }))} /></Panel>
        <Panel title="Tasks overview" description="Organisation-wide, this period">
          <div className="flex flex-wrap items-center gap-5">
            <Donut slices={TASK_SEGMENTS(s)} center={s.assigned} sub="tasks" size={116} />
            <Legend items={TASK_SEGMENTS(s).map((x) => ({ label: x.label, tone: x.tone, value: x.value }))} />
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Pending approvals" description="Waiting on an administrator or manager">
          <ul className="divide-y divide-border/70">
            {ds.exportRequests.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-footnote font-medium text-foreground">Export: {e.dataset}</p>
                  <p className="truncate text-caption text-muted-foreground">{byId.get(e.requestedById)?.name} · {e.rows.toLocaleString("en-US")} rows · {ago(e.requestedAt, now)}</p>
                </div>
                <Badge variant="warning">Needs approval</Badge>
              </li>
            ))}
            {ds.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-footnote font-medium text-foreground">Invitation: {i.email}</p>
                  <p className="truncate text-caption text-muted-foreground">{ROLE_LABEL[i.role]} · sent {ago(i.sentAt, now)}</p>
                </div>
                <Badge variant="secondary">Not accepted</Badge>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 pt-2.5">
              <div>
                <p className="text-footnote font-medium text-foreground">Work awaiting manager review</p>
                <p className="text-caption text-muted-foreground">Submitted and passed the system checks</p>
              </div>
              <Badge variant="warning">{admin.pending.reviews}</Badge>
            </li>
          </ul>
        </Panel>

        <Panel title="Integration health" description="Last successful synchronisation">
          <ul className="divide-y divide-border/70">
            {ds.integrations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-footnote font-medium text-foreground">{i.name}</p>
                  <p className="truncate text-caption text-muted-foreground">{i.note} · {ago(i.lastSyncAt, now)}</p>
                </div>
                <Badge variant={i.status === "healthy" ? "success" : i.status === "delayed" ? "warning" : "destructive"}>{i.status === "healthy" ? "Healthy" : i.status === "delayed" ? "Delayed" : "Error"}</Badge>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionHeader title="Users" className="pb-2" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="hidden md:table-cell">Reports to</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ds.people.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="first:pl-4"><PersonCell name={u.name} sub={u.title} /></TableCell>
                  <TableCell className="text-footnote">{ROLE_LABEL[u.role]}</TableCell>
                  <TableCell className="hidden text-footnote md:table-cell">{u.department}</TableCell>
                  <TableCell className="hidden text-footnote md:table-cell">{u.managerId ? byId.get(u.managerId)?.name : "—"}</TableCell>
                  <TableCell className="last:pr-4"><StatusPill status={u.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Panel title="Recent system activity" description="Administrative actions">
          <ul className="space-y-3">
            {ds.systemEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 text-footnote">
                <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.kind === "security" || e.kind === "integration" ? "bg-warning" : e.kind === "approval" ? "bg-success" : "bg-brand")} />
                <p className="min-w-0 flex-1 text-muted-foreground"><span className="font-medium text-foreground">{byId.get(e.actorId)?.name}</span> {e.text}</p>
                <time className="shrink-0 text-caption text-tertiary" dateTime={e.at.toISOString()}>{ago(e.at, now)}</time>
              </li>
            ))}
          </ul>
        </Panel>
      </section>
    </div>
  );
}

// ───────────────────────────── 3. Sales / BD ─────────────────────────────

export function SalesView(p: {
  ds: Dataset; sales: SalesSummary; work: WorkBlock; range: Range; now: Date; feed: FeedItem[];
  /** "self": one person (no names of colleagues). "team" and "org": a table of people. */
  scope: "self" | "team" | "org"; teamAverage?: number | null;
}) {
  const { sales, work, range, now, feed, scope } = p;
  const m = sales.attainment.month, q = sales.attainment.quarter;
  const sellers = work.rows.filter((r) => r.person.role === "sales_bd");
  const max = Math.max(1, ...sales.stages.filter((s) => !["won", "lost"].includes(s.stage)).map((s) => s.value));
  const funnel = sales.stages.filter((s) => !["won", "lost"].includes(s.stage));
  const byId = new Map(p.ds.people.map((x) => [x.id, x]));
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="Targets" context="Revenue won against the monthly and quarterly target; the tick shows where you should be today" />
        <div className="grid gap-4 md:grid-cols-2">
          {([["This month", m], ["This quarter", q]] as const).map(([label, a]) => (
            <Panel key={label} title={label} description={`${moneyFull(a.won)} won of ${moneyFull(a.target)}`}
              right={<Badge variant={a.pace == null ? "secondary" : a.pace >= 1 ? "success" : a.pace >= 0.8 ? "warning" : "destructive"}>{a.pace == null ? "No target" : a.pace >= 1 ? "On pace" : a.pace >= 0.8 ? "Slightly behind" : "Behind pace"}</Badge>}>
              <div className="flex items-end justify-between pb-2">
                <span className="text-kpi font-semibold tabular-nums">{pct(a.rate)}</span>
                <span className="text-caption text-muted-foreground">{money(Math.max(0, a.target - a.won))} to go · expected by today {money(a.expected)}</span>
              </div>
              <Meter value={a.rate ?? 0} marker={a.target ? a.expected / a.target : undefined} tone={toneForRate(a.pace)} label={`${label} attainment`} className="h-2.5" />
            </Panel>
          ))}
        </div>
        {scope === "self" && p.teamAverage != null && (
          <p className="mt-2 text-footnote text-muted-foreground">Your team is at {pct(p.teamAverage)} of its monthly target on average. Colleagues&apos; individual figures are visible to managers only.</p>
        )}
      </section>

      <section>
        <SectionHeader title="Pipeline" context={`Open deals now; leads and results for ${range.label.toLowerCase()}`} />
        <StatGroup className="xl:grid-cols-5">
          <Stat label="Leads added" value={sales.leads} icon={<Users />} accent="blue" hint={`${pct(sales.leadToQualified)} became qualified`} isZero={sales.leads === 0} />
          <Stat label="Open deals" value={sales.openDeals} icon={<Workflow />} accent="sky" hint={`${sales.staleDeals.length} stale (14+ days quiet)`} isZero={sales.openDeals === 0} />
          <Stat label="Pipeline value" value={money(sales.pipelineValue)} icon={<BadgeDollarSign />} accent="violet" hint={`${money(sales.weightedValue)} weighted by stage`} isZero={sales.pipelineValue === 0} />
          <Stat label="Won" value={sales.won.count} tone="success" icon={<Handshake />} accent="emerald" hint={`${money(sales.won.value)} · avg ${sales.avgDeal ? money(sales.avgDeal) : "—"}`} isZero={sales.won.count === 0} />
          <Stat label="Win rate" value={pct(sales.winRate)} icon={<TrendingUp />} accent="amber" hint={`${sales.won.count} won, ${sales.lost.count} lost`} />
        </StatGroup>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel title="Open pipeline by stage" description="Value in each stage" className="lg:col-span-2">
            <ul className="space-y-2.5">
              {funnel.map((s) => (
                <li key={s.stage} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-footnote">
                  <span className="text-foreground">{STAGE_LABEL[s.stage]} <span className="text-muted-foreground">({s.count})</span></span>
                  <span className="h-6 rounded-md bg-muted"><span className="flex h-full items-center rounded-md bg-brand px-2 text-caption font-medium text-white" style={{ width: `${Math.max(8, (s.value / max) * 100)}%` }} /></span>
                  <span className="min-w-[4.5rem] text-right font-medium tabular-nums">{money(s.value)}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Leads" description={range.label}>
            <BarRows rows={(["new", "researching", "contacted", "engaged", "qualified", "disqualified"] as const).map((k) => ({
              label: k[0].toUpperCase() + k.slice(1), value: sales.leadsByStatus[k], tone: k === "qualified" ? "success" : k === "disqualified" ? "muted" : "brand",
            }))} />
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue by month" description="Won against target, last 4 months" className="lg:col-span-2">
          <MonthlyBars data={sales.monthly} fmt={money} />
          <p className="mt-2 text-caption text-muted-foreground">Dashed line is the target.</p>
        </Panel>
        <Panel title="Why deals were lost" description={range.label}>
          {sales.lostReasons.length === 0 ? <EmptyState title="No lost deals" size="sm" /> : <BarRows rows={sales.lostReasons.map((r) => ({ label: r.reason, value: r.count, tone: "warning" }))} />}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Follow-ups" description="Open follow-ups, soonest first" className="lg:col-span-2"
          right={<div className="flex gap-1.5"><Badge variant={sales.followUps.overdue ? "destructive" : "secondary"}>{sales.followUps.overdue} overdue</Badge><Badge variant="warning">{sales.followUps.dueToday} today</Badge><Badge variant="secondary">{sales.followUps.next7} next 7 days</Badge></div>}>
          {sales.followUps.open.length === 0 ? <EmptyState title="No follow-ups waiting" size="sm" /> : (
            <ul className="divide-y divide-border/70">
              {sales.followUps.open.slice(0, 7).map((f) => {
                const late = f.dueAt.getTime() < now.getTime();
                return (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-footnote font-medium text-foreground">{f.subject} · {f.company}</p>
                      <p className="truncate text-caption text-muted-foreground">{f.kind[0].toUpperCase() + f.kind.slice(1)} · {scope !== "self" ? `${byId.get(f.ownerId)?.name} · ` : ""}due {dueLabel(f.dueAt)}</p>
                    </div>
                    {late ? <Badge variant="destructive">Overdue</Badge> : <Badge variant="secondary"><CalendarClock /> {dueLabel(f.dueAt)}</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Recent activity" description="Deals and work, last 14 days"><Feed items={feed} now={now} /></Panel>
      </section>

      {scope !== "self" && (
        <section>
          <SectionHeader title="Sales team" context="Individual performance against each person's monthly target" className="pb-2" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead><TableHead className={NUMERIC}>Won (month)</TableHead><TableHead className={NUMERIC}>Target</TableHead>
                <TableHead className={NUMERIC}>Attained</TableHead><TableHead className={cn(NUMERIC, "hidden md:table-cell")}>Open pipeline</TableHead>
                <TableHead className={cn(NUMERIC, "hidden md:table-cell")}>Overdue tasks</TableHead><TableHead className={NUMERIC}>Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...sellers].sort((a, b) => (b.month?.rate ?? -1) - (a.month?.rate ?? -1)).map((r) => {
                const open = p.ds.opportunities.filter((o) => o.ownerId === r.person.id && ["qualified", "discovery", "proposal", "negotiation"].includes(o.stage)).reduce((a, o) => a + o.value, 0);
                const active = r.person.status === "active";
                return (
                  <TableRow key={r.person.id}>
                    <TableCell className="first:pl-4"><PersonCell name={r.person.name} sub={r.person.title} />{!active && <Badge variant="secondary" className="ml-2">Suspended</Badge>}</TableCell>
                    <TableCell className={NUMERIC}>{money(r.month?.won ?? 0)}</TableCell>
                    <TableCell className={NUMERIC}>{active ? money(r.month?.target ?? 0) : "—"}</TableCell>
                    <TableCell className={cn(NUMERIC, active && r.month?.pace != null && (r.month.pace >= 1 ? "text-success" : r.month.pace < 0.8 ? "text-destructive" : "text-warning"))}>{active ? pct(r.month?.rate) : "—"}</TableCell>
                    <TableCell className={cn(NUMERIC, "hidden md:table-cell")}>{money(open)}</TableCell>
                    <TableCell className={cn(NUMERIC, "hidden md:table-cell", r.stats.overdue > 0 && "text-destructive")}>{r.stats.overdue}</TableCell>
                    <TableCell className={cn(NUMERIC, "last:pr-4")}><ScoreCell score={r.score} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="mt-2 text-caption text-muted-foreground">{SCORE_NOTE}</p>
        </section>
      )}
    </div>
  );
}

// ───────────────────────────── 4a. Manager ─────────────────────────────

export function TeamView({ work, feed, range, now, team }: { work: WorkBlock; feed: FeedItem[]; range: Range; now: Date; team: string }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title={team} context={`${work.rows.filter((r) => r.person.status === "active").length} active people, ${range.label.toLowerCase()}`} />
        <TaskTiles work={work} label={range.label} />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><TrendPanel work={work} range={range} /></div>
          <StatusPanel work={work} />
        </div>
      </section>
      <section>
        <SectionHeader title="Employee progress" context={SCORE_NOTE} className="pb-2" />
        <PerformanceTable rows={work.rows} />
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><WorkloadPanel work={work} /></div>
        <Leaderboard work={work} />
        <div className="lg:col-span-2"><OverduePanel work={work} /></div>
        <Panel title="Team activity" description="Last 14 days"><Feed items={feed} now={now} /></Panel>
      </section>
    </div>
  );
}

// ───────────────────────────── 4b. Employee ─────────────────────────────

const PRIORITY_VARIANT = { urgent: "destructive", high: "warning", normal: "secondary", low: "secondary" } as const;

export function PersonalView({ person, work, open, recent, range, feed, now }: {
  person: Person; work: WorkBlock; open: Task[]; recent: Task[]; range: Range; feed: FeedItem[]; now: Date;
}) {
  const me = work.rows[0];
  const s = work.stats, k = work.kpis;
  const rate = s.assigned ? s.completed / s.assigned : null;
  const kpiRows: { label: string; value: number | null; hint: string }[] = [
    { label: "Completion", value: k.completionRate, hint: "Approved ÷ tasks due so far" },
    { label: "On time", value: k.onTimeRate, hint: "Submitted by the deadline" },
    { label: "Quality", value: k.qualityRate, hint: "Approved ÷ (approved + rejected)" },
  ];
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="My progress" context={`${person.title} · ${range.label.toLowerCase()}`} />
        <TaskTiles work={work} label={range.label} />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Panel title="Completion progress" description={`${s.completed} of ${s.assigned} tasks done`} className="lg:col-span-1">
            <p className="pb-2 text-kpi font-semibold tabular-nums">{pct(rate)}</p>
            <Meter value={rate ?? 0} tone={toneForRate(rate == null ? null : rate / 0.8)} label="Completion progress" className="h-2.5" />
            <div className="mt-4 flex items-center justify-between rounded-card-inner bg-muted p-3 text-footnote">
              <span className="text-muted-foreground">Overall score</span>
              <ScoreCell score={me?.score ?? null} />
            </div>
          </Panel>
          <Panel title="My KPIs" description="Measured on work already due" className="lg:col-span-2">
            {k.dueSoFar === 0 ? <EmptyState title="Nothing was due yet in this period" hint="Pick a longer period to see your KPIs." size="sm" /> : (
              <ul className="space-y-3.5">
                {kpiRows.map((r) => (
                  <li key={r.label} className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-footnote">
                      <span className="font-medium text-foreground">{r.label} <span className="font-normal text-muted-foreground">· {r.hint}</span></span>
                      <span className="font-semibold tabular-nums">{pct(r.value)}</span>
                    </div>
                    <Meter value={r.value ?? 0} tone={toneForRate(r.value)} label={r.label} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="My tasks" description={`${open.length} still to do, soonest deadline first`} className="lg:col-span-2">
          {open.length === 0 ? <EmptyState title="You are all caught up" size="sm" /> : (
            <ul className="divide-y divide-border/70">
              {open.slice(0, 8).map((t) => {
                const f = flagsFor({ status: t.status, dueAt: t.dueAt, requiresEvidence: t.requiresEvidence, evidenceCount: t.evidenceCount }, now);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-footnote font-medium text-foreground">{t.title}</p>
                      <p className="truncate text-caption text-muted-foreground">{TASK_LABEL[t.type]} · {STATUS_LABEL[t.status]} · due {dueLabel(t.dueAt)}</p>
                    </div>
                    <span className="flex shrink-0 gap-1">
                      {f.overdue ? <Badge variant="destructive">Overdue</Badge> : f.dueSoon ? <Badge variant="warning">Due soon</Badge> : null}
                      <Badge variant={PRIORITY_VARIANT[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Recently completed" description="Approved by your manager">
          {recent.length === 0 ? <EmptyState title="Nothing completed yet" size="sm" /> : (
            <ul className="space-y-3">
              {recent.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-footnote">
                  <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{t.title}</span>
                  <time className="shrink-0 text-caption text-tertiary" dateTime={(t.completedAt as Date).toISOString()}>{ago(t.completedAt as Date, now)}</time>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="lg:col-span-2"><TrendPanel work={work} range={range} /></div>
        <Panel title="My recent activity" description="Last 14 days"><Feed items={feed} now={now} /></Panel>
      </section>
    </div>
  );
}
