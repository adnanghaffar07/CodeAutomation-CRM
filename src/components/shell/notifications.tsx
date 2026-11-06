"use client";
// Notification bell + drawer. The count is read from the server when the shell loads, every 20 seconds, and when the page
// comes back into view. Opening the drawer lists the latest notifications; clicking one marks it read and opens it.

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { getUnreadCount, listNotifications, markNotificationsRead, type NoticeRow } from "@/app/(app)/notifications/actions";

const POLL_MS = 20_000;

/** Shell-wide unread count, plus a function to reload it. */
export function useUnreadCount(): [number, () => void] {
  const [unread, setUnread] = React.useState(0);
  const load = React.useCallback(async () => {
    const r = await getUnreadCount();
    if (r.ok) setUnread(r.count);
  }, []);
  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);
  return [unread, () => void load()];
}

export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-destructive-solid px-1 text-caption2 font-semibold leading-none tabular-nums text-white ring-2 ring-[hsl(var(--background))]",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NotificationBell({ unread, onOpen, className }: { unread: number; onOpen: () => void; className?: string }) {
  const label = unread === 0 ? "Notifications" : `${unread} unread notification${unread === 1 ? "" : "s"}`;
  return (
    <SimpleTooltip label={label}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className={cn(
          "relative inline-flex size-8 shrink-0 items-center justify-center rounded-pill text-[hsl(var(--chrome-muted))] tap-clean transition-colors duration-instant hover:bg-foreground/6 hover:text-[hsl(var(--chrome-fg))]",
          className,
        )}
      >
        <Bell className="size-[18px]" />
        <CountBadge count={unread} className="-right-1 -top-1" />
      </button>
    </SimpleTooltip>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function NotificationsDrawer({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; unread?: number; onChanged?: () => void }) {
  const router = useRouter();
  const [items, setItems] = React.useState<NoticeRow[] | null>(null);

  const load = React.useCallback(async () => {
    const r = await listNotifications();
    setItems(r.ok ? r.items : []);
  }, []);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function openItem(n: NoticeRow) {
    if (!n.readAt) {
      await markNotificationsRead([n.id]);
      onChanged?.();
    }
    onOpenChange(false);
    if (n.link) router.push(n.link);
    else await load();
  }

  async function markAll() {
    await markNotificationsRead("all");
    onChanged?.();
    await load();
  }

  const hasUnread = !!items?.some((n) => !n.readAt);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Assignments, approvals and sync problems that need you.</SheetDescription>
        </SheetHeader>
        {hasUnread && (
          <div className="px-5 pt-3">
            <Button variant="ghost" size="sm" onClick={markAll}><CheckCheck />Mark all as read</Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items === null ? (
            <p className="text-footnote text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState icon={<Bell />} title="You're all caught up" hint="Nothing needs your attention right now." />
          ) : (
            <ul className="space-y-2">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={cn(
                      "w-full rounded-card-inner p-3 text-left transition-colors hover:bg-foreground/5",
                      n.readAt ? "bg-muted" : "bg-brand-tint",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-footnote font-medium">{n.title}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">{when(n.createdAt)}</span>
                    </div>
                    {n.body && <p className="mt-1 line-clamp-2 text-footnote text-muted-foreground">{n.body}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-caption text-muted-foreground">
            Assignments: <Link href="/tasks" className="text-brand-text hover:underline" onClick={() => onOpenChange(false)}>open Assignments</Link>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
