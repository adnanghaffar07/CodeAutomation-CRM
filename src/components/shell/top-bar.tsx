"use client";
// Top bar: one neutral translucent row that follows the theme. The material is
// painted on its own aria-hidden layer (backdrop-filter would otherwise make the
// bar the containing block of every fixed descendant). Single-instance chrome.
//
//   lg+:   [workspace]            [Search ⌘K] [+] [🔔] [☀] [avatar]
//   < lg:  [logo] [workspace]     [search] [+] [avatar]   (bottom tab bar navigates)

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/components/ui/cn";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NavId } from "@/components/shell/nav-items";
import { ResponsiveLogo } from "@/components/shell/logo";
import { QuickAddMenu, type QuickAddAction } from "@/components/shell/quick-add";
import { NotificationBell } from "@/components/shell/notifications";
import { UserMenu } from "@/components/shell/user-menu";
import type { ShellUser } from "@/components/shell/shell-context";

const CHROME_IDLE = "text-[hsl(var(--chrome-muted))] hover:bg-foreground/6 hover:text-[hsl(var(--chrome-fg))]";
const ICON_BTN =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-pill tap-clean transition-colors duration-instant max-lg:size-11";

export function TopBar({
  user, navIds, unread, quickAddOpen, onQuickAddOpenChange, onQuickAdd, onOpenSearch, onOpenNotifications, onShortcuts,
}: {
  user: ShellUser;
  navIds: NavId[];
  unread: number;
  quickAddOpen: boolean;
  onQuickAddOpenChange: (o: boolean) => void;
  onQuickAdd: (a: QuickAddAction) => void;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onShortcuts: () => void;
}) {
  return (
    <div className="sticky top-0 z-50">
      <header className="chrome-scope relative z-50 pt-safe text-[hsl(var(--chrome-fg))]">
        <div aria-hidden className="material-bar pointer-events-none absolute inset-0 -z-10 shadow-[inset_0_-1px_0_hsl(var(--border))]" />
        <div className="flex h-12 min-w-0 items-center gap-1 pl-4 pr-1.5 sm:gap-1.5 sm:pr-3 lg:h-14 lg:gap-2 lg:px-5">
          <Link href="/" aria-label="CodeAutomation: dashboard" className="inline-flex shrink-0 items-center rounded-sm py-1 transition-opacity duration-instant hover:opacity-85 lg:hidden">
            <ResponsiveLogo />
          </Link>
          <span className="ml-1 min-w-0 truncate text-headline font-medium tracking-tight text-muted-foreground max-sm:hidden lg:ml-0">
            {user.workspaceName}
          </span>

          <div className="min-w-0 flex-1" />

          <div className="flex shrink-0 items-center gap-0 sm:gap-0.5 lg:gap-1">
            <button
              type="button"
              onClick={onOpenSearch}
              className="chrome-fill mr-1 hidden h-8 w-[200px] items-center gap-2 rounded-pill bg-foreground/[0.06] pl-2.5 pr-1.5 text-body text-tertiary transition-colors duration-base ease-standard hover:bg-foreground/[0.08] xl:flex 2xl:w-[280px]"
            >
              <Search className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">Search…</span>
              <Kbd className="chrome-fill">⌘K</Kbd>
            </button>
            <SimpleTooltip label="Search" shortcut="⌘K">
              <button type="button" onClick={onOpenSearch} aria-label="Search" className={cn(ICON_BTN, CHROME_IDLE, "xl:hidden")}>
                <Search className="size-[18px]" />
              </button>
            </SimpleTooltip>
            <QuickAddMenu
              open={quickAddOpen}
              onOpenChange={onQuickAddOpenChange}
              onAction={onQuickAdd}
              canAddAccount={navIds.includes("contacts")}
              className="mx-1 max-lg:size-9"
            />
            <span className="hidden lg:contents">
              <NotificationBell unread={unread} onOpen={onOpenNotifications} className="lg:mr-0.5" />
            </span>
            <ThemeToggle className="max-lg:hidden" />
            <UserMenu user={user} onShortcuts={onShortcuts} />
          </div>
        </div>
      </header>
    </div>
  );
}
