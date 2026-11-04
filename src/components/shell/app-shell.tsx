"use client";
// AppShell: owns the chrome state (command palette, quick-add, notification
// drawer, shortcuts sheet) and the global dialog roots. The server layout
// (src/app/(app)/layout.tsx) decides who the user is and which nav they see.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ConfirmDialogRoot } from "@/components/ui/confirm-dialog";
import { flipTheme } from "@/components/theme-toggle";
import { ShellUserProvider, type ShellUser } from "@/components/shell/shell-context";
import { TopBar } from "@/components/shell/top-bar";
import { PageMotion } from "@/components/shell/page-motion";
import { NavigationLoader } from "@/components/shell/navigation-loader";
import { SIDEBAR_W, SideNav, useSidebarCollapsed } from "@/components/shell/side-nav";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { CommandPalette } from "@/components/shell/command-palette";
import { NotificationsDrawer, useUnreadCount } from "@/components/shell/notifications";
import { ShortcutsSheet } from "@/components/shell/shortcuts-sheet";
import { useShellShortcuts } from "@/components/shell/use-shell-shortcuts";
import type { QuickAddAction } from "@/components/shell/quick-add";
import type { NavId } from "@/components/shell/nav-items";

export function AppShell({ user, navIds, children }: { user: ShellUser; navIds: NavId[]; children: React.ReactNode }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const themeRef = React.useRef({ resolvedTheme, setTheme });
  themeRef.current = { resolvedTheme, setTheme };

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [unread] = useUnreadCount();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();

  const soon = React.useCallback((what: string) => toast.message(`${what} arrives in a later phase.`), []);

  useShellShortcuts(navIds, {
    onPalette: () => setPaletteOpen((o) => !o),
    onQuickAdd: () => setQuickAddOpen(true),
    onTask: () => soon("Assignments"),
    onNextStepUnhandled: () => toast.message("Open a contact or opportunity to set its next step."),
    onHelp: () => setShortcutsOpen(true),
    onFlipTheme: () => flipTheme(themeRef.current.resolvedTheme, themeRef.current.setTheme),
  });

  const onQuickAdd = React.useCallback((a: QuickAddAction) => {
    setQuickAddOpen(false);
    if (a === "contact") router.push("/contacts");
    else if (a === "account") router.push("/accounts");
    else soon(a === "task" ? "Assignments" : "Notes");
  }, [router, soon]);

  return (
    <ShellUserProvider user={user}>
      <div aria-hidden className="app-backdrop" />
      <SideNav navIds={navIds} collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
      <div
        className="flex min-h-[100dvh] flex-col transition-[padding] duration-moderate ease-standard lg:pl-[var(--sidebar-w)]"
        style={{ "--sidebar-w": `${sidebarCollapsed ? SIDEBAR_W.closed : SIDEBAR_W.open}px` } as React.CSSProperties}
      >
        <TopBar
          user={user}
          navIds={navIds}
          unread={unread}
          quickAddOpen={quickAddOpen}
          onQuickAddOpenChange={setQuickAddOpen}
          onQuickAdd={onQuickAdd}
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenNotifications={() => setNotifOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
        />
        <NavigationLoader />
        <main id="main" className="flex-1">
          {/* pb-tabbar reserves the floating tab bar below lg. overflow-x-clip (not hidden) stops a stray wide
              child without creating a scroll container that would break sticky headers. */}
          <PageMotion className="mx-auto max-w-[1700px] overflow-x-clip px-4 pb-tabbar pt-4 md:px-6 md:pt-5 lg:pb-8">
            {children}
          </PageMotion>
        </main>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          navIds={navIds}
          onNavigate={(href) => { setPaletteOpen(false); router.push(href); }}
          onNewTask={() => { setPaletteOpen(false); soon("Assignments"); }}
          onShortcuts={() => { setPaletteOpen(false); setShortcutsOpen(true); }}
        />
        <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
        <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} navIds={navIds} />
        <ConfirmDialogRoot />
        <MobileTabBar user={user} navIds={navIds} unread={unread} alertsOpen={notifOpen} onOpenNotifications={() => setNotifOpen(true)} />
      </div>
    </ShellUserProvider>
  );
}
