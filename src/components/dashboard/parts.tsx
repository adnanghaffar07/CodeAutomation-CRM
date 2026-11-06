// Shared pieces of the role dashboards. Server components, no state: the date filter and view tabs are plain links.
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shell/user-avatar";
import { cn } from "@/components/ui/cn";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, NUMERIC } from "@/components/ui/table";
import { Meter, toneForScore, TONE_BG } from "@/components/dashboard/charts";
import { RANGE_KEYS, RANGE_LABEL, type RangeKey } from "@/lib/dashboard/range";
import { VIEW_LABEL, type DashboardView } from "@/lib/dashboard/access";
import { ago, pct } from "@/lib/dashboard/format";
import { ROLE_LABEL } from "@/lib/permissions";
import type { FeedItem, PersonRow } from "@/lib/dashboard/metrics";
import type { Person } from "@/lib/demo/dataset";

export const href = (view: DashboardView, range: RangeKey, defaultView: DashboardView) =>
  `/?${view === defaultView ? "" : `view=${view}&`}range=${range}`;

const PILL = "inline-flex h-8 items-center rounded-control px-3 text-footnote font-medium transition-colors";

export function DateFilter({ range, view, defaultView }: { range: RangeKey; view: DashboardView; defaultView: DashboardView }) {
  return (
    <nav aria-label="Date range" className="inline-flex gap-0.5 rounded-card bg-muted p-0.5">
      {RANGE_KEYS.map((k) => (
        <Link key={k} href={href(view, k, defaultView)} aria-current={k === range ? "true" : undefined} scroll={false}
          className={cn(PILL, k === range ? "bg-card text-foreground shadow-e1" : "text-muted-foreground hover:text-foreground")}>
          {RANGE_LABEL[k]}
        </Link>
      ))}
    </nav>
  );
}

export function ViewTabs({ views, view, range }: { views: DashboardView[]; view: DashboardView; range: RangeKey }) {
  if (views.length < 2) return null;
  return (
    <nav aria-label="Dashboard view" className="mb-5 flex gap-1 border-b border-border">
      {views.map((v) => (
        <Link key={v} href={href(v, range, views[0])} aria-current={v === view ? "page" : undefined}
          className={cn("-mb-px border-b-2 px-3 py-2 text-footnote font-medium transition-colors", v === view ? "border-brand text-brand-text" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {VIEW_LABEL[v]}
        </Link>
      ))}
    </nav>
  );
}

/** Always shown: these numbers are generated, not real. Says whose view it is and how to replace the data. */
export function DemoBanner({ persona, scope }: { persona: Person; scope: string }) {
  return (
    <div role="note" className="mb-5 flex items-start gap-2.5 rounded-card bg-warning-tint px-3.5 py-2.5 text-footnote text-foreground">
      <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <p>
        <span className="font-semibold">Demo data.</span> Every figure on this page comes from a generated, fictional organisation so you can see how the dashboards work.
        You are viewing it as <span className="font-medium">{persona.name}</span> ({ROLE_LABEL[persona.role]}), showing {scope}. Real records are not mixed in.
      </p>
    </div>
  );
}

export function Panel({ title, description, right, children, className }: { title: string; description?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {right}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PersonCell({ name, sub, size = 24 }: { name: string; sub?: string; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <UserAvatar name={name} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-footnote font-medium text-foreground">{name}</span>
        {sub && <span className="block truncate text-caption text-muted-foreground">{sub}</span>}
      </span>
    </span>
  );
}

export function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-tertiary">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden w-14 sm:block"><Meter value={score / 100} tone={toneForScore(score)} label={`Score ${score}`} /></span>
      <span className="w-8 text-right font-semibold tabular-nums">{score}</span>
    </span>
  );
}

export function StatusPill({ status }: { status: "active" | "suspended" }) {
  return status === "active" ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Suspended</Badge>;
}

const FEED_DOT = { success: "success", info: "brand", warning: "warning", danger: "danger" } as const;

export function Feed({ items, now, empty = "Nothing has happened here recently." }: { items: FeedItem[]; now: Date; empty?: string }) {
  if (!items.length) return <EmptyState title="No recent activity" hint={empty} size="sm" />;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.id} className="flex items-start gap-2.5 text-footnote">
          <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_BG[FEED_DOT[i.tone]])} />
          <p className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">{i.actor.name}</span> {i.text}
          </p>
          <time className="shrink-0 text-caption text-tertiary" dateTime={i.at.toISOString()}>{ago(i.at, now)}</time>
        </li>
      ))}
    </ul>
  );
}

/** The employee performance table, shared by the CEO and manager dashboards. */
export function PerformanceTable({ rows, showTeam = false }: { rows: PersonRow[]; showTeam?: boolean }) {
  const sorted = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead className={NUMERIC}>Assigned</TableHead>
          <TableHead className={NUMERIC}>Done</TableHead>
          <TableHead className={NUMERIC}>Pending</TableHead>
          <TableHead className={NUMERIC}>Overdue</TableHead>
          <TableHead className={cn(NUMERIC, "hidden md:table-cell")}>On time</TableHead>
          <TableHead className={cn(NUMERIC, "hidden md:table-cell")}>Quality</TableHead>
          <TableHead className={NUMERIC}>Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r) => (
          <TableRow key={r.person.id}>
            <TableCell className="first:pl-4"><PersonCell name={r.person.name} sub={showTeam ? `${r.person.title}` : r.person.title} />{r.person.status === "suspended" && <Badge variant="secondary" className="ml-2">Suspended</Badge>}</TableCell>
            <TableCell className={NUMERIC}>{r.stats.assigned}</TableCell>
            <TableCell className={NUMERIC}>{r.stats.completed}</TableCell>
            <TableCell className={NUMERIC}>{r.stats.pending}</TableCell>
            <TableCell className={cn(NUMERIC, r.stats.overdue > 0 && "font-semibold text-destructive")}>{r.stats.overdue}</TableCell>
            <TableCell className={cn(NUMERIC, "hidden md:table-cell")}>{pct(r.kpis.onTimeRate)}</TableCell>
            <TableCell className={cn(NUMERIC, "hidden md:table-cell")}>{pct(r.kpis.qualityRate)}</TableCell>
            <TableCell className={cn(NUMERIC, "last:pr-4")}><ScoreCell score={r.score} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export const SCORE_NOTE = "Score: 40% completion, 30% on time, 30% quality, using work already due. Sales staff: half task score, half pace to their monthly target.";
