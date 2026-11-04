"use client";
// App-wide replacement for window.confirm(). Provides a styled, theme-matched
// confirmation modal with proper keyboard handling (Esc cancels, Enter
// confirms) and an imperative Promise-based API so existing call sites can
// swap `confirm(msg)` → `await confirmDialog(msg)` with minimal churn.
//
// Usage at call sites:
//
//   import { confirmDialog } from "@/components/ui/confirm-dialog";
//   if (!(await confirmDialog("Delete this task?"))) return;
//
//   // or, with richer options:
//   const ok = await confirmDialog({
//     title: "Delete builder?",
//     message: "This also deletes their offer history.",
//     confirmLabel: "Delete",
//     variant: "destructive",
//   });
//
// Rendered into the tree via <ConfirmDialogRoot /> which lives in the app
// shell — a single instance serves every caller.

import * as React from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type Listener = (state: State | null) => void;

type State = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

// Module-level singleton: subscribers render the live dialog; callers push
// requests here and await the resolution.
let current: State | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(current);
}

/**
 * Imperative confirm. Accepts either a plain message string (parity with
 * window.confirm) or an options object for richer UX. Resolves to true when
 * the user confirms, false when they cancel / dismiss / close.
 */
export function confirmDialog(input: string | ConfirmOptions): Promise<boolean> {
  // Resolve any already-open dialog as "cancel" before replacing it — avoids
  // stacked dialogs if two call sites race.
  if (current) {
    current.resolve(false);
    current = null;
    emit();
  }
  const opts: ConfirmOptions = typeof input === "string" ? { message: input } : input;
  return new Promise<boolean>((resolve) => {
    current = { ...opts, resolve };
    emit();
  });
}

export function ConfirmDialogRoot() {
  const [state, setState] = React.useState<State | null>(current);

  React.useEffect(() => {
    const listener: Listener = (s) => setState(s);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  React.useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter")  finish(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  function finish(ok: boolean) {
    if (!current) return;
    const { resolve } = current;
    current = null;
    emit();
    resolve(ok);
  }

  if (!state) return null;
  const destructive = state.variant === "destructive";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-[hsl(var(--scrim))] backdrop-blur-[2px] animate-in fade-in-0 duration-base sm:items-center sm:p-4"
      onClick={() => finish(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative grid w-full gap-4 rounded-t-sheet bg-popover p-6 pb-[max(24px,env(safe-area-inset-bottom))] text-popover-foreground shadow-e4 animate-in fade-in-0 slide-in-from-bottom-8 duration-moderate ease-enter sm:max-w-[420px] sm:rounded-sheet sm:pb-6 sm:slide-in-from-bottom-0 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => finish(false)}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-pill text-muted-foreground transition-colors duration-instant hover:bg-foreground/6 hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 pr-8">
          {destructive && (
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-destructive-tint text-destructive">
              <AlertTriangle className="size-[18px]" />
            </span>
          )}
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-title3 font-semibold text-foreground">
              {state.title ?? (destructive ? "Confirm action" : "Are you sure?")}
            </h2>
            <div className="whitespace-pre-wrap text-body text-muted-foreground">
              {state.message}
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => finish(false)}>
            {state.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => finish(true)}
            autoFocus
          >
            {state.confirmLabel ?? (destructive ? "Delete" : "Confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
