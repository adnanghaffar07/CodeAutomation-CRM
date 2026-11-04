"use client";
// Tells you the app is working when you switch a tab, filter, page or refresh the data. Next's router fetches the next screen
// with an "RSC: 1" request; this watches those requests (it never changes them) and shows
//   after 0.12 s: a thin progress bar across the top, and
//   after 0.5 s:  a small floating "Loading…" badge with the animated logo.
// Moving to another page (menu click) is covered by app/(app)/loading.tsx; this covers everything on the same page.

import * as React from "react";

/** Is this request the router loading a screen (not a background prefetch, not an API call)? */
export function isRouterNavigation(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers: HeadersInit | undefined = init?.headers ?? (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
  if (!headers) return false;
  const get = (name: string): string | null => {
    if (typeof Headers !== "undefined" && headers instanceof Headers) return headers.get(name);
    if (Array.isArray(headers)) return headers.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
    const hit = Object.entries(headers as Record<string, string>).find(([k]) => k.toLowerCase() === name);
    return hit ? String(hit[1]) : null;
  };
  return get("rsc") === "1" && (!get("next-router-prefetch") || recentIntent());
}

// Next sends a tab/filter click as an RSC request that still carries the prefetch header, so a prefetch counts only when the
// user just clicked or pressed a key (scrolling links into view also prefetches, and must not show the loader).
let lastIntent = -Infinity;
const INTENT_WINDOW_MS = 1500;
function recentIntent(): boolean {
  return typeof performance !== "undefined" && performance.now() - lastIntent < INTENT_WINDOW_MS;
}
function markIntent() {
  lastIntent = performance.now();
}

// One shared counter of screens being loaded, fed by a single observer on window.fetch.
let pending = 0;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  for (const type of ["click", "keydown", "popstate"]) window.addEventListener(type, markIntent, true);
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isRouterNavigation(input, init)) return original(input, init);
    pending++;
    emit();
    const done = () => {
      pending = Math.max(0, pending - 1);
      emit();
    };
    return original(input, init).then(
      (res) => {
        // The screen is "loaded" when its data has finished arriving, not when the first bytes do.
        res.clone().arrayBuffer().then(done, done);
        return res;
      },
      (err) => {
        done();
        throw err;
      },
    );
  };
}

function usePending(): number {
  return React.useSyncExternalStore(
    (cb) => {
      install();
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => pending,
    () => 0,
  );
}

export function NavigationLoader() {
  const count = usePending();
  const [phase, setPhase] = React.useState<0 | 1 | 2>(0);
  React.useEffect(() => {
    if (count === 0) {
      setPhase(0);
      return;
    }
    const bar = setTimeout(() => setPhase((p) => (p < 1 ? 1 : p)), 120);
    const badge = setTimeout(() => setPhase(2), 500);
    return () => {
      clearTimeout(bar);
      clearTimeout(badge);
    };
  }, [count]);

  if (phase === 0) return null;
  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden bg-brand/15">
        <div className="ca-progress h-full w-2/5 rounded-full bg-brand-bright" />
      </div>
      {phase === 2 && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[80] -translate-x-1/2" data-motion-off>
          <div className="flex items-center gap-2.5 rounded-pill bg-card px-3.5 py-2 text-footnote font-medium text-foreground shadow-e2 ring-1 ring-border">
            <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
            Loading…
          </div>
        </div>
      )}
    </>
  );
}
