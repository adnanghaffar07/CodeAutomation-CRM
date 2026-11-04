"use client";
// Side navigation (UI polish, 10/12/26 — owner's request): the primary nav
// moves from the top bar to a frosted-glass sidebar on the left (lg and up;
// phones keep the bottom tab bar). Expanded it shows icon + name in groups;
// collapsed it is an icon rail and every item says its name in a tooltip.
// The collapsed / expanded choice is remembered per browser.
//
// Single-instance navigation chrome, so it may carry the material (see the
// paint guard): fixed, always visible, never per row.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, PanelLeftClose } from "lucide-react";
import { spring } from "@/components/ui/motion";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/cn";
import { NAV_BY_ID, isNavActive, type NavId, type NavItem } from "@/components/shell/nav-items";
import { Logo } from "@/components/shell/logo";

/** Groups, in order (owner's request: Outreach right after Accounts; Clients under "More"). */
const GROUPS: { label: string; ids: NavId[] }[] = [
  { label: "Workspace", ids: ["dashboard", "contacts", "accounts", "pipeline", "tasks"] },
  { label: "Data", ids: ["imports", "exports", "integrations"] },
  { label: "Insight", ids: ["reports"] },
];
const FOOTER: NavId[] = ["settings"];

const KEY = "ca.sidebar";
export const SIDEBAR_W = { open: 248, closed: 72 } as const;

export function useSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === "closed"); } catch { /* storage blocked: stay open */ }
  }, []);
  const set = React.useCallback((v: boolean) => {
    setCollapsed(v);
    try { localStorage.setItem(KEY, v ? "closed" : "open"); } catch { /* ignore */ }
  }, []);
  return [collapsed, set];
}

// Open / close is one smooth motion (UI polish 10/12/26): the rail's width
// eases, every icon keeps its exact position, and the labels, group headings
// and the logo's wordmark fade and slide rather than popping in and out.
const ITEM =
  "group/nav relative isolate flex h-9 w-full items-center gap-3 overflow-hidden rounded-control px-[15px] text-footnote font-medium tap-clean transition-[background-color,color] duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const fade = (collapsed: boolean) =>
  cn(
    "whitespace-nowrap transition-[opacity,transform] duration-moderate ease-standard",
    collapsed ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100 delay-75",
  );

/** `expandable`: the item has others nested under it (Sent under Inbox). Clicking it opens them and goes to its page; the small arrow opens or closes them without leaving the page. */
function Item({ item, collapsed, active, badge = 0, expandable = false, expanded = false, onToggle, onOpen, children }: { item: NavItem; collapsed: boolean; active: boolean; badge?: number; expandable?: boolean; expanded?: boolean; onToggle?: () => void; onOpen?: () => void; children?: React.ReactNode }) {
  const count = badge > 99 ? "99+" : String(badge);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onOpen}
      // an item nested under another (Sent under Inbox) is indented while the rail is open; in the narrow rail it is just the next icon
      className={cn(ITEM, item.parent && !collapsed && "!ml-4 !w-[calc(100%-1rem)] !h-8", active ? "font-semibold text-line-accent-text" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground")}
    >
      {/* The highlight and edge marker glide from item to item (one shared layoutId). */}
      {active && <motion.span layoutId="side-nav-pill" transition={spring.snappy} aria-hidden className="absolute inset-0 -z-10 rounded-control bg-line-accent-tint" />}
      <Icon className="size-[18px] shrink-0 transition-transform duration-fast ease-standard group-hover/nav:scale-110" />
      <span className={cn("truncate", fade(collapsed))}>{item.label}</span>
      {badge > 0 && (
        <>
          {/* Open: a count pill at the row's end. Closed: a dot on the icon. */}
          <span aria-label={`${count} unread`} className={cn("ml-auto rounded-pill bg-brand px-1.5 py-px text-caption2 font-semibold tabular-nums text-white", expandable && "mr-6", fade(collapsed))}>{count}</span>
          <span aria-hidden className={cn("absolute left-[29px] top-2 size-2 rounded-pill bg-brand ring-2 ring-card transition-opacity duration-moderate", collapsed ? "opacity-100" : "opacity-0")} />
        </>
      )}
    </Link>
  );
  return (
    <li className="relative min-w-0">
      {active && <motion.span layoutId="side-nav-edge" transition={spring.snappy} aria-hidden className="absolute -left-3 top-2 h-6 w-[3px] rounded-pill bg-line-accent" />}
      {collapsed ? <SimpleTooltip label={badge > 0 ? `${item.label} · ${count} unread` : item.label} side="right">{link}</SimpleTooltip> : link}
      {expandable && !collapsed && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} what is under ${item.label}`}
          className="absolute right-2 top-1.5 grid size-6 place-items-center rounded-control text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-fast ease-standard", expanded ? "rotate-180" : "rotate-0")} />
        </button>
      )}
      {expandable && expanded && <ul className="mt-1 grid grid-cols-1 gap-1">{children}</ul>}
    </li>
  );
}

export function SideNav({ navIds, collapsed, onCollapsedChange, badges = {} }: { navIds: NavId[]; collapsed: boolean; onCollapsedChange: (v: boolean) => void; badges?: Partial<Record<NavId, number>> }) {
  const pathname = usePathname() ?? "/";
  // a parent (Inbox) with something nested under it (Sent) is open when you are in that section, unless you closed it by hand
  const [openByHand, setOpenByHand] = React.useState<Partial<Record<NavId, boolean>>>({});
  const has = (id: NavId) => navIds.includes(id);
  const childrenOf = (id: NavId) => navIds.map((x) => NAV_BY_ID[x]).filter((n) => n.parent === id);
  const inSection = (n: NavItem) => isNavActive(pathname, n) || childrenOf(n.id).some((c) => isNavActive(pathname, c));
  const isOpen = (n: NavItem) => openByHand[n.id] ?? inSection(n);
  const groups = GROUPS.map((g) => ({ ...g, items: g.ids.filter(has).map((id) => NAV_BY_ID[id]) })).filter((g) => g.items.length);
  const footer = FOOTER.filter(has).map((id) => NAV_BY_ID[id]);
  const toggle = (
    <button
      type="button"
      onClick={() => onCollapsedChange(!collapsed)}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      className={cn(ITEM, "text-footnote text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground")}
    >
      <PanelLeftClose className={cn("size-[18px] shrink-0 transition-transform duration-moderate ease-standard", collapsed && "rotate-180")} />
      <span className={fade(collapsed)}>Collapse</span>
    </button>
  );

  return (
    <aside
      aria-label="Sidebar"
      style={{ width: collapsed ? SIDEBAR_W.closed : SIDEBAR_W.open }}
      className="material-sidebar fixed inset-y-0 left-0 z-[55] hidden flex-col overflow-hidden pt-safe transition-[width] duration-moderate ease-standard lg:flex"
    >
      <div className="flex h-14 shrink-0 items-center pl-[21px]">
        {/* The full logo starts with the icon, so clipping it to the icon's width
            is the collapsed mark — the icon never moves. */}
        <Link
          href="/"
          aria-label="Dashboard"
          className={cn(
            "inline-flex overflow-hidden rounded-sm transition-[max-width,opacity] duration-moderate ease-standard hover:opacity-85",
            collapsed ? "max-w-[30px]" : "max-w-[220px]",
          )}
        >
          <Logo className="h-7" />
        </Link>
      </div>

      <nav aria-label="Primary" className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-2">
        {groups.map((g, i) => (
          <div key={g.label} className={cn(i > 0 && "mt-4")}>
            <div className="relative mb-1.5 h-5">
              <p className={cn("absolute inset-y-0 left-3 flex items-center text-caption2 font-semibold uppercase tracking-[0.08em] text-tertiary", fade(collapsed))}>{g.label}</p>
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-3 top-1/2 h-px w-6 bg-border transition-opacity duration-moderate ease-standard",
                    collapsed ? "opacity-100 delay-100" : "opacity-0",
                  )}
                />
              )}
            </div>
            <ul className="grid grid-cols-1 gap-1">
              {g.items
                .filter((n) => !n.parent || !has(n.parent)) // an item nested under another is drawn inside its parent
                .map((n) => {
                  const kids = childrenOf(n.id);
                  return (
                    <Item
                      key={n.id}
                      item={n}
                      collapsed={collapsed}
                      active={isNavActive(pathname, n)}
                      badge={badges[n.id]}
                      expandable={kids.length > 0}
                      expanded={isOpen(n)}
                      onToggle={() => setOpenByHand((o) => ({ ...o, [n.id]: !isOpen(n) }))}
                      onOpen={() => kids.length > 0 && setOpenByHand((o) => ({ ...o, [n.id]: true }))}
                    >
                      {kids.map((c) => <Item key={c.id} item={c} collapsed={collapsed} active={isNavActive(pathname, c)} badge={badges[c.id]} />)}
                    </Item>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border/60 px-3 py-3">
        {footer.length > 0 && (
          <ul className="mb-1 grid grid-cols-1 gap-1">
            {footer.map((n) => <Item key={n.id} item={n} collapsed={collapsed} active={isNavActive(pathname, n)} />)}
          </ul>
        )}
        {collapsed ? <SimpleTooltip label="Expand sidebar" side="right">{toggle}</SimpleTooltip> : toggle}
      </div>
    </aside>
  );
}
