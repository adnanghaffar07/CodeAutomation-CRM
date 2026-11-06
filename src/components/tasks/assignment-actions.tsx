"use client";
// What the signed-in person can do on one assignment. The server checks every step again; this only shows the right buttons.
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea, nativeSelectClass } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  addEvidence, holdAssignment, reassignAssignment, resumeAssignment, reviewAssignment, startAssignment, stopRepeating, submitAssignment,
} from "@/app/(app)/tasks/actions";
import {
  EVIDENCE_KINDS, canHold, canReassign, canStart, decisionNeedsComment, WORKABLE_STATUSES,
  type AssignmentStatus, type EvidenceKind, type ReviewDecision,
} from "@/lib/assignments";

type Member = { userId: string; fullName: string };

export type ActionsProps = {
  assignmentId: string;
  status: AssignmentStatus;
  isAssignee: boolean;
  isManager: boolean;
  requiresEvidence: boolean;
  evidenceCount: number;
  repeating: boolean;
  currentAssigneeId: string;
  members: Member[];
};

export function AssignmentActions(p: ActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [kind, setKind] = React.useState<EvidenceKind>("note");
  const [body, setBody] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [holdReason, setHoldReason] = React.useState("");
  const [newAssignee, setNewAssignee] = React.useState("");
  const [reason, setReason] = React.useState("");

  // Runs one server action, then shows its result and reloads the page's data.
  async function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string, after?: () => void) {
    setBusy(true);
    const r = await action();
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(success);
    after?.();
    router.refresh();
  }

  const isOwner = p.isAssignee;
  const canWork = isOwner && WORKABLE_STATUSES.includes(p.status);
  const canStartNow = isOwner && canStart(p.status);
  const canHoldNow = (isOwner || p.isManager) && canHold(p.status);
  const canResumeNow = (isOwner || p.isManager) && p.status === "on_hold";
  const canReview = p.isManager && p.status === "verified";
  const canReassignNow = p.isManager && canReassign(p.status);
  const canStopRepeat = p.isManager && p.repeating;

  async function addEvidenceNow(e: React.FormEvent) {
    e.preventDefault();
    await run(() => addEvidence({ assignmentId: p.assignmentId, kind, body }), "Evidence added.", () => setBody(""));
  }

  async function review(decision: ReviewDecision) {
    if (decisionNeedsComment(decision) && comment.trim().length < 3) return toast.error("Write a short comment so the person knows what to change.");
    if (decision === "reject") {
      const ok = await confirmDialog({
        title: "Reject this work?",
        message: "The work is marked rejected and cannot be submitted again. Use Return for changes if they should try again.",
        confirmLabel: "Reject",
        variant: "destructive",
      });
      if (!ok) return;
    }
    const done = { approve: "Completed.", return: "Returned to the person.", reject: "Rejected." }[decision];
    await run(() => reviewAssignment({ assignmentId: p.assignmentId, decision, comment }), done, () => setComment(""));
  }

  async function reassignNow(e: React.FormEvent) {
    e.preventDefault();
    await run(
      () => reassignAssignment({ assignmentId: p.assignmentId, assigneeId: newAssignee, reason }),
      "Reassigned.",
      () => { setNewAssignee(""); setReason(""); },
    );
  }

  async function holdNow(e: React.FormEvent) {
    e.preventDefault();
    await run(() => holdAssignment({ assignmentId: p.assignmentId, reason: holdReason }), "Put on hold.", () => setHoldReason(""));
  }

  const others = p.members.filter((m) => m.userId !== p.currentAssigneeId);
  const field = nativeSelectClass;
  const anything = canStartNow || canWork || canHoldNow || canResumeNow || canReview || canReassignNow || canStopRepeat;
  if (!anything) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canStartNow && (
        <Card>
          <CardHeader><CardTitle>Start</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-footnote text-muted-foreground">Mark this as in progress when you begin.</p>
            <Button type="button" disabled={busy} onClick={() => run(() => startAssignment(p.assignmentId), "Started.")}>Start</Button>
          </CardContent>
        </Card>
      )}

      {canWork && (
        <Card>
          <CardHeader><CardTitle>Your work</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={addEvidenceNow} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <label className="flex flex-col gap-1 text-footnote">
                  <span className="text-muted-foreground">Evidence type</span>
                  <select className={field} value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)}>
                    {EVIDENCE_KINDS.map((k) => <option key={k} value={k}>{k === "note" ? "Note" : "Link"}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-footnote">
                  <span className="text-muted-foreground">{kind === "note" ? "What you did" : "Link (https://…)"}</span>
                  {kind === "note" ? (
                    <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="For example: found the owner's email on their site" />
                  ) : (
                    <input className={`${field} md:h-9`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="https://" />
                  )}
                </label>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={busy || !body.trim()}>Add evidence</Button>
              </div>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-footnote text-muted-foreground">
                {p.requiresEvidence && p.evidenceCount === 0 ? "Add evidence before you submit." : "Submit when the work meets the completion criteria."}
              </p>
              <Button type="button" onClick={() => run(() => submitAssignment(p.assignmentId), "Submitted. It passed the checks and is waiting for approval.")} disabled={busy}>
                Submit for approval
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canHoldNow && (
        <Card>
          <CardHeader><CardTitle>Put on hold</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={holdNow} className="space-y-3">
              <label className="flex flex-col gap-1 text-footnote">
                <span className="text-muted-foreground">Reason (the other side is told)</span>
                <Textarea rows={2} value={holdReason} onChange={(e) => setHoldReason(e.target.value)} maxLength={500} required placeholder="For example: waiting for access to the client's portal" />
              </label>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={busy || holdReason.trim().length < 3}>Put on hold</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canResumeNow && (
        <Card>
          <CardHeader><CardTitle>On hold</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-footnote text-muted-foreground">Resume when it can go on again.</p>
            <Button type="button" disabled={busy} onClick={() => run(() => resumeAssignment(p.assignmentId), "Resumed.")}>Resume</Button>
          </CardContent>
        </Card>
      )}

      {canReview && (
        <Card>
          <CardHeader><CardTitle>Review</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex flex-col gap-1 text-footnote">
              <span className="text-muted-foreground">Comment (needed to return or reject)</span>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="What is good, or what needs changing" />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="destructive" disabled={busy} onClick={() => review("reject")}>Reject</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => review("return")}>Return for changes</Button>
              <Button type="button" disabled={busy} onClick={() => review("approve")}>Approve</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canReassignNow && (
        <Card>
          <CardHeader><CardTitle>Reassign</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={reassignNow} className="space-y-3">
              <label className="flex flex-col gap-1 text-footnote">
                <span className="text-muted-foreground">New person</span>
                <select className={field} value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} required>
                  <option value="">Choose a person</option>
                  {others.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-footnote">
                <span className="text-muted-foreground">Reason (kept in the history)</span>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required />
              </label>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" disabled={busy || !newAssignee || reason.trim().length < 3}>Reassign</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canStopRepeat && (
        <Card>
          <CardHeader><CardTitle>Repeating work</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-footnote text-muted-foreground">Approving this starts the next round. Stop repeats to end the series.</p>
            <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => stopRepeating(p.assignmentId), "Repeats stopped.")}>Stop repeating</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
