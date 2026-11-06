// Pure rules for assignments and work verification (SPEC §R-4). No database or request code here, so vitest can load it.
// Lifecycle: open → (submit: evidence checked by the system) → verified → approved | rejected; return sends verified back to open.
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

export const ASSIGNMENT_STATUSES = ["open", "verified", "approved", "rejected"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const STATUS_LABEL: Record<AssignmentStatus, string> = {
  open: "To do", verified: "Awaiting approval", approved: "Approved", rejected: "Rejected",
};

export const EVIDENCE_KINDS = ["note", "link"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Every change written to the assignment history. Stored as text, so new kinds of entry need no migration. */
export const EVENT = {
  assigned: "assigned",
  reassigned: "reassigned",
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

export type FlagInput = {
  status: AssignmentStatus;
  dueAt: Date | null;
  requiresEvidence: boolean;
  evidenceCount: number;
};

export type Flags = { overdue: boolean; dueSoon: boolean; missingEvidence: boolean };

/**
 * Warnings shown beside the work (SPEC R-4.9). Only open work is flagged; approved and rejected work is finished.
 * - overdue: past its deadline and not yet submitted.
 * - dueSoon: deadline within 48 hours.
 * - missingEvidence: evidence is required, none is attached, and the deadline is within 48 hours or has passed.
 */
export function flagsFor(a: FlagInput, now: Date = new Date()): Flags {
  if (a.status !== "open" || !a.dueAt) return { overdue: false, dueSoon: false, missingEvidence: false };
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
  return "open";
}

/** Returning and rejecting need a reason so the employee knows what to change. */
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
