// Shared plumbing for the record server actions (not itself a "use server" file, so it can export anything).
import { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { currentUser, type CurrentUser } from "@/lib/session";
import { can, requireCapability, type Capability } from "@/lib/permissions";
export * from "@/lib/records/schemas";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** The signed-in member, who must hold `cap`. */
export async function actor(cap: Capability): Promise<CurrentUser> {
  const me = await currentUser();
  if (!me) throw new Error("Not signed in");
  requireCapability(me.role, cap);
  return me;
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong.");

/** A unique-constraint failure tells the caller only that the value exists, never whose record holds it (SPEC R-8.9). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

type TimelineEntry = {
  recordType: "contact" | "account";
  recordId: string;
  kind: "note" | "change" | "system" | "email" | "call" | "meeting" | "task";
  summary: string;
  body?: string | null;
  detail?: Prisma.InputJsonValue;
};

/** Adds entries to the timeline of one or more records, as the signed-in member. */
export async function logActivity(tx: Tx, me: CurrentUser, entries: TimelineEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await tx.activity.createMany({
    data: entries.map((e) => ({
      workspaceId: me.workspaceId,
      recordType: e.recordType,
      recordId: e.recordId,
      kind: e.kind,
      summary: e.summary,
      body: e.body ?? null,
      detail: e.detail,
      actorId: me.userId,
      actorEmail: me.email,
      source: e.kind === "system" ? ("system" as const) : ("manual" as const),
    })),
  });
}

export const canReassign = (me: CurrentUser) => can(me.role, "assignments.manage");
