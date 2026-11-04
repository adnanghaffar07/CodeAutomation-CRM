// CodeAutomation logo (public/codeautomation-logo.svg, supplied artwork).
// The artwork is a blue mark followed by a black banner carrying the name, so it
// reads on light and dark canvases alike. The mark is the first ~58 of the file's
// 266 units, so clipping the image to that width gives the icon-only version.
// Server-safe.

import * as React from "react";
import { cn } from "@/components/ui/cn";

const SRC = "/codeautomation-logo.svg";
const RATIO = 266.093 / 54.285;

/** Full logo. Height from `className` (default h-8); width follows. */
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing to optimise
    <img src={SRC} alt="CodeAutomation" draggable={false} className={cn("h-8 w-auto max-w-none shrink-0 select-none", className)} />
  );
}

/** Mark only: the logo clipped to its icon. `size` is the height in px. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block shrink-0 overflow-hidden", className)} style={{ height: size, width: Math.round(size * (58 / 54.285)) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
      <img src={SRC} alt="" draggable={false} className="max-w-none select-none" style={{ height: size, width: Math.round(size * RATIO) }} />
    </span>
  );
}

/** Logo that collapses to the mark below `md` (top bar on phones). */
export function ResponsiveLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Logo className="h-7 max-md:hidden" />
      <LogoMark size={28} className="md:hidden" />
    </span>
  );
}
