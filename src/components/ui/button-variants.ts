// Button variants without "use client", so server components can style a
// plain <a> as a button (e.g. the report CSV link). ui/button re-exports it.
import { cva } from "class-variance-authority";

// Design v2 §9.1. ONE `default` (prominent brand) button per view; everything
// else is outline, secondary, tinted, ghost or plain. Every button answers a
// press with a 0.97 scale in 100ms. Below md, sizes grow to a 44px target.
export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control text-body font-medium tap-clean transition-[background-color,color,box-shadow,transform,opacity] duration-instant ease-standard active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand text-white shadow-e1 hover:bg-brand-hover active:bg-brand-pressed",
        // legacy alias of default
        gradient: "bg-brand text-white shadow-e1 hover:bg-brand-hover active:bg-brand-pressed",
        destructive: "bg-destructive-solid text-white shadow-e1 hover:bg-destructive-solid/90",
        outline: "border border-border-strong bg-card text-foreground shadow-e1 hover:bg-accent active:bg-fill-strong dark:border-transparent dark:bg-secondary dark:hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent active:bg-fill-strong",
        tinted: "bg-brand-tint text-brand-text hover:bg-brand/15 dark:hover:bg-brand/25",
        ghost: "text-foreground hover:bg-foreground/6 active:bg-foreground/10",
        plain: "text-brand-text hover:bg-brand/8 active:bg-brand/12",
        "destructive-ghost": "text-destructive hover:bg-destructive-tint",
        link: "h-auto px-0 text-brand-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        xs: "h-7 rounded-sm px-2.5 text-footnote [&_svg]:size-3.5",
        sm: "h-8 px-3 text-footnote max-md:h-10",
        default: "h-[var(--control-h)] px-4 max-md:h-11",
        lg: "h-10 px-5 text-callout max-md:h-11",
        xl: "h-12 rounded-card px-6 text-callout font-semibold",
        icon: "size-9 rounded-pill max-md:size-11",
        "icon-sm": "size-8 rounded-pill",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);
