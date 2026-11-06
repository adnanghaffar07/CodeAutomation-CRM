// Pure rules for assignments (src/lib/assignments.ts): flags, the lifecycle, deadlines and validation.
import { describe, expect, it } from "vitest";
import {
  batchSchema, decisionNeedsComment, dueFromDate, evidenceSchema, flagsFor, nextDueDate, reviewResult, reviewSchema,
  submissionProblems,
} from "@/lib/assignments";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000);
const UUID = "3f2b9c1e-7a4d-4b8e-9c2a-1d5e6f7a8b9c";

describe("flagsFor", () => {
  it("flags open work past its deadline as overdue", () => {
    const f = flagsFor({ status: "open", dueAt: hours(-1), requiresEvidence: false, evidenceCount: 0 }, NOW);
    expect(f.overdue).toBe(true);
    expect(f.dueSoon).toBe(false);
  });

  it("flags open work due within 48 hours as due soon, not overdue", () => {
    const f = flagsFor({ status: "open", dueAt: hours(30), requiresEvidence: false, evidenceCount: 0 }, NOW);
    expect(f).toEqual({ overdue: false, dueSoon: true, missingEvidence: false });
  });

  it("does not flag work due later than 48 hours", () => {
    const f = flagsFor({ status: "open", dueAt: hours(72), requiresEvidence: true, evidenceCount: 0 }, NOW);
    expect(f).toEqual({ overdue: false, dueSoon: false, missingEvidence: false });
  });

  it("flags missing evidence when it is required, none is attached and the deadline is close or passed", () => {
    expect(flagsFor({ status: "open", dueAt: hours(-5), requiresEvidence: true, evidenceCount: 0 }, NOW).missingEvidence).toBe(true);
    expect(flagsFor({ status: "open", dueAt: hours(10), requiresEvidence: true, evidenceCount: 0 }, NOW).missingEvidence).toBe(true);
    expect(flagsFor({ status: "open", dueAt: hours(10), requiresEvidence: true, evidenceCount: 1 }, NOW).missingEvidence).toBe(false);
    expect(flagsFor({ status: "open", dueAt: hours(10), requiresEvidence: false, evidenceCount: 0 }, NOW).missingEvidence).toBe(false);
  });

  it("never flags work that is no longer open", () => {
    for (const status of ["verified", "approved", "rejected"] as const) {
      expect(flagsFor({ status, dueAt: hours(-100), requiresEvidence: true, evidenceCount: 0 }, NOW)).toEqual({
        overdue: false, dueSoon: false, missingEvidence: false,
      });
    }
  });

  it("does not flag work without a deadline", () => {
    expect(flagsFor({ status: "open", dueAt: null, requiresEvidence: true, evidenceCount: 0 }, NOW)).toEqual({
      overdue: false, dueSoon: false, missingEvidence: false,
    });
  });
});

describe("nextDueDate", () => {
  it("returns nothing for work that does not repeat", () => {
    expect(nextDueDate(hours(5), "none", NOW)).toBeNull();
  });

  it("adds one day, week or month to the last deadline", () => {
    const base = new Date("2026-01-31T23:59:59.000Z");
    expect(nextDueDate(base, "daily", NOW)?.toISOString()).toBe("2026-02-01T23:59:59.000Z");
    expect(nextDueDate(base, "weekly", NOW)?.toISOString()).toBe("2026-02-07T23:59:59.000Z");
    expect(nextDueDate(base, "monthly", NOW)?.toISOString()).toBe("2026-02-28T23:59:59.000Z");
  });

  it("counts from now when there was no deadline", () => {
    expect(nextDueDate(null, "daily", NOW)?.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("submissionProblems", () => {
  it("passes when the record is visible and the evidence is there", () => {
    expect(submissionProblems({ requiresEvidence: true, evidenceCount: 2, recordVisible: true })).toEqual([]);
  });

  it("refuses without evidence when evidence is required", () => {
    const p = submissionProblems({ requiresEvidence: true, evidenceCount: 0, recordVisible: true });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/evidence/i);
  });

  it("allows no evidence when it is not required", () => {
    expect(submissionProblems({ requiresEvidence: false, evidenceCount: 0, recordVisible: true })).toEqual([]);
  });

  it("refuses when the record can no longer be seen", () => {
    const p = submissionProblems({ requiresEvidence: false, evidenceCount: 0, recordVisible: false });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/no longer visible/);
  });
});

describe("reviewResult (the lifecycle)", () => {
  it("approve and reject finish verified work", () => {
    expect(reviewResult("verified", "approve")).toBe("approved");
    expect(reviewResult("verified", "reject")).toBe("rejected");
  });

  it("return sends verified work back to open", () => {
    expect(reviewResult("verified", "return")).toBe("open");
  });

  it("nothing can be decided before it is submitted, or after it is decided", () => {
    for (const decision of ["approve", "return", "reject"] as const) {
      expect(reviewResult("open", decision)).toBeNull();
      expect(reviewResult("approved", decision)).toBeNull();
      expect(reviewResult("rejected", decision)).toBeNull();
    }
  });

  it("only return and reject need a comment", () => {
    expect(decisionNeedsComment("approve")).toBe(false);
    expect(decisionNeedsComment("return")).toBe(true);
    expect(decisionNeedsComment("reject")).toBe(true);
  });
});

describe("validation", () => {
  it("turns a calendar date into the end of that day in UTC", () => {
    expect(dueFromDate("2026-11-30")?.toISOString()).toBe("2026-11-30T23:59:59.000Z");
    expect(dueFromDate("")).toBeNull();
    expect(dueFromDate(null)).toBeNull();
  });

  it("accepts a batch with one record and rejects an empty one", () => {
    const base = { title: "Research fintech leads", recordType: "contact", taskType: "research", assigneeId: UUID };
    expect(batchSchema.safeParse({ ...base, recordIds: [UUID] }).success).toBe(true);
    expect(batchSchema.safeParse({ ...base, recordIds: [] }).success).toBe(false);
  });

  it("rejects a batch above 200 records and an unknown task type", () => {
    const base = { title: "Too many", recordType: "account", taskType: "cleaning", assigneeId: UUID };
    expect(batchSchema.safeParse({ ...base, recordIds: Array(201).fill(UUID) }).success).toBe(false);
    expect(batchSchema.safeParse({ ...base, taskType: "lunch", recordIds: [UUID] }).success).toBe(false);
  });

  it("requires a real http or https link for link evidence", () => {
    expect(evidenceSchema.safeParse({ assignmentId: UUID, kind: "link", body: "https://example.com/x" }).success).toBe(true);
    expect(evidenceSchema.safeParse({ assignmentId: UUID, kind: "link", body: "javascript:alert(1)" }).success).toBe(false);
    expect(evidenceSchema.safeParse({ assignmentId: UUID, kind: "link", body: "not a link" }).success).toBe(false);
    expect(evidenceSchema.safeParse({ assignmentId: UUID, kind: "note", body: "Found the owner" }).success).toBe(true);
  });

  it("asks for a comment on return and reject", () => {
    expect(reviewSchema.safeParse({ assignmentId: UUID, decision: "return", comment: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ assignmentId: UUID, decision: "reject", comment: "ok" }).success).toBe(false);
    expect(reviewSchema.safeParse({ assignmentId: UUID, decision: "reject", comment: "Wrong company" }).success).toBe(true);
    expect(reviewSchema.safeParse({ assignmentId: UUID, decision: "approve" }).success).toBe(true);
  });
});
