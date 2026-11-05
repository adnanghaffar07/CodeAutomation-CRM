// Who is making this request? Proves identity with Supabase Auth, then loads the person's CRM membership
// (workspace, role, status) from our own table on EVERY request, so a suspension or role change takes
// effect immediately even though the Supabase session cookie is still valid.
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { withSystem, type Role, type Scope } from "@/lib/scope";

export type CurrentUser = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
  workspaceId: string;
  workspaceName: string;
  scope: Scope & { email: string };
};

/** The signed-in, active member, or null. Cached for the duration of one request. */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const authUser = data.user;

  // Sign-in lookup happens before a scope exists, so it runs as the system and filters by the verified user id.
  const member = await withSystem((tx) =>
    tx.workspaceMember.findFirst({
      where: { userId: authUser.id, status: "active" },
      orderBy: { createdAt: "asc" },
      include: { workspace: { select: { name: true } } },
    }),
  );
  if (!member) return null;

  const email = member.email || authUser.email || "";
  return {
    userId: authUser.id,
    email,
    fullName: member.fullName,
    role: member.role,
    workspaceId: member.workspaceId,
    workspaceName: member.workspace.name,
    scope: { userId: authUser.id, workspaceId: member.workspaceId, role: member.role, email },
  };
});

/** For pages and layouts: send anyone without an active membership to the sign-in page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
