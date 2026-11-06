// In-app notifications (the bell). Written inside the same transaction as the change that causes them.
import type { Tx } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";

export type NoticeInput = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

/** Writes one notification per recipient. Nobody is notified about their own action. */
export async function notifyPeople(tx: Tx, me: CurrentUser, items: NoticeInput[]): Promise<void> {
  const rows = items
    .filter((i) => i.userId !== me.userId)
    .map((i) => ({
      workspaceId: me.workspaceId,
      userId: i.userId,
      actorId: me.userId,
      kind: i.kind,
      title: i.title,
      body: i.body ?? null,
      link: i.link ?? null,
    }));
  if (rows.length > 0) await tx.notification.createMany({ data: rows });
}

/** Active CEO/Admin and manager accounts in the workspace: who reviews submitted work. */
export async function reviewerIds(tx: Tx): Promise<string[]> {
  const people = await tx.workspaceMember.findMany({
    where: { status: "active", role: { in: ["ceo_admin", "manager"] } },
    select: { userId: true },
  });
  return people.map((p) => p.userId);
}
