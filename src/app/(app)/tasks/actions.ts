"use server";
// Assignments and work verification (SPEC §R-4). Every action: checks the capability, runs under the caller's scope
// (row-level security limits what they can see and change), appends to the assignment history, writes to the record's
// timeline, and notifies the people who need to act next. Pure rules live in src/lib/assignments.ts.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { withScope } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { actor, errorMessage, fail, logActivity, type ActionResult } from "@/lib/records/server";
import type { CurrentUser } from "@/lib/session";
import { notifyPeople, reviewerIds, type NoticeInput } from "@/lib/notify";
import {
  EVENT, NOTIFY, batchSchema, canHold, canReassign, canStart, dueFromDate, evidenceSchema, holdSchema, idSchema,
  nextDueDate, reassignSchema, resumeStatus, reviewResult, reviewSchema, submissionProblems, WORKABLE_STATUSES,
  type AssignmentStatus, type ReviewDecision,
} from "@/lib/assignments";

type RecordKind = "contact" | "account";

/** The record's display name, or null when the caller cannot see it. */
async function recordName(tx: Tx, recordType: RecordKind, recordId: string): Promise<string | null> {
  if (recordType === "contact") return (await tx.contact.findUnique({ where: { id: recordId }, select: { fullName: true } }))?.fullName ?? null;
  return (await tx.account.findUnique({ where: { id: recordId }, select: { name: true } }))?.name ?? null;
}

/** Puts the person on the record's assignee list, so the record shows up in their list and they can see it. */
async function addAssignee(tx: Tx, recordType: RecordKind, recordIds: string[], userId: string): Promise<void> {
  if (recordIds.length === 0) return;
  if (recordType === "contact") {
    await tx.$executeRaw`UPDATE "Contact" SET "assigneeIds" = array_append(array_remove("assigneeIds", ${userId}::uuid), ${userId}::uuid) WHERE id = ANY(${recordIds}::uuid[])`;
  } else {
    await tx.$executeRaw`UPDATE "Account" SET "assigneeIds" = array_append(array_remove("assigneeIds", ${userId}::uuid), ${userId}::uuid) WHERE id = ANY(${recordIds}::uuid[])`;
  }
}

type EventInput = {
  assignmentId: string;
  action: string;
  fromStatus?: AssignmentStatus | null;
  toStatus?: AssignmentStatus | null;
  comment?: string | null;
  detail?: Prisma.InputJsonValue;
};

/** Appends to the assignment history, as the signed-in member. */
async function recordEvents(tx: Tx, me: CurrentUser, events: EventInput[]): Promise<void> {
  if (events.length === 0) return;
  await tx.assignmentEvent.createMany({
    data: events.map((e) => ({
      workspaceId: me.workspaceId,
      assignmentId: e.assignmentId,
      action: e.action,
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      comment: e.comment || null,
      detail: e.detail,
      actorId: me.userId,
      actorEmail: me.email,
    })),
  });
}

const CANNOT_SEE = "That assignment doesn't exist, or you can't see it.";
const linkFor = (id: string) => `/tasks/${id}`;

/** Loads an assignment the caller can see (row-level security decides). */
async function loadAssignment(tx: Tx, id: string) {
  return tx.assignment.findUnique({ where: { id } });
}

export async function createAssignmentBatch(input: unknown): Promise<ActionResult<{ id: string; count: number }>> {
  try {
    const me = await actor("assignments.manage");
    const p = batchSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    const ids = [...new Set(v.recordIds)];
    const dueAt = dueFromDate(v.dueDate || null);

    const result = await withScope(me.scope, async (tx): Promise<ActionResult<{ id: string; count: number }>> => {
      const assignee = await tx.workspaceMember.findFirst({ where: { userId: v.assigneeId, status: "active" }, select: { userId: true, fullName: true } });
      if (!assignee) return fail("That person is not an active member of this workspace.");

      // Only records the caller can see are accepted; anything else means the list is out of date.
      const found = v.recordType === "contact"
        ? (await tx.contact.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })).map((r) => ({ id: r.id, name: r.fullName }))
        : (await tx.account.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((r) => ({ id: r.id, name: r.name }));
      if (found.length !== ids.length) return fail("Some of those records don't exist or you can't see them. Pick them again.");

      const batch = await tx.assignmentBatch.create({
        data: {
          workspaceId: me.workspaceId, title: v.title, recordType: v.recordType, taskType: v.taskType,
          instructions: v.instructions || null, completionCriteria: v.completionCriteria || null,
          priority: v.priority, requiresEvidence: v.requiresEvidence, dueAt, recurrence: v.recurrence,
          targetCount: v.targetCount ?? null, createdById: me.userId,
        },
        select: { id: true },
      });

      const rows = found.map((r) => ({
        id: randomUUID(), workspaceId: me.workspaceId, batchId: batch.id, recordType: v.recordType, recordId: r.id,
        assigneeId: v.assigneeId, assignedById: me.userId, title: v.title, taskType: v.taskType, priority: v.priority,
        dueAt, requiresEvidence: v.requiresEvidence, recurrence: v.recurrence, status: "open" as const,
      }));
      await tx.assignment.createMany({ data: rows });
      await recordEvents(tx, me, rows.map((r) => ({
        assignmentId: r.id, action: EVENT.assigned, toStatus: "open" as const, detail: { batchId: batch.id, assigneeId: v.assigneeId },
      })));
      await addAssignee(tx, v.recordType, found.map((r) => r.id), v.assigneeId);
      await logActivity(tx, me, found.map((r) => ({
        recordType: v.recordType, recordId: r.id, kind: "task" as const, summary: `Assigned to ${assignee.fullName}: ${v.title}`,
      })));
      await notifyPeople(tx, me, [{
        userId: v.assigneeId, kind: "assigned", title: `${NOTIFY.assigned}: ${v.title}`,
        body: `${found.length} ${found.length === 1 ? "record" : "records"}${dueAt ? ` · due ${dueAt.toISOString().slice(0, 10)}` : ""}`,
        link: `/tasks/batch/${batch.id}`,
      }]);
      await audit(tx, me.scope, {
        action: "assignment.created", entityType: "AssignmentBatch", entityId: batch.id,
        meta: { count: found.length, taskType: v.taskType, recordType: v.recordType },
      });
      return { ok: true, id: batch.id, count: found.length };
    });
    if (result.ok) revalidatePath("/tasks");
    return result;
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const searchSchema = z.object({ recordType: z.enum(["contact", "account"]), query: z.string().trim().max(100) });

/** Records the manager can pick for a batch. Empty query lists the first names alphabetically. */
export async function searchRecordsForAssignment(input: unknown): Promise<ActionResult<{ items: { id: string; name: string; detail: string | null }[] }>> {
  try {
    const me = await actor("assignments.manage");
    const p = searchSchema.safeParse(input);
    if (!p.success) return fail("Check the search.");
    const q = p.data.query.toLowerCase();
    const items = await withScope(me.scope, async (tx) => {
      if (p.data.recordType === "contact") {
        const rows = await tx.contact.findMany({
          where: q ? { searchText: { contains: q } } : undefined,
          orderBy: { fullName: "asc" }, take: 25,
          select: { id: true, fullName: true, email: true, account: { select: { name: true } } },
        });
        return rows.map((r) => ({ id: r.id, name: r.fullName, detail: r.email ?? r.account?.name ?? null }));
      }
      const rows = await tx.account.findMany({
        where: q ? { searchText: { contains: q } } : undefined,
        orderBy: { name: "asc" }, take: 25, select: { id: true, name: true, domain: true },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, detail: r.domain ?? null }));
    });
    return { ok: true, items };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Only the assignee moves their own work: start, add evidence, submit. Managers review. */
export async function startAssignment(assignmentId: unknown): Promise<ActionResult<{ status: AssignmentStatus }>> {
  try {
    const me = await actor("assignments.read");
    const id = idSchema.safeParse(assignmentId);
    if (!id.success) return fail("Invalid request.");
    return await withScope(me.scope, async (tx): Promise<ActionResult<{ status: AssignmentStatus }>> => {
      const a = await loadAssignment(tx, id.data);
      if (!a) return fail(CANNOT_SEE);
      if (a.assigneeId !== me.userId) return fail("Only the person this is assigned to can start it.");
      if (!canStart(a.status)) return fail("This work has already been started. Use Put on hold or Submit.");
      const now = new Date();
      await tx.assignment.update({ where: { id: a.id }, data: { status: "in_progress", startedAt: now } });
      await recordEvents(tx, me, [{ assignmentId: a.id, action: EVENT.started, fromStatus: "open", toStatus: "in_progress" }]);
      revalidatePath("/tasks");
      revalidatePath(linkFor(a.id));
      return { ok: true, status: "in_progress" };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function addEvidence(input: unknown): Promise<ActionResult> {
  try {
    const me = await actor("assignments.read");
    const p = evidenceSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the evidence.");
    const v = p.data;
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const a = await tx.assignment.findUnique({ where: { id: v.assignmentId }, select: { id: true, status: true, assigneeId: true } });
      if (!a) return fail(CANNOT_SEE);
      if (a.assigneeId !== me.userId) return fail("Only the person this is assigned to can add evidence.");
      if (!WORKABLE_STATUSES.includes(a.status)) return fail("Evidence can only be added while the work is to do or in progress.");
      await tx.assignmentEvidence.create({
        data: { workspaceId: me.workspaceId, assignmentId: a.id, kind: v.kind, body: v.body, addedById: me.userId },
      });
      await recordEvents(tx, me, [{ assignmentId: a.id, action: EVENT.evidenceAdded, detail: { kind: v.kind } }]);
      revalidatePath(linkFor(a.id));
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Employee submits. The system checks the evidence and that the record is still visible; if both pass the work
 *  becomes "awaiting approval" (verified) in the same step. A failed check is returned to the employee and nothing changes. */
export async function submitAssignment(assignmentId: unknown): Promise<ActionResult> {
  try {
    const me = await actor("assignments.read");
    const id = idSchema.safeParse(assignmentId);
    if (!id.success) return fail("Invalid request.");
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const a = await loadAssignment(tx, id.data);
      if (!a) return fail(CANNOT_SEE);
      if (a.assigneeId !== me.userId) return fail("Only the person this is assigned to can submit it.");
      if (!WORKABLE_STATUSES.includes(a.status)) return fail("This work is not open for submitting. Resume it first if it is on hold.");

      const evidenceCount = await tx.assignmentEvidence.count({ where: { assignmentId: a.id } });
      const name = await recordName(tx, a.recordType, a.recordId);
      const problems = submissionProblems({ requiresEvidence: a.requiresEvidence, evidenceCount, recordVisible: name !== null });
      if (problems.length) return fail(problems[0]);

      const now = new Date();
      await tx.assignment.update({
        where: { id: a.id },
        data: { status: "verified", submittedAt: now, verifiedAt: now, decisionComment: null, startedAt: a.startedAt ?? now },
      });
      await recordEvents(tx, me, [
        { assignmentId: a.id, action: EVENT.submitted, fromStatus: a.status, toStatus: null },
        { assignmentId: a.id, action: EVENT.verified, fromStatus: a.status, toStatus: "verified", detail: { checks: ["evidence", "record visible"], evidenceCount } },
      ]);
      await logActivity(tx, me, [{ recordType: a.recordType, recordId: a.recordId, kind: "task", summary: `Work submitted: ${a.title}` }]);
      await notifyPeople(tx, me, (await reviewerIds(tx)).map((userId): NoticeInput => ({
        userId, kind: "submitted", title: `${NOTIFY.submitted}: ${a.title}`, body: `${me.fullName} · ${name ?? "a record"}`, link: linkFor(a.id),
      })));
      revalidatePath("/tasks");
      revalidatePath(linkFor(a.id));
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** A hold or resume tells the other side: the assignee tells the reviewers, a reviewer tells the assignee. */
async function notifyAboutHold(tx: Tx, me: CurrentUser, a: { id: string; title: string; assigneeId: string }, title: string, reason: string | null) {
  const body = reason ? `${me.fullName}: ${reason}` : me.fullName;
  if (a.assigneeId === me.userId) {
    await notifyPeople(tx, me, (await reviewerIds(tx)).map((userId): NoticeInput => ({ userId, kind: "hold", title: `${title}: ${a.title}`, body, link: linkFor(a.id) })));
  } else {
    await notifyPeople(tx, me, [{ userId: a.assigneeId, kind: "hold", title: `${title}: ${a.title}`, body, link: linkFor(a.id) }]);
  }
}

/** Put on hold: the assignee or a manager, with a reason. The other side is told. */
export async function holdAssignment(input: unknown): Promise<ActionResult> {
  try {
    const me = await actor("assignments.read");
    const p = holdSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Say why it is on hold.");
    const { assignmentId, reason } = p.data;
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const a = await loadAssignment(tx, assignmentId);
      if (!a) return fail(CANNOT_SEE);
      const isAssignee = a.assigneeId === me.userId;
      if (!isAssignee && !can(me.role, "assignments.manage")) return fail("Only the person this is assigned to or a manager can put it on hold.");
      if (!canHold(a.status)) return fail("Only work that is to do or in progress can be put on hold.");

      await tx.assignment.update({ where: { id: a.id }, data: { status: "on_hold", holdReason: reason } });
      await recordEvents(tx, me, [{ assignmentId: a.id, action: EVENT.held, fromStatus: a.status, toStatus: "on_hold", comment: reason }]);
      await notifyAboutHold(tx, me, a, NOTIFY.held, reason);
      revalidatePath("/tasks");
      revalidatePath(linkFor(a.id));
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Resume from hold: back to In progress if it had been started, otherwise To do. */
export async function resumeAssignment(assignmentId: unknown): Promise<ActionResult> {
  try {
    const me = await actor("assignments.read");
    const id = idSchema.safeParse(assignmentId);
    if (!id.success) return fail("Invalid request.");
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const a = await loadAssignment(tx, id.data);
      if (!a) return fail(CANNOT_SEE);
      const isAssignee = a.assigneeId === me.userId;
      if (!isAssignee && !can(me.role, "assignments.manage")) return fail("Only the person this is assigned to or a manager can resume it.");
      if (a.status !== "on_hold") return fail("This work is not on hold.");
      const next = resumeStatus(a.startedAt);
      await tx.assignment.update({ where: { id: a.id }, data: { status: next, holdReason: null } });
      await recordEvents(tx, me, [{ assignmentId: a.id, action: EVENT.resumed, fromStatus: "on_hold", toStatus: next }]);
      await notifyAboutHold(tx, me, a, NOTIFY.resumed, null);
      revalidatePath("/tasks");
      revalidatePath(linkFor(a.id));
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function reviewAssignment(input: unknown): Promise<ActionResult<{ status: AssignmentStatus }>> {
  try {
    const me = await actor("assignments.manage");
    const p = reviewSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the comment.");
    const { assignmentId, decision, comment } = p.data;
    return await withScope(me.scope, async (tx): Promise<ActionResult<{ status: AssignmentStatus }>> => {
      const a = await loadAssignment(tx, assignmentId);
      if (!a) return fail(CANNOT_SEE);
      const next = reviewResult(a.status, decision as ReviewDecision);
      if (!next) return fail("Only work that is awaiting approval can be approved, returned or rejected.");

      const now = new Date();
      await tx.assignment.update({
        where: { id: a.id },
        data: {
          status: next, decidedAt: now, decidedById: me.userId, decisionComment: comment || null,
          // Returned work is to be done again: the submission is cleared, the evidence stays.
          ...(decision === "return" ? { submittedAt: null, verifiedAt: null, startedAt: a.startedAt ?? now } : {}),
        },
      });
      const action = decision === "approve" ? EVENT.approved : decision === "return" ? EVENT.returned : EVENT.rejected;
      await recordEvents(tx, me, [{ assignmentId: a.id, action, fromStatus: "verified", toStatus: next, comment }]);

      const noticeTitle = decision === "approve" ? NOTIFY.approved : decision === "return" ? NOTIFY.returned : NOTIFY.rejected;
      await notifyPeople(tx, me, [{ userId: a.assigneeId, kind: decision, title: `${noticeTitle}: ${a.title}`, body: comment || null, link: linkFor(a.id) }]);

      if (decision === "approve" && a.recurrence !== "none") {
        // Approved repeating work starts its next round (same person, same record, next deadline). The approver is recorded as the one who started it.
        const nextId = randomUUID();
        const due = nextDueDate(a.dueAt, a.recurrence, now);
        await tx.assignment.create({
          data: {
            id: nextId, workspaceId: me.workspaceId, batchId: a.batchId, recordType: a.recordType, recordId: a.recordId,
            assigneeId: a.assigneeId, assignedById: me.userId, title: a.title, taskType: a.taskType, priority: a.priority,
            dueAt: due, requiresEvidence: a.requiresEvidence, recurrence: a.recurrence, status: "open",
          },
        });
        await recordEvents(tx, me, [{ assignmentId: nextId, action: EVENT.repeatStarted, toStatus: "open", detail: { from: a.id } }]);
        await notifyPeople(tx, me, [{
          userId: a.assigneeId, kind: "repeat", title: `${NOTIFY.repeat}: ${a.title}`, body: due ? `Due ${due.toISOString().slice(0, 10)}` : null, link: linkFor(nextId),
        }]);
      }

      const verb = decision === "approve" ? "approved" : decision === "return" ? "returned for changes" : "rejected";
      await logActivity(tx, me, [{ recordType: a.recordType, recordId: a.recordId, kind: "task", summary: `Work ${verb}: ${a.title}`, body: comment || null }]);
      await audit(tx, me.scope, { action: `assignment.${decision}`, entityType: "Assignment", entityId: a.id, meta: { status: next } });
      revalidatePath("/tasks");
      revalidatePath(linkFor(a.id));
      return { ok: true, status: next };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function reassignAssignment(input: unknown): Promise<ActionResult> {
  try {
    const me = await actor("assignments.manage");
    const p = reassignSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const a = await loadAssignment(tx, v.assignmentId);
      if (!a) return fail(CANNOT_SEE);
      if (!canReassign(a.status)) return fail("Only work that is not yet submitted can be reassigned.");
      if (a.assigneeId === v.assigneeId) return fail("It is already assigned to that person.");
      const member = await tx.workspaceMember.findFirst({ where: { userId: v.assigneeId, status: "active" }, select: { fullName: true } });
      if (!member) return fail("That person is not an active member of this workspace.");

      await tx.assignment.update({ where: { id: a.id }, data: { assigneeId: v.assigneeId } });
      await addAssignee(tx, a.recordType, [a.recordId], v.assigneeId);
      await recordEvents(tx, me, [{
        assignmentId: a.id, action: EVENT.reassigned, fromStatus: a.status, toStatus: a.status, comment: v.reason,
        detail: { from: a.assigneeId, to: v.assigneeId },
      }]);
      await logActivity(tx, me, [{ recordType: a.recordType, recordId: a.recordId, kind: "task", summary: `Reassigned to ${member.fullName}: ${a.title}`, body: v.reason }]);
      await notifyPeople(tx, me, [{ userId: v.assigneeId, kind: "reassigned", title: `${NOTIFY.reassigned}: ${a.title}`, body: v.reason, link: linkFor(a.id) }]);
      revalidatePath("/tasks");
      revalidatePath(linkFor(a.id));
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function stopRepeating(assignmentId: unknown): Promise<ActionResult> {
  try {
    const me = await actor("assignments.manage");
    const id = idSchema.safeParse(assignmentId);
    if (!id.success) return fail("Invalid request.");
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const a = await loadAssignment(tx, id.data);
      if (!a) return fail(CANNOT_SEE);
      if (a.recurrence === "none") return fail("This work does not repeat.");
      await tx.assignment.update({ where: { id: a.id }, data: { recurrence: "none" } });
      await recordEvents(tx, me, [{ assignmentId: a.id, action: EVENT.repeatStopped, detail: { was: a.recurrence } }]);
      revalidatePath(linkFor(a.id));
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}
