import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { DateFilter, DemoBanner, ViewTabs } from "@/components/dashboard/parts";
import { AdminView, ExecutiveView, PersonalView, SalesView, TeamView } from "@/components/dashboard/views";
import { requireUser } from "@/lib/session";
import { allowedViews, resolveView, resolveViewer, visibilityFor, type DashboardView } from "@/lib/dashboard/access";
import { adminSummary, activityFeed, attainment, executiveAlerts, personalTasks, salesSummary, workBlock } from "@/lib/dashboard/metrics";
import { parseRange, rangeFor } from "@/lib/dashboard/range";
import { getDataset } from "@/lib/dashboard/source";

export const metadata: Metadata = { title: "Dashboard" };

const SUBTITLE: Record<DashboardView, string> = {
  executive: "Organisation-wide performance, KPIs and what needs your attention.",
  admin: "Users, access, approvals and system activity.",
  sales: "Pipeline, targets and follow-ups.",
  team: "How your team is doing: tasks, progress and workload.",
  personal: "Your tasks, deadlines and KPIs.",
};

// Dashboards are role-specific. The signed-in role decides which views exist and whose numbers feed them
// (src/lib/dashboard/access.ts); a "?view=" the role may not open falls back to its own default. Numbers are demo
// data for now (src/lib/dashboard/source.ts) and the page says so.
export default async function DashboardPage({ searchParams }: { searchParams: { view?: string; range?: string } }) {
  const user = await requireUser();
  const now = new Date();
  const ds = getDataset(now);

  if (!ds) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Team activity, assignments and pipeline in one place." icon={<LayoutDashboard />} />
        <Card><CardContent className="pt-5"><EmptyState title="No data yet" hint="Dashboards fill in as real records, assignments and deals are added." /></CardContent></Card>
      </>
    );
  }

  const persona = resolveViewer(ds, user);
  const views = allowedViews(user.role, persona);
  const view = resolveView(user.role, persona, searchParams.view);
  const range = rangeFor(parseRange(searchParams.range), now);
  const vis = visibilityFor(ds, persona);
  const sellerIds = new Set(ds.people.filter((p) => vis.ids.has(p.id) && p.role === "sales_bd").map((p) => p.id));

  let body: React.ReactNode;
  let scopeText: string;

  if (view === "executive") {
    const work = workBlock(ds, vis.ids, range, now);
    const sales = salesSummary(ds, sellerIds, range, now);
    body = <ExecutiveView ds={ds} work={work} sales={sales} admin={adminSummary(ds, now)} alerts={executiveAlerts(ds, work, sales, now)} feed={activityFeed(ds, vis.ids, now, 8)} range={range} now={now} />;
    scopeText = "the whole organisation";
  } else if (view === "admin") {
    body = <AdminView ds={ds} admin={adminSummary(ds, now)} work={workBlock(ds, vis.ids, range, now)} now={now} />;
    scopeText = "the whole organisation";
  } else if (view === "sales") {
    const sales = salesSummary(ds, sellerIds, range, now);
    const teamMates = new Set(ds.people.filter((p) => p.role === "sales_bd" && p.teamId === persona.teamId && p.status === "active").map((p) => p.id));
    body = (
      <SalesView ds={ds} sales={sales} work={workBlock(ds, sellerIds, range, now)} range={range} now={now} feed={activityFeed(ds, sellerIds, now, 8)}
        scope={vis.scope} teamAverage={vis.scope === "self" ? attainment(ds, teamMates, now).month.rate : null} />
    );
    scopeText = vis.scope === "org" ? "all sales staff" : vis.scope === "team" ? "your sales team" : "your own deals and work";
  } else if (view === "team") {
    const team = ds.teams.find((t) => t.id === persona.teamId);
    body = <TeamView work={workBlock(ds, vis.ids, range, now)} feed={activityFeed(ds, vis.ids, now, 8)} range={range} now={now} team={team?.name ?? "Your team"} />;
    scopeText = "your team";
  } else {
    const mine = new Set([persona.id]);
    const { open, recent } = personalTasks(ds, persona.id, now);
    body = <PersonalView person={persona} work={workBlock(ds, mine, range, now)} open={open} recent={recent} range={range} feed={activityFeed(ds, mine, now, 6)} now={now} />;
    scopeText = "your own work";
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle={SUBTITLE[view]} icon={<LayoutDashboard />} actions={<DateFilter range={range.key} view={view} defaultView={views[0]} />} />
      <DemoBanner persona={persona} scope={scopeText} />
      <ViewTabs views={views} view={view} range={range.key} />
      {body}
    </>
  );
}
