"use client";
// Keyboard navigation (Design v2 §11) — purely client-side, no fetches:
//   G then A / D / T / C / N  → Accounts, Deals, Tasks, Chat, Notifications
//   /                         → focus the top-bar "Jump to…" search
//   ?                         → open the keyboard-shortcuts sheet
// All are suppressed while an input, textarea, select or contenteditable has
// focus, and when a modifier key is held (so ⌘K / ⌘⇧L are untouched). Routes
// are existing pages; each page enforces its own access as it always has.
//
// G-chords are OFF on /call-recaps: that page owns single-letter keys
// (A approves, S skips …), and "G then A" must never be able to approve a
// recap by accident.
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

const GO: Record<string, string> = {
  a: "/accounts",
  d: "/deals",
  t: "/tasks",
  c: "/chat",
  n: "/notifications",
};

function typing(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

export function useGoShortcuts(onHelp: () => void) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const helpRef = React.useRef(onHelp);
  helpRef.current = onHelp;
  const pathRef = React.useRef(pathname);
  pathRef.current = pathname;

  React.useEffect(() => {
    let pendingG = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (typing(e.target) || typing(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (e.key === "?") { e.preventDefault(); helpRef.current(); return; }
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>('input[data-global-search="true"]');
        if (input && input.offsetParent !== null) { e.preventDefault(); input.focus(); }
        return;
      }
      if (pathRef.current.startsWith("/call-recaps")) { pendingG = 0; return; }
      if (k === "g" && !e.shiftKey) { pendingG = Date.now(); return; }
      if (pendingG && Date.now() - pendingG < 1200 && GO[k]) {
        e.preventDefault();
        pendingG = 0;
        router.push(GO[k]);
        return;
      }
      pendingG = 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
}
