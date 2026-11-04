"use client";
// Design v2 §9.10 — inverted, compact tooltips (400ms delay via the
// TooltipProvider mounted in theme-provider.tsx). Shortcuts render as <Kbd>.
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/components/ui/cn";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[110] inline-flex max-w-[260px] items-center gap-1.5 rounded-sm bg-foreground px-2 py-1 text-caption font-medium text-background shadow-e2 duration-fast",
        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

/** Convenience: wrap a trigger element with a one-line tooltip. */
export function SimpleTooltip({
  label, children, side = "bottom", shortcut,
}: { label: React.ReactNode; children: React.ReactElement; side?: "top" | "bottom" | "left" | "right"; shortcut?: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <span className="text-background/60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
