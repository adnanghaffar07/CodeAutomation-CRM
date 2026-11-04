"use client";
// The "?" keyboard-shortcuts reference (SHELL; BBI Design v2 §11 look).

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Kbd } from "@/components/ui/kbd";
import { NAV_BY_ID, type NavId } from "@/components/shell/nav-items";

export function ShortcutsSheet({ open, onOpenChange, navIds }: { open: boolean; onOpenChange: (o: boolean) => void; navIds: NavId[] }) {
  const groups: { title: string; rows: { keys: string[]; label: string }[] }[] = [
    {
      title: "Everywhere",
      rows: [
        { keys: ["⌘", "K"], label: "Search and commands" },
        { keys: ["/"], label: "Search" },
        { keys: ["Q"], label: "Quick add" },
        { keys: ["T"], label: "New task" },
        { keys: ["N"], label: "Set next step (on a record)" },
        { keys: ["⌘", "⇧", "L"], label: "Switch light / dark" },
        { keys: ["?"], label: "Show this list" },
      ],
    },
    {
      title: "Go to",
      rows: navIds
        .map((id) => NAV_BY_ID[id])
        .filter((n) => n?.go)
        .map((n) => ({ keys: ["G", n.go!.toUpperCase()], label: n.label })),
    },
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Single-key shortcuts pause while you are typing in a field.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {groups.filter((g) => g.rows.length > 0).map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-caption font-medium text-muted-foreground">{g.title}</h3>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-card bg-card shadow-e1">
                {g.rows.map((r) => (
                  <li key={r.label} className="flex min-h-10 items-center justify-between gap-3 px-4 py-2 text-body">
                    <span>{r.label}</span>
                    <span className="flex items-center gap-1">
                      {r.keys.map((k, i) => <Kbd key={`${k}-${i}`}>{k}</Kbd>)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
