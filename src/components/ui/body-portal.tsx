"use client";
// Renders children into document.body. Used for self-built modals that can
// be opened from inside a menu or popover: a transformed / backdrop-filtered
// ancestor (Radix popper wrapper, material-popover) would otherwise become
// the containing block of their `position: fixed` and clip them to the menu.
// React events still bubble through the portal to the owning component.
import * as React from "react";
import { createPortal } from "react-dom";

export function BodyPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
