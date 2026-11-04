"use client";
// The "?" keyboard-shortcuts reference (Design v2 §11). Static content only.
import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Kbd } from "@/components/ui/kbd";

const GROUPS: { title: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    title: "Everywhere",
    rows: [
      { keys: ["⌘", "K"], label: "Search and commands" },
      { keys: ["⌘", "⇧", "L"], label: "Switch light / dark" },
      { keys: ["/"], label: "Focus “Jump to…”" },
      { keys: ["?"], label: "Show this list" },
    ],
  },
  {
    title: "Go to",
    rows: [
      { keys: ["G", "A"], label: "Accounts" },
      { keys: ["G", "D"], label: "Deals" },
      { keys: ["G", "T"], label: "Tasks" },
      { keys: ["G", "C"], label: "Chat" },
      { keys: ["G", "N"], label: "Notifications" },
    ],
  },
  {
    title: "Call recaps",
    rows: [
      { keys: ["J"], label: "Next recap" },
      { keys: ["K"], label: "Previous recap" },
      { keys: ["A"], label: "Approve" },
      { keys: ["S"], label: "Skip" },
      { keys: ["E"], label: "Edit" },
    ],
  },
];

export function ShortcutsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Keyboard shortcuts</SheetTitle>
          <SheetDescription>Shortcuts pause while you are typing in a field.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-caption font-medium text-muted-foreground">{g.title}</h3>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-card bg-card shadow-e1">
                {g.rows.map((r) => (
                  <li key={r.label} className="flex min-h-10 items-center justify-between gap-3 px-4 py-2 text-body">
                    <span>{r.label}</span>
                    <span className="flex items-center gap-1">
                      {r.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
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
