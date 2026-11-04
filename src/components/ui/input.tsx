import * as React from "react";
import { cn } from "@/components/ui/cn";

// Design v2 §9.2 — fields sit on --field with a strong hairline and a soft
// brand halo on focus. 44px tall below md (touch), density-driven above.
export const INPUT_CLASS =
  "flex h-[var(--control-h)] w-full rounded-control border border-input bg-field px-3 text-body text-foreground transition-[border-color,box-shadow] duration-instant ease-standard placeholder:text-tertiary hover:border-border-strong focus-visible:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-footnote file:font-medium max-md:h-11";

const TEXTAREA_CLASS =
  "flex min-h-[80px] w-full resize-y rounded-control border border-input bg-field px-3 py-2 text-body leading-[var(--lh-body)] text-foreground transition-[border-color,box-shadow] duration-instant ease-standard placeholder:text-tertiary hover:border-border-strong focus-visible:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50";

/** Classes for a native <select> — a zero-behaviour-change restyle. */
export const nativeSelectClass =
  "h-[var(--control-h)] appearance-none rounded-control border border-input bg-field pl-3 pr-8 text-body text-foreground select-chevron focus-visible:outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/20 max-md:h-11";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn(INPUT_CLASS, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(TEXTAREA_CLASS, className)} {...props} />
  )
);
Textarea.displayName = "Textarea";
