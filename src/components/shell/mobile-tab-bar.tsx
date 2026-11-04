"use client";
// Floating capsule tab bar. Below lg only. Home · Contacts · Assignments ·
// Alerts (opens the notification drawer) · More (every section the user may
// see). A tint pill springs to the active tab (one shared layoutId).

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, ChevronRight, LayoutGrid, X } from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { spring } from "@/components/ui/motion";
import { cn } from "@/components/ui/cn";
import { useIsMobile } from "@/hooks/use-media-query";
import { NAV_BY_ID, isNavActive, type NavId, type NavItem } from "@/components/shell/nav-items";
import { CountBadge } from "@/components/shell/notifications";
import type { ShellUser } from "@/components/shell/shell-context";

const TAB = "tap-clean relative isolate flex h-[52px] w-full flex-col items-center justify-center gap-0.5 rounded-pill text-caption2 font-medium transition-[color,transform] duration-instant active:scale-95";

export function primaryTabs(navIds: NavId[]): NavItem[] {
  const pick: NavId[] = ["dashboard", "contacts", "tasks"];
  return pick.filter((id) => navIds.includes(id)).map((id) => NAV_BY_ID[id]);
}

export function MobileTabBar({
  user, navIds, unread, alertsOpen, onOpenNotifications,
}: {
  user: ShellUser;
  navIds: NavId[];
  unread: number;
  alertsOpen: boolean;
  onOpenNotifications: () => void;
}) {
  const isMobile = useIsMobile();
  const pathname = usePathname() ?? "/";
  const [moreOpen, setMoreOpen] = React.useState(false);
  if (!isMobile) return null;
  const tabs = primaryTabs(navIds);

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-3 bottom-[max(8px,env(safe-area-inset-bottom))] z-[60] h-16 rounded-pill px-1.5 material-tabbar md:inset-x-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2 lg:hidden"
      >
        <ul className="flex h-full items-center">
          {tabs.map((tab) => {
            const active = !alertsOpen && !moreOpen && isNavActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <li key={tab.id} className="flex-1">
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={cn(TAB, active ? "text-line-accent-text" : "text-muted-foreground")}>
                  {active && <motion.span layoutId="ca-tab-pill" transition={spring.snappy} aria-hidden className="absolute inset-0 -z-10 rounded-pill bg-line-accent-tint" />}
                  <Icon className="size-6" />
                  <span className={cn("relative max-w-full truncate px-1 leading-none", active && "font-semibold")}>
                    {tab.id === "dashboard" ? "Home" : tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button type="button" onClick={onOpenNotifications} aria-label={unread ? `Alerts, ${unread} unread` : "Alerts"} className={cn(TAB, alertsOpen ? "text-line-accent-text" : "text-muted-foreground")}>
              {alertsOpen && <motion.span layoutId="ca-tab-pill" transition={spring.snappy} aria-hidden className="absolute inset-0 -z-10 rounded-pill bg-line-accent-tint" />}
              <span className="relative">
                <Bell className="size-6" />
                <CountBadge count={unread} className="-right-2.5 -top-1" />
              </span>
              <span className="relative leading-none">Alerts</span>
            </button>
          </li>
          <li className="flex-1">
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className={cn(TAB, moreOpen ? "text-line-accent-text" : "text-muted-foreground")}>
              {moreOpen && <motion.span layoutId="ca-tab-pill" transition={spring.snappy} aria-hidden className="absolute inset-0 -z-10 rounded-pill bg-line-accent-tint" />}
              <LayoutGrid className="size-6" />
              <span className="relative leading-none">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="max-h-[88dvh] bg-background">
          <DrawerHeader className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <DrawerTitle>Everything</DrawerTitle>
              <DrawerDescription>{user.workspaceName}</DrawerDescription>
            </div>
            <DrawerClose aria-label="Close" className="tap-clean inline-flex size-9 items-center justify-center rounded-pill bg-muted text-muted-foreground active:bg-fill-strong">
              <X className="size-4" />
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <section>
              <h3 className="mb-1.5 px-4 text-footnote font-medium text-muted-foreground">Sections</h3>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-card bg-card shadow-e1">
                {navIds.map((id) => {
                  const item = NAV_BY_ID[id];
                  if (!item) return null;
                  const Icon = item.icon;
                  const active = isNavActive(pathname, item);
                  return (
                    <li key={id}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn("flex min-h-12 items-center gap-3 px-4 text-body active:bg-fill-strong", active && "font-semibold")}
                      >
                        <span className={cn("grid size-7 shrink-0 place-items-center rounded-control", active ? "bg-line-accent text-line-accent-foreground" : "bg-muted text-muted-foreground")}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ChevronRight className="size-4 shrink-0 text-tertiary" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
