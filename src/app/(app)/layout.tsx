import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NAV_ITEMS, isNavActive } from "@/components/shell/nav-items";
import { visibleNavIds } from "@/components/shell/nav-access";
import type { ShellUser } from "@/components/shell/shell-context";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Every signed-in page renders inside the shell. requireUser() sends anyone without an active membership to
// the sign-in page, so a suspended person is locked out on their very next request.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const navIds = visibleNavIds(user.role);

  // Guard a section by URL: a role that cannot see it in the menu cannot open it by typing the address either.
  const path = headers().get("x-pathname") ?? "/";
  const section = NAV_ITEMS.find((n) => isNavActive(path, n));
  if (section && !navIds.includes(section.id)) redirect("/");

  const shellUser: ShellUser = {
    id: user.userId,
    name: user.fullName,
    email: user.email,
    role: user.role,
    workspaceName: user.workspaceName,
    avatarUrl: null,
  };
  return (
    <AppShell user={shellUser} navIds={navIds}>
      {children}
    </AppShell>
  );
}
