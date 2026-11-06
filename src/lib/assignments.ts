// Pure rules for assignments and work verification (SPEC §R-4). No database or request code here, so vitest can load it.
// Lifecycle:
//   open (To do) → in_progress (Start) → verified (Submit: evidence checked by the system; "Awaiting approval")
//   verified → approved (Completed) | rejected | back to in_progress (Return for changes)
//   open or in_progress → on_hold (with a reason) → back to in_progress, or open if it never started
import { z } from "zod";
import { addDays, addMonths, addWeeks } from "date-fns";

export const TASK_TYPES = ["research", "cleaning", "outreach", "calling", "follow_up"] as const;
export type TaskType = (typeof TASK_TYPES)[number];
export const TASK_LABEL: Record<TaskType, string> = {
  research: "Research", cleaning: "Cleaning", outreach: "Outreach", calling: "Calling", follow_up: "Follow-up",
};

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", normal: "Normal", high: "High", urgent: "Urgent" };

export const RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: "Does not repeat", daily: "Every day", weekly: "Every week", monthly: "Every month",
};

export const ASSIGNMENT_STATUSES = ["open", "in_progress", "on_hold", "verified", "approved", "rejected"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  open: "To do",
  in_progress: "In progress",
  on_hold: "On hold",
  verified: "Awaiting approval",
  approved: "Completed",
  rejected: "Rejected",
};

export const EVIDENCE_KINDS = ["note", "link"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Every change written to the assignment history. Stored as text, so new kinds of entry need no migration. */
export const EVENT = {
  assigned: "assigned",
  reassigned: "reassigned",
  started: "started",
  held: "held",
  resumed: "resumed",
  evidenceAdded: "evidence_added",
  submitted: "submitted",
  verified: "verified",
  approved: "approved",
  returned: "returned",
  rejected: "rejected",
  repeatStarted: "repeat_started",
  repeatStopped: "repeat_stopped",
} as const;

/** "Due soon" and "missing evidence" look this far ahead. */
export const SOON_MS = 48 * 60 * 60 * 1000;

/** Work the person still has to do (not submitted, not on hold). */
export const ACTIVE_STATUSES: AssignmentStatus[] = ["open", "in_progress"];
/** Work the person may add evidence to, or submit. */
export const WORKABLE_STATUSES: AssignmentStatus[] = ["open", "in_progress"];

export type FlagInput = {
  status: AssignmentStatus;
  dueAt: Date | null;
  requiresEvidence: boolean;
  evidenceCount: number;
};

export type Flags = { overdue: boolean; dueSoon: boolean; missingEvidence: boolean };

/**
 * Warnings shown beside the work (SPEC R-4.9). Only work that is still to do (To do or In progress) is flagged;
 * work on hold is paused, and submitted or finished work is done.
 * - overdue: past its deadline.
 * - dueSoon: deadline within 48 hours.
 * - missingEvidence: evidence is required, none is attached, and the deadline is within 48 hours or has passed.
 */
export function flagsFor(a: FlagInput, now: Date = new Date()): Flags {
  if (!ACTIVE_STATUSES.includes(a.status) || !a.dueAt) return { overdue: false, dueSoon: false, missingEvidence: false };
  const due = a.dueAt.getTime();
  const overdue = due < now.getTime();
  const dueSoon = !overdue && due <= now.getTime() + SOON_MS;
  const missingEvidence = a.requiresEvidence && a.evidenceCount === 0 && (overdue || dueSoon);
  return { overdue, dueSoon, missingEvidence };
}

/** The next deadline for a repeating assignment, counted from the last one (or from now if it had none). */
export function nextDueDate(dueAt: Date | null, recurrence: Recurrence, now: Date = new Date()): Date | null {
  if (recurrence === "none") return null;
  const base = dueAt ?? now;
  if (recurrence === "daily") return addDays(base, 1);
  if (recurrence === "weekly") return addWeeks(base, 1);
  return addMonths(base, 1);
}

/** Starting is allowed only from To do. */
export const canStart = (status: AssignmentStatus) => status === "open";

/** Putting on hold is allowed while the work is still to do. */
export const canHold = (status: AssignmentStatus) => WORKABLE_STATUSES.includes(status);

/** Resuming goes back to In progress if the person had started, otherwise To do. */
export function resumeStatus(startedAt: Date | null): AssignmentStatus {
  return startedAt ? "in_progress" : "open";
}

/** Reassigning is allowed while the work is still to do or on hold. */
export const canReassign = (status: AssignmentStatus) => status === "open" || status === "in_progress" || status === "on_hold";

/** The system checks run when work is submitted. An empty list means it passes and becomes "awaiting approval". */
export function submissionProblems(input: { requiresEvidence: boolean; evidenceCount: number; recordVisible: boolean }): string[] {
  const problems: string[] = [];
  if (!input.recordVisible) problems.push("The record is no longer visible to you, so the work cannot be checked. Ask a manager.");
  if (input.requiresEvidence && input.evidenceCount === 0) problems.push("Add at least one piece of evidence (a note or a link) before you submit.");
  return problems;
}

export type ReviewDecision = "approve" | "return" | "reject";

/** The status after a manager's decision, or null when that decision is not allowed from this status. */
export function reviewResult(status: AssignmentStatus, decision: ReviewDecision): AssignmentStatus | null {
  if (status !== "verified") return null;
  if (decision === "approve") return "approved";
  if (decision === "reject") return "rejected";
  return "in_progress";
}

/** Returning and rejecting need a reason so the employee knows what to change. Putting on hold needs one too. */
export const decisionNeedsComment = (decision: ReviewDecision) => decision !== "approve";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date (YYYY-MM-DD) becomes the end of that day in UTC. */
export function dueFromDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  return new Date(`${date}T23:59:59.000Z`);
}

const uuid = z.string().uuid("Something was not recognised. Refresh the page and try again.");

export const batchSchema = z.object({
  title: z.string().trim().min(2, "Give the assignment a title.").max(160),
  recordType: z.enum(["contact", "account"]),
  taskType: z.enum(TASK_TYPES),
  instructions: z.string().trim().max(4000).optional().nullable(),
  completionCriteria: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(PRIORITIES).default("normal"),
  requiresEvidence: z.boolean().default(true),
  dueDate: z.string().regex(DATE, "Pick a valid due date.").optional().nullable().or(z.literal("")),
  recurrence: z.enum(RECURRENCES).default("none"),
  targetCount: z.number().int().min(1, "A target is at least 1.").max(100000).optional().nullable(),
  assigneeId: uuid,
  recordIds: z.array(uuid).min(1, "Pick at least one record.").max(200, "Up to 200 records per assignment."),
});
export type BatchInput = z.infer<typeof batchSchema>;

export const evidenceSchema = z.object({
  assignmentId: uuid,
  kind: z.enum(EVIDENCE_KINDS),
  body: z.string().trim().min(1, "Write the evidence first.").max(2000),
}).superRefine((v, ctx) => {
  if (v.kind !== "link") return;
  let ok = false;
  try {
    const u = new URL(v.body);
    ok = u.protocol === "http:" || u.protocol === "https:";
  } catch { ok = false; }
  if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["body"], message: "A link must start with http:// or https://" });
});

export const reviewSchema = z.object({
  assignmentId: uuid,
  decision: z.enum(["approve", "return", "reject"]),
  comment: z.string().trim().max(1000).optional().default(""),
}).superRefine((v, ctx) => {
  if (decisionNeedsComment(v.decision) && v.comment.length < 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["comment"], message: "Write a short comment so the person knows what to change." });
  }
});

export const reassignSchema = z.object({
  assignmentId: uuid,
  assigneeId: uuid,
  reason: z.string().trim().min(3, "Give a reason for the change.").max(500),
});

export const holdSchema = z.object({
  assignmentId: uuid,
  reason: z.string().trim().min(3, "Say why it is on hold.").max(500),
});

export const idSchema = uuid;

/** Plain words for a notification about one assignment event (see notify in tasks/actions.ts). */
export const NOTIFY = {
  assigned: "New assignment",
  reassigned: "Assignment given to you",
  submitted: "Work submitted for approval",
  returned: "Work returned for changes",
  approved: "Work approved",
  rejected: "Work rejected",
  held: "Work put on hold",
  resumed: "Work resumed",
  repeat: "Next round started",
} as const;
