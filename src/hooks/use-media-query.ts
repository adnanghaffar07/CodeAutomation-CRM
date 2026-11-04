"use client";

// Media queries as state, for the cases where CSS alone will not do.
//
// `hidden lg:flex` hides a component but still MOUNTS it — its effects run,
// its timers tick, its fetches fire. For chrome that polls (the mobile tab
// bar's badge counts) that is a real cost paid on every desktop session, so
// those components ask this hook and render nothing at all.
//
// Returns false on the server and on the very first client render, then
// corrects itself — so mobile-only chrome fades in rather than causing a
// hydration mismatch.

import * as React from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** Below Tailwind's `lg` — the breakpoint this app treats as "a phone or a small tablet". */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
