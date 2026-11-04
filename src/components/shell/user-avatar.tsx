// Round avatar: photo when set, else initials on a stable per-name hue
// (BBI user-avatar). Server-safe.

import * as React from "react";
import { cn } from "@/components/ui/cn";

function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

export function UserAvatar({
  name, avatarUrl, size = 28, className,
}: { name: string; avatarUrl?: string | null; size?: number; className?: string }) {
  const hue = hueOf(name);
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-pill align-middle ring-1 ring-inset ring-foreground/10", className)}
      style={{ width: size, height: size }}
      title={name}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar, tiny, no optimisation needed
        <img src={avatarUrl} alt="" className="size-full object-cover" draggable={false} referrerPolicy="no-referrer" />
      ) : (
        <span
          aria-hidden
          className="grid size-full place-items-center font-semibold text-white"
          style={{ backgroundColor: `hsl(${hue} 45% 42%)`, fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
