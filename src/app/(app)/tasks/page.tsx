import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui/page-header";
import { Stat, StatGroup } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button-variants";
import { FlagBadges, StatusBadge, formatDue } from "@/components/tasks/bits";
import { AutoRefresh } from "@/components/tasks/auto-refresh";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { flagsFor, PRIORITY_LABEL, SOON_MS, TASK_LABEL } from "@/lib/assignments";

export const metadata: Metadata = { title: "Assignments" };
export const dynamic = "force-dynamic";

const LIMIT = 200;
const VIEWS = ["all", "review", "overdue", "missing", "mine"] as const;
type View = (typeof VIEWS)[number];

export default async function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const me = await requireUser();
  if (!can(me.role, "assignments.read")) redirect("/");
  const manager = can(me.role, "assignments.manage");
  const requested = typeof searchParams.view === "string" ? (searchParams.view as View) : undefined;
  const view: View = !manager ? "mine" : requested && VIEWS.includes(requested) ? requested : "all";

  const now = new Date();
  const soon = new Date(now.getTime() + SOON_MS);
  const where: Record<View, Prisma.AssignmentWhereInput> = {
    all: {},
    mine: { assigneeId: me.userId },
    review: { status: "verified" },
    overdue: { status: { in: ["open", "in_progress"] }, dueAt: { lt: now } },
    missing: { status: { in: ["open", "in_progress"] }, requiresEvidence: true, evidence: { none: {} }, dueAt: { lte: soon } },
  };

  const data = await withScope(me.scope, async (tx) => {
    // Counts only what the caller can see (row-level security applies to every count).
    const [toDo, review, overdue, missing, total, rows, members] = await Promise.all([
      tx.assignment.count({ where: { status: { in: ["open", "in_progress"] } } }),
      tx.assignment.count({ where: { status: "verified" } }),
      tx.assignment.count({ where: where.overdue }),
      tx.assignment.count({ where: where.missing }),
      tx.assignment.count({ where: where[view] }),
      tx.assignment.findMany({
        where: where[view],
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: LIMIT,
        select: {
          id: true, title: true, taskType: true, priority: true, dueAt: true, status: true, requiresEvidence: true,
          recordType: true, recordId: true, assigneeId: true, _count: { select: { evidence: true } },
        },
      }),
      tx.workspaceMember.findMany({ where: { status: "active" }, select: { userId: true, fullName: true } }),
    ]);
    const contactIds = rows.filter((r) => r.recordType === "contact").map((r) => r.recordId);
    const accountIds = rows.filter((r) => r.recordType === "account").map((r) => r.recordId);
    const [contacts, accounts] = await Promise.all([
      contactIds.length ? tx.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true, fullName: true } }) : [],
      accountIds.length ? tx.account.findMany({ where: { id: { in: accountIds } }, select: { id: true, name: true } }) : [],
    ]);
    const recordName = new Map<string, string>([
      ...contacts.map((c) => [c.id, c.fullName] as const),
      ...accounts.map((a) => [a.id, a.name] as const),
    ]);
    const names = new Map(members.map((m) => [m.userId, m.fullName] as const));
    return { counts: { toDo, review, overdue, missing, total }, rows, recordName, names };
  });

  const link = (v: View) => (v === "all" ? "/tasks" : `/tasks?view=${v}`);
  const tabs: { id: View; label: string }[] = manager
    ? [
        { id: "all", label: "All" }, { id: "review", label: "Awaiting approval" },
        { id: "overdue", label: "Overdue" }, { id: "missing", label: "Missing evidence" }, { id: "mine", label: "Assigned to me" },
      ]
    : [{ id: "mine", label: "My work" }];

  return (
    <>
      <AutoRefresh />
      <PageHeader
        title="Assignments"
        subtitle={manager ? "Work given to the team, with evidence and approval." : "Work given to you, with what is due and what needs evidence."}
        icon={<ClipboardCheck />}
        actions={manager ? (
          <Link href="/tasks/new" className={buttonVariants({ variant: "default" })}><Plus />New assignment</Link>
        ) : undefined}
      />

      {manager && (
        <StatGroup className="mb-6">
          <Stat label="Open" value={data.counts.toDo.toLocaleString()} href="/tasks?view=all" />
          <Stat label="Awaiting approval" value={data.counts.review.toLocaleString()} href="/tasks?view=review" tone={data.counts.review ? "warning" : "neutral"} />
          <Stat label="Overdue" value={data.counts.overdue.toLocaleString()} href="/tasks?view=overdue" tone={data.counts.overdue ? "danger" : "neutral"} />
          <Stat label="Missing evidence" value={data.counts.missing.toLocaleString()} href="/tasks?view=missing" tone={data.counts.missing ? "warning" : "neutral"} />
        </StatGroup>
      )}

      <nav aria-label="Assignment views" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={link(t.id)}
            aria-current={view === t.id ? "page" : undefined}
            className={buttonVariants({ variant: view === t.id ? "secondary" : "ghost", size: "sm" })}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {data.rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck />}
            title={view === "all" ? "No assignments yet" : "Nothing here"}
            hint={manager ? "Give records to a person with New assignment." : "Work given to you will show up here."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => {
                const flags = flagsFor({ status: r.status, dueAt: r.dueAt, requiresEvidence: r.requiresEvidence, evidenceCount: r._count.evidence }, now);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/tasks/${r.id}`} className="font-medium text-brand-text hover:underline">{r.title}</Link>
                      <div className="text-caption text-muted-foreground">{TASK_LABEL[r.taskType]}</div>
                    </TableCell>
                    <TableCell className="text-footnote">{data.recordName.get(r.recordId) ?? "Record you cannot see"}</TableCell>
                    <TableCell className="text-footnote">{data.names.get(r.assigneeId) ?? "Former member"}</TableCell>
                    <TableCell className="text-footnote tabular-nums">{formatDue(r.dueAt)}</TableCell>
                    <TableCell className="text-footnote">{PRIORITY_LABEL[r.priority]}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell><FlagBadges flags={flags} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      {data.counts.total > data.rows.length && (
        <p className="mt-3 text-footnote text-muted-foreground">
          Showing the first {data.rows.length.toLocaleString()} of {data.counts.total.toLocaleString()}. Narrow with the views above.
        </p>
      )}
    </>
  );
}
