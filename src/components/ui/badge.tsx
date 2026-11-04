import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/ui/cn";

// Design v2 §9.5 — capsule chips, sentence case. Semantic tones are tints
// (bg-*-tint text-*) so status reads as meaning, never as a loud block.
// People are never chips: use a 20px UserAvatar + the name as text.
const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-pill px-2 text-caption font-medium transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-brand-tint text-brand-text",
        secondary: "bg-muted text-muted-foreground",
        outline: "ring-1 ring-inset ring-border-strong text-muted-foreground",
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-warning",
        destructive: "bg-destructive-tint text-destructive",
        // Lifecycle heat: hot / warm / cold.
        hot: "bg-destructive-tint text-destructive font-semibold",
        warm: "bg-warning-tint text-warning",
        cold: "bg-brand-tint text-brand-text",
        // Counts.
        solid: "bg-brand text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { badgeVariants };
