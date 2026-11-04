"use client";
// Page and tab motion (UI polish, 10/12/26 — owner's request, Framer Motion).
//
// 1. Route change: the page's top-level blocks (hero, stat row, panels,
//    tables…) rise and fade in one after another.
// 2. Tab / view change: whatever new content mounts afterwards — a record tab
//    (?tab=…), a Tabs panel, a segmented view, a report that opens — rises in
//    the same way, its own blocks staggered. Cards in a row of cards (stat
//    rows, card grids) slide in from the left, one after another. Detected with a MutationObserver,
//    so no page or tab has to opt in. Small inserts (table rows, list items,
//    anything under 64px tall) and drag-and-drop items are left alone, as is
//    anything under [data-motion-off].
//
// Inline styles are cleared once the animation settles so no transform is
// left on an ancestor (that would re-anchor fixed / sticky descendants).
// Reduced motion: nothing moves.

import * as React from "react";
import { usePathname } from "next/navigation";
import { animate, useReducedMotion } from "framer-motion";

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;
const MAX_STAGGERED = 16;
const MIN_HEIGHT = 64;
const EASE = [0.22, 1, 0.36, 1] as const;

const visible = (c: Element): c is HTMLElement => c instanceof HTMLElement && c.offsetParent !== null;

/** Top-level blocks; a grid of cards (stat rows, card grids) contributes its cards one by one. */
function blocksOf(root: HTMLElement): HTMLElement[] {
  let el: HTMLElement = root;
  for (let depth = 0; depth < 4 && el.children.length === 1; depth++) el = el.children[0] as HTMLElement;
  return Array.from(el.children).filter(visible).flatMap((b) => {
    const cards = Array.from(b.children).filter(visible);
    return getComputedStyle(b).display === "grid" && cards.length > 1 && cards.length <= 8 ? cards : [b];
  });
}

/** A card in a row of cards (a grid with several children): it slides in from the left instead of rising. */
const inCardRow = (b: HTMLElement) => {
  const p = b.parentElement;
  return !!p && p.children.length > 1 && getComputedStyle(p).display === "grid";
};

/** Fade a set of elements in, staggered — row cards slide left → right, everything else rises;
 *  returns a cancel that restores their styles. */
function rise(blocks: HTMLElement[], distance: number, gap: number, base = 0): () => void {
  if (!blocks.length) return () => {};
  const from = blocks.map((b) => (inCardRow(b) ? `translateX(${-distance * 1.6}px)` : `translateY(${distance}px)`));
  blocks.forEach((b, i) => { b.style.opacity = "0"; b.style.transform = from[i]; });
  const runs = blocks.map((b, i) =>
    animate(
      b,
      { opacity: [0, 1], transform: [from[i], from[i].startsWith("translateX") ? "translateX(0px)" : "translateY(0px)"] },
      { duration: 0.45, ease: EASE, delay: base + i * gap },
    ),
  );
  const clear = () => { for (const b of blocks) { b.style.removeProperty("opacity"); b.style.removeProperty("transform"); } };
  // The animation commits its end values after it resolves, so clear on the
  // next frames (and once more as a backstop) rather than inside then().
  let done = false;
  Promise.all(runs).then(() => { if (!done) requestAnimationFrame(() => requestAnimationFrame(clear)); });
  const backstop = window.setTimeout(clear, (base + blocks.length * gap) * 1000 + 450 + 400);
  return () => { done = true; runs.forEach((r) => r.stop()); window.clearTimeout(backstop); clear(); };
}

/** Cards of the card rows (stat rows, card grids) in view inside `scope`, minus ones already animated. */
function rowCards(scope: HTMLElement, taken: HTMLElement[]): HTMLElement[] {
  const limit = window.innerHeight * 1.1;
  return Array.from(scope.querySelectorAll<HTMLElement>(".grid"))
    .filter((g) => g.children.length >= 3 && Array.from(g.children).every((c) => c.classList.contains("rounded-card")) && g.getBoundingClientRect().top < limit)
    .flatMap((g) => Array.from(g.children).filter(visible))
    .filter((c) => !taken.some((t) => t === c || c.contains(t)))
    .slice(0, 12);
}

const SKIP = "[data-motion-off], [aria-roledescription], [draggable='true'], [role='row'], tr, li";

export function PageMotion({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const quietUntil = React.useRef(0);

  // 1 · route change
  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduce) return;
    quietUntil.current = performance.now() + 700; // the page's own first renders aren't "new content"
    const blocks = blocksOf(root).slice(0, MAX_STAGGERED);
    const stopBlocks = rise(blocks, 14, 0.05);
    // Rows of cards nested inside a block slide in left → right, card by card.
    const stopCards = rise(rowCards(root, blocks), 14, 0.07, 0.12);
    return () => { stopBlocks(); stopCards(); };
  }, [pathname, reduce]);

  // 2 · new content inside the page (tabs, views, panels that open)
  React.useEffect(() => {
    const root = ref.current;
    if (!root || reduce || typeof MutationObserver === "undefined") return;
    const cancels = new Set<() => void>();
    const mo = new MutationObserver((records) => {
      if (performance.now() < quietUntil.current) return;
      const added: HTMLElement[] = [];
      for (const r of records) for (const n of Array.from(r.addedNodes)) if (n instanceof HTMLElement) added.push(n);
      if (!added.length) return;
      const top = added.filter((n) => n.isConnected && !added.some((o) => o !== n && o.contains(n)));
      const fresh = top.filter((n) => visible(n) && n.offsetHeight >= MIN_HEIGHT && !n.matches(SKIP) && !n.parentElement?.closest(SKIP));
      if (!fresh.length) return;
      // One big new region (a tab's content): stagger its own blocks.
      const inner = fresh.length === 1 ? blocksOf(fresh[0]) : [];
      const blocks = (inner.length > 1 ? inner : fresh).slice(0, 12);
      const stopBlocks = rise(blocks, 10, 0.04);
      const stopCards = rise(fresh.flatMap((f) => rowCards(f, blocks)), 12, 0.06, 0.08);
      const cancel = () => { stopBlocks(); stopCards(); };
      cancels.add(cancel);
      window.setTimeout(() => cancels.delete(cancel), 2000);
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); cancels.forEach((c) => c()); };
  }, [reduce]);

  return <div ref={ref} className={className}>{children}</div>;
}
