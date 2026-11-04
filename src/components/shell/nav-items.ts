// Primary navigation. Pure data: safe for client and server. Which items a
// user sees is decided server-side (nav-access.ts, from the role) and passed
// down as ids. `go` is the G-chord key (G then key), see use-shell-shortcuts.ts.

import type * as React from "react";
import {
  BarChart3, Building2, ClipboardCheck, Download, Kanban, LayoutDashboard, Plug, Settings, Upload, Users,
} from "lucide-react";

export type NavId =
  | "dashboard" | "contacts" | "accounts" | "pipeline" | "tasks" | "imports" | "exports" | "integrations"
  | "reports" | "settings";

export type NavItem = {
  id: NavId;
  label: string;
  href: string;
  /** Other path prefixes that light this item up. */
  also?: string[];
  icon: React.ComponentType<{ className?: string }>;
  go?: string;
  /** Path prefixes that do NOT light this item up although they start with its href. */
  except?: string[];
  /** Shown nested under this item in the sidebar. */
  parent?: NavId;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard, go: "d" },
  { id: "contacts", label: "Contacts", href: "/contacts", icon: Users, go: "c" },
  { id: "accounts", label: "Accounts", href: "/accounts", icon: Building2, go: "a" },
  { id: "pipeline", label: "Pipeline", href: "/pipeline", icon: Kanban, go: "p" },
  { id: "tasks", label: "Assignments", href: "/tasks", icon: ClipboardCheck, go: "t" },
  { id: "imports", label: "Imports", href: "/imports", icon: Upload, go: "i" },
  { id: "exports", label: "Exports", href: "/exports", icon: Download, go: "e" },
  { id: "integrations", label: "Integrations", href: "/integrations", icon: Plug, go: "n" },
  { id: "reports", label: "Reports", href: "/reports", icon: BarChart3, go: "r" },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, go: "s" },
];

export const NAV_BY_ID: Record<NavId, NavItem> = Object.fromEntries(NAV_ITEMS.map((n) => [n.id, n])) as Record<NavId, NavItem>;

export function isNavActive(pathname: string, item: NavItem): boolean {
  const matches = (prefix: string) => (prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (item.except?.some(matches)) return false;
  return matches(item.href) || (item.also?.some(matches) ?? false);
}
