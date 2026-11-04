"use client";
// ⌘K palette: page jumps, create actions and appearance. Record search over
// contacts / accounts / opportunities is wired in at Phase 2 (it must go
// through the same visibility rules as every other read).

import * as React from "react";
import { useTheme } from "next-themes";
import { Keyboard, ListTodo, Monitor, Moon, Plus, Rows3, Rows4, Sun } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { applyThemeWithTransition } from "@/components/theme-toggle";
import { setDensity } from "@/lib/appearance";
import { NAV_BY_ID, type NavId } from "@/components/shell/nav-items";

export function CommandPalette({
  open, onOpenChange, navIds, onNavigate, onNewTask, onShortcuts,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  navIds: NavId[];
  onNavigate: (href: string) => void;
  onNewTask: () => void;
  onShortcuts: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const { setTheme } = useTheme();

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.trim();
  const ql = q.toLowerCase();
  const idle = q.length === 0;
  const pages = navIds.map((id) => NAV_BY_ID[id]).filter((n) => n && (idle || n.label.toLowerCase().includes(ql)));
  const showAppearance = idle || (ql.length >= 3 &&
    ["appearance", "theme", "dark", "light", "system", "density", "compact", "comfortable"].some((w) => w.startsWith(ql) || ql.includes(w)));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput placeholder="Jump to a page or run a command…" value={query} onValueChange={setQuery} />
      <CommandList>
        {!idle && pages.length === 0 && !showAppearance && <CommandEmpty>{`Nothing matches “${q}”.`}</CommandEmpty>}
        {pages.length > 0 && (
          <CommandGroup heading="Go to">
            {pages.map((n) => {
              const Icon = n.icon;
              return (
                <CommandItem key={n.id} value={`nav-${n.id}`} onSelect={() => onNavigate(n.href)}>
                  <Icon /> {n.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        {idle && (
          <CommandGroup heading="Create">
            {navIds.includes("contacts") && (
              <CommandItem value="new-contact" onSelect={() => onNavigate("/contacts")}><Plus /> New contact</CommandItem>
            )}
            <CommandItem value="new-task" onSelect={onNewTask}><ListTodo /> New assignment</CommandItem>
            <CommandItem value="shortcuts" onSelect={onShortcuts}><Keyboard /> Keyboard shortcuts</CommandItem>
          </CommandGroup>
        )}
        {showAppearance && (
          <CommandGroup heading="Appearance">
            <CommandItem value="appearance-light" onSelect={() => { applyThemeWithTransition("light", setTheme); onOpenChange(false); }}><Sun /> Appearance: Light</CommandItem>
            <CommandItem value="appearance-dark" onSelect={() => { applyThemeWithTransition("dark", setTheme); onOpenChange(false); }}><Moon /> Appearance: Dark</CommandItem>
            <CommandItem value="appearance-system" onSelect={() => { applyThemeWithTransition("system", setTheme); onOpenChange(false); }}><Monitor /> Appearance: System</CommandItem>
            <CommandItem value="density-comfortable" onSelect={() => { setDensity("comfortable"); onOpenChange(false); }}><Rows3 /> Density: Comfortable</CommandItem>
            <CommandItem value="density-compact" onSelect={() => { setDensity("compact"); onOpenChange(false); }}><Rows4 /> Density: Compact</CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
