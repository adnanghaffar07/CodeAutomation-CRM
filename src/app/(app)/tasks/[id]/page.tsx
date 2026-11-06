import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AssignmentActions } from "@/components/tasks/assignment-actions";
import { EVENT_LABEL, FlagBadges, StatusBadge, formatDue, formatWhen } from "@/components/tasks/bits";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { RECURRENCE_LABEL, PRIORITY_LABEL, TASK_LABEL, flagsFor } from "@/lib/assignments";

export const metadata: Metadata = { title: "Assignment" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: { params: { id: string } }) {
  const me = await requireUser();
  if (!UUID.test(params.id)) notFound();

  const data = await withScope(me.scope, async (tx) => {
    // Row-level security decides whether this person can open it at all: managers, the assignee and the assigner.
    const a = await tx.assignment.findUnique({
      where: { id: params.id },
      include: {
        batch: { select: { title: true, instructions: true, completionCriteria: true, targetCount: true } },
        evidence: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, body: true, addedById: true, createdAt: true } },
        events: { orderBy: { createdAt: "desc" }, select: { id: true, action: true, comment: true, actorId: true, actorEmail: true, createdAt: true } },
      },
    });
    if (!a) return null;
    const [contact, account, members] = await Promise.all([
      a.recordType === "contact" ? tx.contact.findUnique({ where: { id: a.recordId }, select: { fullName: true } }) : null,
      a.recordType === "account" ? tx.account.findUnique({ where: { id: a.recordId }, select: { name: true } }) : null,
      tx.workspaceMember.findMany({ select: { userId: true, fullName: true, status: true } }),
    ]);
    const recordName = contact?.fullName ?? account?.name ?? null;
    return { a, recordName, members, names: new Map(members.map((m) => [m.userId, m.fullName] as const)) };
  });
  if (!data) notFound();

  const { a, recordName, members, names } = data;
  const now = new Date();
  const flags = flagsFor({ status: a.status, dueAt: a.dueAt, requiresEvidence: a.requiresEvidence, evidenceCount: a.evidence.length }, now);
  const isAssignee = a.assigneeId === me.userId;
  const isManager = can(me.role, "assignments.manage");
  const recordHref = a.recordType === "contact" ? `/contacts/${a.recordId}` : `/accounts/${a.recordId}`;
  // The last comment from a manager (return or reject, or an approval note). Work awaiting approval has none of its own.
  const decision = a.status !== "verified" ? a.decisionComment : null;

  return (
    <>
      <PageHeader
        title={a.title}
        subtitle={`${TASK_LABEL[a.taskType]} · ${recordName ?? "Record you cannot see"}`}
        icon={<ClipboardCheck />}
        breadcrumb={a.batchId ? <Link href={`/tasks/batch/${a.batchId}`} className="text-footnote text-brand-text hover:underline">Back to the batch</Link> : undefined}
        actions={<span className="inline-flex flex-wrap gap-2"><StatusBadge status={a.status} /><FlagBadges flags={flags} /></span>}
      />

      <div className="space-y-6">
        <AssignmentActions
          assignmentId={a.id}
          status={a.status}
          isAssignee={isAssignee}
          isManager={isManager}
          requiresEvidence={a.requiresEvidence}
          evidenceCount={a.evidence.length}
          repeating={a.recurrence !== "none"}
          currentAssigneeId={a.assigneeId}
          members={members.filter((m) => m.status === "active").map((m) => ({ userId: m.userId, fullName: m.fullName }))}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 text-footnote sm:grid-cols-2">
                <Field label="Record"><Link href={recordHref} className="text-brand-text hover:underline">{recordName ?? "Record you cannot see"}</Link></Field>
                <Field label="Assigned to">{names.get(a.assigneeId) ?? "Former member"}</Field>
                <Field label="Assigned by">{names.get(a.assignedById) ?? "Former member"}</Field>
                <Field label="Due">{formatDue(a.dueAt)}</Field>
                <Field label="Priority">{PRIORITY_LABEL[a.priority]}</Field>
                <Field label="Repeats">{RECURRENCE_LABEL[a.recurrence]}</Field>
                <Field label="Evidence">{a.requiresEvidence ? `Required (${a.evidence.length} added)` : "Not required"}</Field>
                {a.submittedAt && <Field label="Submitted">{formatWhen(a.submittedAt)}</Field>}
                {a.decidedAt && <Field label="Decided">{formatWhen(a.decidedAt)}{a.decidedById ? ` by ${names.get(a.decidedById) ?? "a former member"}` : ""}</Field>}
                {a.batch.instructions && <div className="sm:col-span-2"><div className="text-muted-foreground">Instructions</div><p className="whitespace-pre-line">{a.batch.instructions}</p></div>}
                {a.batch.completionCriteria && <div className="sm:col-span-2"><div className="text-muted-foreground">Done when</div><p className="whitespace-pre-line">{a.batch.completionCriteria}</p></div>}
                {decision && <div className="sm:col-span-2 rounded-card-inner bg-muted p-3"><div className="text-muted-foreground">Last comment</div><p className="whitespace-pre-line">{decision}</p></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
              <CardContent>
                {a.evidence.length === 0 ? (
                  <EmptyState title="No evidence yet" hint={a.requiresEvidence ? "Evidence is needed before the work can be submitted." : "Evidence is optional for this work."} />
                ) : (
                  <ul className="divide-y divide-border">
                    {a.evidence.map((e) => (
                      <li key={e.id} className="py-3 text-footnote">
                        <div className="mb-1 text-caption text-muted-foreground">
                          {e.kind === "note" ? "Note" : "Link"} · {names.get(e.addedById) ?? "Former member"} · {formatWhen(e.createdAt)}
                        </div>
                        {e.kind === "link" ? (
                          <a href={e.body} target="_blank" rel="noopener noreferrer" className="break-all text-brand-text hover:underline">{e.body}</a>
                        ) : (
                          <p className="whitespace-pre-line">{e.body}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent>
              {a.events.length === 0 ? (
                <p className="text-footnote text-muted-foreground">No changes yet.</p>
              ) : (
                <ol className="space-y-4">
                  {a.events.map((e) => (
                    <li key={e.id} className="text-footnote">
                      <div className="font-medium">{EVENT_LABEL[e.action] ?? e.action}</div>
                      <div className="text-caption text-muted-foreground">
                        {formatWhen(e.createdAt)} · {names.get(e.actorId) ?? e.actorEmail ?? "Former member"}
                      </div>
                      {e.comment && <p className="mt-1 whitespace-pre-line rounded-control bg-muted px-2 py-1.5">{e.comment}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
