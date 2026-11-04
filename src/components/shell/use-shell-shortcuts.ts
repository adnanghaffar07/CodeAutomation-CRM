"use client";
// Keyboard shortcuts (SHELL, SPEC §13 "search, quick-add, task & next step").
//   ⌘K / Ctrl+K   search palette (works while typing)
//   ⌘⇧L          flip light / dark
//   /            search palette        ?   shortcuts sheet
//   Q            quick-add menu        T   new task
//   N            next step — dispatches the cancelable window CustomEvent
//                "ca:next-step"; a record page that can set one calls
//                preventDefault(). Unhandled → onNextStepUnhandled().
//   G then D/C/A/P/T/I/E/N/R/S   go to a section (nav-items.ts `go`)
// Single keys pause while a field has focus or a modifier is held.

import * as React from "react";
import { useRouter } from "next/navigation";
import { NAV_BY_ID, type NavId } from "@/components/shell/nav-items";

export const NEXT_STEP_EVENT = "ca:next-step";

export function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || typeof t.tagName !== "string") return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable === true;
}

/** Fire the next-step request; true when a page handled it. */
export function requestNextStep(): boolean {
  const ev = new CustomEvent(NEXT_STEP_EVENT, { cancelable: true });
  return !window.dispatchEvent(ev);
}

export type ShellShortcutHandlers = {
  onPalette: () => void;
  onQuickAdd: () => void;
  onTask: () => void;
  onNextStepUnhandled: () => void;
  onHelp: () => void;
  onFlipTheme: () => void;
};

export function useShellShortcuts(navIds: NavId[], handlers: ShellShortcutHandlers) {
  const router = useRouter();
  const ref = React.useRef(handlers);
  ref.current = handlers;
  const navKey = navIds.join(",");

  React.useEffect(() => {
    const goMap = new Map<string, string>();
    for (const id of navKey.split(",") as NavId[]) {
      const n = NAV_BY_ID[id];
      if (n?.go) goMap.set(n.go, n.href);
    }
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      const h = ref.current;
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === "k" || e.key === "K") && !e.shiftKey) {
        e.preventDefault(); h.onPalette(); return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault(); h.onFlipTheme(); return;
      }
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTyping(e.target) || isTyping(document.activeElement)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      const k = e.key.toLowerCase();
      if (e.key === "?") { e.preventDefault(); h.onHelp(); return; }
      if (pendingG && Date.now() - pendingG < 1200 && goMap.has(k)) {
        e.preventDefault(); pendingG = 0; router.push(goMap.get(k)!); return;
      }
      pendingG = 0;
      if (e.shiftKey) return;
      switch (k) {
        case "g": pendingG = Date.now(); return;
        case "/": e.preventDefault(); h.onPalette(); return;
        case "q": e.preventDefault(); h.onQuickAdd(); return;
        case "t": e.preventDefault(); h.onTask(); return;
        case "n": e.preventDefault(); if (!requestNextStep()) h.onNextStepUnhandled(); return;
        default: return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, navKey]);
}
