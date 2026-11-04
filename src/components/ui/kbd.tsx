import * as React from "react";
import { cn } from "@/components/ui/cn";

/** A keyboard key hint (Design v2 §9.14). */
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border-strong bg-card px-1 font-sans text-caption2 text-muted-foreground shadow-[0_1px_0_hsl(var(--border-strong))]",
        className,
      )}
      {...props}
    />
  );
}
