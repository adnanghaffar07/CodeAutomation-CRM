import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { UsersPanel, type MemberRow } from "@/components/settings/users-panel";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireUser();
  if (!can(me.role, "users.read")) redirect("/");
  const rows = await withScope(me.scope, (tx) => tx.workspaceMember.findMany({ orderBy: [{ status: "asc" }, { fullName: "asc" }] }));
  const members: MemberRow[] = rows.map((m) => ({
    id: m.id, userId: m.userId, fullName: m.fullName, email: m.email, role: m.role, status: m.status, createdAt: m.createdAt.toISOString(),
  }));
  return (
    <>
      <PageHeader title="Users" subtitle="Who can sign in, and what they can do." icon={<Users />} />
      <UsersPanel members={members} canManage={can(me.role, "users.manage")} meUserId={me.userId} />
    </>
  );
}
