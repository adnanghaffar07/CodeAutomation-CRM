"use client";
// Design v2 §9.6 — SegmentedControl, for choices about ONE view (ranges,
// Kanban/Table, theme, density). A radiogroup with arrow-key navigation and
// a thumb that springs between segments (framer layoutId + spring.snappy).
//
// Rules: at most 5 visible segments — the rest go in a trailing "More" menu
// that calls the same onValueChange. Below 640px a control with more than 3
// options renders as a pill Select instead (both are rendered; CSS picks one,
// so nothing mounts or unmounts on resize).
import * as React from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { spring } from "@/components/ui/motion";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Plain-text label for the mobile Select / More menu when `label` is a node. */
  text?: string;
};

export function SegmentedControl<T extends string>({
  value, onValueChange, options, size = "sm", className, id, maxVisible = 5, collapseOnMobile = true,
  "aria-label": ariaLabel, fullWidth = false,
}: {
  value: T | null;
  onValueChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  id?: string;
  maxVisible?: number;
  /** Render as a pill Select below 640px when there are more than 3 options. */
  collapseOnMobile?: boolean;
  "aria-label"?: string;
  /** Stretch to the container width (segments share it equally). */
  fullWidth?: boolean;
}) {
  const autoId = React.useId();
  const layoutId = `seg-${id ?? autoId}`;
  const visible = options.slice(0, maxVisible);
  const overflow = options.slice(maxVisible);
  const overflowActive = overflow.find((o) => o.value === value);
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = visible.length;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = n - 1;
    if (next >= 0) {
      e.preventDefault();
      onValueChange(visible[next].value);
      refs.current[next]?.focus();
    }
  };

  const textOf = (o: SegmentedOption<T>) => o.text ?? (typeof o.label === "string" ? o.label : String(o.value));
  const collapse = collapseOnMobile && options.length > 3;

  return (
    <>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        data-size={size}
        className={cn(
          "relative inline-grid grid-flow-col auto-cols-fr items-center rounded-control bg-muted p-0.5",
          size === "md" ? "h-9" : "h-8",
          fullWidth && "grid w-full",
          collapse && "max-sm:hidden",
          className,
        )}
      >
        {visible.map((o, i) => {
          const on = o.value === value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (value === null && i === 0) ? 0 : -1}
              onClick={() => onValueChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                "relative z-10 inline-flex h-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control-inner px-3 text-footnote font-medium text-muted-foreground tap-clean transition-colors duration-instant",
                "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "aria-checked:font-semibold aria-checked:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
              )}
            >
              {on && (
                <motion.span
                  layoutId={layoutId}
                  transition={spring.snappy}
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-control-inner bg-card shadow-e1 dark:bg-fill-strong"
                />
              )}
              {Icon && <Icon />}
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
        {overflow.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative z-10 inline-flex h-full items-center justify-center gap-1 whitespace-nowrap rounded-control-inner px-3 text-footnote font-medium text-muted-foreground transition-colors duration-instant hover:text-foreground",
                  overflowActive && "bg-card text-foreground shadow-e1 dark:bg-fill-strong font-semibold",
                )}
              >
                {overflowActive ? textOf(overflowActive) : "More"}
                <ChevronDown className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              {overflow.map((o) => (
                <DropdownMenuItem key={o.value} onSelect={() => onValueChange(o.value)}>
                  {textOf(o)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {collapse && (
        <Select value={value ?? undefined} onValueChange={(v) => onValueChange(v as T)}>
          <SelectTrigger variant="pill" aria-label={ariaLabel} className={cn("sm:hidden", className)}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{textOf(o)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );
}
