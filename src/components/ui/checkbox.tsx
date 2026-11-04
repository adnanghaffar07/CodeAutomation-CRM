// Design v2 §9.12 — a styled NATIVE checkbox: same onChange semantics as a
// plain <input type="checkbox">, so call sites migrate with zero behaviour
// change. The tick is the `.checkbox-tick` utility in globals.css.
import * as React from "react";
import { cn } from "@/components/ui/cn";

export const CHECKBOX_CLASS =
  "peer size-4 shrink-0 cursor-pointer appearance-none rounded-xs border border-border-strong bg-field align-middle transition-colors duration-instant checked:border-brand checked:bg-brand checkbox-tick indeterminate:border-brand indeterminate:bg-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40";

export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  ({ className, ...props }, ref) => (
    <input ref={ref} type="checkbox" className={cn(CHECKBOX_CLASS, className)} {...props} />
  )
);
Checkbox.displayName = "Checkbox";
