"use server";
// User management (CEO/Admin only). Supabase Auth owns the identity; our WorkspaceMember row owns the role and
// status. Every change is audited in the same transaction. Access is handed out as a single-use link that an admin
// passes on (no email service needed): invite = first sign-in, reset = forgotten password.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { requireCapability } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type ActionResult = { ok: true; link?: string; note?: string } | { ok: false; error: string };

const roleSchema = z.enum(["ceo_admin", "manager", "sales_bd", "data_researcher"]);
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  fullName: z.string().trim().min(2).max(120),
  role: roleSchema,
});

const fail = (error: string): ActionResult => ({ ok: false, error });

async function admin() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  requireCapability(user.role, "users.manage");
  return user;
}

function linkFor(hashedToken: string, type: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(type)}`;
}

/** Creates the Supabase user if needed and returns a single-use link (invite for new users, recovery for existing ones). */
async function issueLink(email: string): Promise<{ userId: string; link: string; kind: "invite" | "recovery" }> {
  const sb = createAdminSupabase();
  let res = await sb.auth.admin.generateLink({ type: "invite", email });
  let kind: "invite" | "recovery" = "invite";
  if (res.error) {
    // Already has a Supabase account (for example a second workspace, or a repeat invite): issue a password-setup link instead.
    res = await sb.auth.admin.generateLink({ type: "recovery", email });
    kind = "recovery";
  }
  if (res.error || !res.data?.user || !res.data.properties?.hashed_token) throw new Error(res.error?.message ?? "Could not create the link");
  return { userId: res.data.user.id, link: linkFor(res.data.properties.hashed_token, kind), kind };
}

export async function inviteUser(input: unknown): Promise<ActionResult> {
  try {
    const me = await admin();
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) return fail("Enter a valid name, email and role.");
    const { email, fullName, role } = parsed.data;

    const { userId, link } = await issueLink(email);
    const existing = await withScope(me.scope, (tx) =>
      tx.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: me.workspaceId, userId } } }),
    );
    if (existing) return fail("That person is already a member. Use their row to reset access instead.");

    await withScope(me.scope, async (tx) => {
      await tx.workspaceMember.create({ data: { workspaceId: me.workspaceId, userId, email, fullName, role } });
      await audit(tx, me.scope, { action: "user.invited", entityType: "user", entityId: userId, meta: { email, role } });
    });
    revalidatePath("/settings/users");
    return { ok: true, link, note: "Send this single-use link to the person. It signs them in so they can choose a password." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function changeRole(memberId: string, role: string): Promise<ActionResult> {
  try {
    const me = await admin();
    const r = roleSchema.safeParse(role);
    if (!z.string().uuid().safeParse(memberId).success || !r.success) return fail("Invalid request.");

    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const m = await tx.workspaceMember.findUnique({ where: { id: memberId } });
      if (!m) return fail("Member not found.");
      if (m.userId === me.userId) return fail("You can't change your own role.");
      if (m.role === r.data) return { ok: true };
      if (m.role === "ceo_admin") {
        const others = await tx.workspaceMember.count({ where: { role: "ceo_admin", status: "active", id: { not: m.id } } });
        if (others === 0) return fail("A workspace needs at least one active CEO/Admin.");
      }
      await tx.workspaceMember.update({ where: { id: memberId }, data: { role: r.data } });
      await audit(tx, me.scope, { action: "user.role_changed", entityType: "user", entityId: m.userId, meta: { email: m.email, from: m.role, to: r.data } });
      revalidatePath("/settings/users");
      return { ok: true };
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function setStatus(memberId: string, status: "active" | "suspended"): Promise<ActionResult> {
  try {
    const me = await admin();
    if (!z.string().uuid().safeParse(memberId).success || !["active", "suspended"].includes(status)) return fail("Invalid request.");

    const target = await withScope(me.scope, (tx) => tx.workspaceMember.findUnique({ where: { id: memberId } }));
    if (!target) return fail("Member not found.");
    if (target.userId === me.userId) return fail("You can't suspend yourself.");
    const sb = createAdminSupabase();

    if (status === "active") {
      // Lift the Supabase ban first; if that fails nothing changes.
      const { error } = await sb.auth.admin.updateUserById(target.userId, { ban_duration: "none" });
      if (error) return fail(error.message);
    }
    const result = await withScope(me.scope, async (tx): Promise<ActionResult> => {
      if (status === "suspended" && target.role === "ceo_admin") {
        const others = await tx.workspaceMember.count({ where: { role: "ceo_admin", status: "active", id: { not: target.id } } });
        if (others === 0) return fail("A workspace needs at least one active CEO/Admin.");
      }
      await tx.workspaceMember.update({ where: { id: memberId }, data: { status } });
      await audit(tx, me.scope, {
        action: status === "suspended" ? "user.suspended" : "user.reinstated",
        entityType: "user", entityId: target.userId, meta: { email: target.email },
      });
      return { ok: true };
    });
    if (!result.ok) return result;

    let note: string | undefined;
    if (status === "suspended") {
      // Our own status already blocks the next request. Banning in Supabase also stops new sign-ins and refreshes.
      const { error } = await sb.auth.admin.updateUserById(target.userId, { ban_duration: "876000h" });
      if (error) note = "Suspended in the CRM (access is already blocked). The Supabase ban could not be applied: " + error.message;
    }
    revalidatePath("/settings/users");
    return { ok: true, note };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function issueAccessLink(memberId: string): Promise<ActionResult> {
  try {
    const me = await admin();
    if (!z.string().uuid().safeParse(memberId).success) return fail("Invalid request.");
    const m = await withScope(me.scope, (tx) => tx.workspaceMember.findUnique({ where: { id: memberId } }));
    if (!m) return fail("Member not found.");
    if (m.status !== "active") return fail("Reinstate this person before issuing a link.");

    const { link } = await issueLink(m.email);
    await withScope(me.scope, (tx) => audit(tx, me.scope, { action: "user.link_issued", entityType: "user", entityId: m.userId, meta: { email: m.email } }));
    return { ok: true, link, note: "Single-use link to choose a new password. It expires in about an hour." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}
