"use client";
// Notification bell + drawer. Phase 0 is the empty shell: the data source
// (a Notification table, written by assignments, approvals and integrations)
// arrives in Phase 4+. The API of these exports is final so the shell
// does not change when real data is wired in.

import * as React from "react";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/ui/cn";

/** Shell-wide unread count. Always 0 until notifications exist. */
export function useUnreadCount(): [number, () => void] {
  const [unread] = React.useState(0);
  return [unread, () => undefined];
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

export function NotificationsDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void; unread?: number; onChanged?: () => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Assignments, approvals and sync problems that need you.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <EmptyState icon={<Bell />} title="You're all caught up" hint="Nothing needs your attention right now." />
        </div>
      </SheetContent>
    </Sheet>
  );
}
