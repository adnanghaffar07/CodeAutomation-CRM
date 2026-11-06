import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FlagBadges, StatusBadge, formatDue } from "@/components/tasks/bits";
import { requireUser } from "@/lib/session";
import { withScope } from "@/lib/scope";
import { flagsFor, PRIORITY_LABEL, RECURRENCE_LABEL, TASK_LABEL } from "@/lib/assignments";

export const metadata: Metadata = { title: "Assignment batch" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: { params: { id: string } }) {
  const me = await requireUser();
  if (!UUID.test(params.id)) notFound();

  const data = await withScope(me.scope, async (tx) => {
    const batch = await tx.assignmentBatch.findUnique({ where: { id: params.id } });
    if (!batch) return null;
    // Only the assignments this caller can see (managers see all; others see their own).
    const items = await tx.assignment.findMany({
      where: { batchId: batch.id },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 500,
      select: {
        id: true, recordId: true, assigneeId: true, status: true, dueAt: true, requiresEvidence: true, _count: { select: { evidence: true } },
      },
    });
    const approved = await tx.assignment.count({ where: { batchId: batch.id, status: "approved" } });
    const members = await tx.workspaceMember.findMany({ select: { userId: true, fullName: true } });
    const contacts = batch.recordType === "contact"
      ? await tx.contact.findMany({ where: { id: { in: items.map((i) => i.recordId) } }, select: { id: true, fullName: true } })
      : [];
    const accounts = batch.recordType === "account"
      ? await tx.account.findMany({ where: { id: { in: items.map((i) => i.recordId) } }, select: { id: true, name: true } })
      : [];
    const recordName = new Map<string, string>([
      ...contacts.map((c) => [c.id, c.fullName] as const),
      ...accounts.map((a) => [a.id, a.name] as const),
    ]);
    return { batch, items, approved, names: new Map(members.map((m) => [m.userId, m.fullName] as const)), recordName };
  });
  if (!data) notFound();

  const { batch, items, approved, names, recordName } = data;
  const now = new Date();
  const target = batch.targetCount ?? null;
  const pct = target ? Math.min(100, Math.round((approved / target) * 100)) : 0;

  return (
    <>
      <PageHeader
        title={batch.title}
        subtitle={`${TASK_LABEL[batch.taskType]} · ${batch.recordType === "contact" ? "Contacts" : "Companies"} · ${PRIORITY_LABEL[batch.priority]} priority · Due ${formatDue(batch.dueAt)}`}
        icon={<ClipboardCheck />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Records in this batch</CardTitle></CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <EmptyState title="Nothing you can see here" hint="Assignments in this batch that are not yours are hidden." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Record</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <Link href={`/tasks/${i.id}`} className="font-medium text-brand-text hover:underline">
                            {recordName.get(i.recordId) ?? "Record you cannot see"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-footnote">{names.get(i.assigneeId) ?? "Former member"}</TableCell>
                        <TableCell className="text-footnote tabular-nums">{formatDue(i.dueAt)}</TableCell>
                        <TableCell><StatusBadge status={i.status} /></TableCell>
                        <TableCell>
                          <FlagBadges flags={flagsFor({ status: i.status, dueAt: i.dueAt, requiresEvidence: i.requiresEvidence, evidenceCount: i._count.evidence }, now)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {target && (
            <Card>
              <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-footnote tabular-nums">{approved.toLocaleString()} of {target.toLocaleString()} approved</p>
                <Progress value={pct} aria-label="Approved so far" />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-footnote">
              <p><span className="text-muted-foreground">Repeats: </span>{RECURRENCE_LABEL[batch.recurrence]}</p>
              <p><span className="text-muted-foreground">Evidence: </span>{batch.requiresEvidence ? "Required before submitting" : "Not required"}</p>
              {batch.instructions && (<div><div className="text-muted-foreground">Instructions</div><p className="whitespace-pre-line">{batch.instructions}</p></div>)}
              {batch.completionCriteria && (<div><div className="text-muted-foreground">Done when</div><p className="whitespace-pre-line">{batch.completionCriteria}</p></div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
