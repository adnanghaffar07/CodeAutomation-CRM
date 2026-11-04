import { AppShell } from "@/components/shell/app-shell";
import { NAV_ITEMS } from "@/components/shell/nav-items";
import type { ShellUser } from "@/components/shell/shell-context";

export const dynamic = "force-dynamic";

// Every signed-in page renders inside the shell. Phase 0 has no sign-in yet, so the
// shell shows a demo CEO/Admin in the demo workspace. Phase 1 replaces this with the
// Supabase session, the user's workspace membership and a role-filtered nav.
const DEMO_USER: ShellUser = {
  id: "demo",
  name: "Demo Admin",
  email: "admin@codeautomation.dev",
  role: "ceo_admin",
  workspaceName: "CodeAutomation",
  avatarUrl: null,
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell user={DEMO_USER} navIds={NAV_ITEMS.map((n) => n.id)}>
      {children}
    </AppShell>
  );
}
