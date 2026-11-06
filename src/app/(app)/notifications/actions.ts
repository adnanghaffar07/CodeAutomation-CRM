"use server";
// The notification bell: a person reads and marks read only their own notifications (row-level security enforces it too).
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { currentUser } from "@/lib/session";
import { errorMessage, fail, type ActionResult } from "@/lib/records/server";

export type NoticeRow = { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export async function getUnreadCount(): Promise<ActionResult<{ count: number }>> {
  try {
    const me = await currentUser();
    if (!me) return { ok: true, count: 0 };
    const count = await withScope(me.scope, (tx) => tx.notification.count({ where: { userId: me.userId, readAt: null } }));
    return { ok: true, count };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function listNotifications(): Promise<ActionResult<{ items: NoticeRow[] }>> {
  try {
    const me = await currentUser();
    if (!me) return { ok: true, items: [] };
    const rows = await withScope(me.scope, (tx) => tx.notification.findMany({
      where: { userId: me.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, kind: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }));
    return {
      ok: true,
      items: rows.map((r) => ({ ...r, readAt: r.readAt ? r.readAt.toISOString() : null, createdAt: r.createdAt.toISOString() })),
    };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function markNotificationsRead(ids: unknown): Promise<ActionResult> {
  try {
    const me = await currentUser();
    if (!me) return fail("Not signed in");
    const p = z.union([z.literal("all"), z.array(z.string().uuid()).max(100)]).safeParse(ids);
    if (!p.success) return fail("Invalid request.");
    await withScope(me.scope, (tx) => tx.notification.updateMany({
      where: { userId: me.userId, readAt: null, ...(p.data === "all" ? {} : { id: { in: p.data } }) },
      data: { readAt: new Date() },
    }));
    return { ok: true };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
