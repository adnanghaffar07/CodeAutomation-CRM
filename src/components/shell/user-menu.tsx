"use client";
// Account menu: who you are, your role in the workspace, Appearance (theme Light / Dark / System + density Comfortable /
// Compact — instant, per device), keyboard shortcuts, sign out.

import * as React from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Keyboard, LogOut, Monitor, Moon, Rows3, Rows4, Shield, Sun } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DENSITY_EVENT, DENSITY_KEY, applyDensity, readDensity, setDensity, type Density } from "@/lib/appearance";
import { UserAvatar } from "@/components/shell/user-avatar";
import type { ShellUser } from "@/components/shell/shell-context";

export const ROLE_LABEL: Record<string, string> = {
  ceo_admin: "CEO / Admin", manager: "Manager", sales_bd: "Sales / BD", data_researcher: "Data researcher",
};

// Phase 1 replaces this with Supabase Auth sign-out.
export async function signOut(): Promise<void> {
  toast.info("Sign-in arrives in Phase 1. You are viewing the demo workspace.");
}

function useDensity(): [Density, (d: Density) => void] {
  const [d, setD] = React.useState<Density>("comfortable");
  React.useEffect(() => {
    setD(readDensity());
    const onLocal = (e: Event) => setD(((e as CustomEvent).detail as Density) ?? readDensity());
    const onStorage = (e: StorageEvent) => {
      if (e.key !== DENSITY_KEY) return;
      const next = readDensity();
      applyDensity(next);
      setD(next);
    };
    window.addEventListener(DENSITY_EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(DENSITY_EVENT, onLocal); window.removeEventListener("storage", onStorage); };
  }, []);
  return [d, (next) => { setDensity(next); setD(next); }];
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const [density, changeDensity] = useDensity();
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-footnote font-medium text-muted-foreground">Theme</div>
        <SegmentedControl
          aria-label="Theme" size="md" fullWidth collapseOnMobile={false}
          value={mounted ? ((theme as "light" | "dark" | "system") ?? "system") : null}
          onValueChange={(v) => setTheme(v)}
          options={[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System", icon: Monitor },
          ]}
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-footnote font-medium text-muted-foreground">Density</div>
        <SegmentedControl
          aria-label="Density" size="md" fullWidth collapseOnMobile={false}
          value={mounted ? density : null} onValueChange={changeDensity}
          options={[
            { value: "comfortable", label: "Comfortable", icon: Rows3 },
            { value: "compact", label: "Compact", icon: Rows4 },
          ]}
        />
      </div>
    </div>
  );
}

export function UserMenu({ user, onShortcuts }: { user: ShellUser; onShortcuts: () => void }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={user.name}
          aria-label="Account and appearance"
          className="group inline-flex shrink-0 items-center justify-center rounded-pill tap-clean transition-transform duration-instant ease-standard active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:size-11"
        >
          <span className="inline-flex rounded-pill transition-shadow duration-instant group-hover:ring-2 group-hover:ring-foreground/10 group-data-[state=open]:ring-2 group-data-[state=open]:ring-brand/40">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={28} />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[calc(100dvh-72px)] w-[min(320px,calc(100vw-16px))] overflow-y-auto">
        <DropdownMenuLabel className="px-2.5 pb-2 pt-2 font-normal">
          <div className="flex items-center gap-3">
            <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size={44} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-headline text-foreground">{user.name}</span>
              <span className="truncate text-footnote text-muted-foreground">{user.email}</span>
              <span className="mt-1 flex flex-wrap gap-1">
                <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-brand-tint px-2 py-0.5 text-caption2 font-semibold text-brand-text">
                  <Shield className="size-3" /> {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2.5 py-2">
          <span className="mb-2 block text-caption font-medium text-muted-foreground">Appearance</span>
          <AppearanceSettings />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onShortcuts} className="max-lg:hidden">
          <Keyboard /> Keyboard shortcuts <span className="ml-auto text-caption text-muted-foreground">?</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="text-destructive data-[highlighted]:bg-destructive-solid data-[highlighted]:text-white [&_svg]:text-destructive data-[highlighted]:[&_svg]:text-white"
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
