"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/components/ui/cn";

// Design v2 §9.6 — page-level views. Sentence case, an underline that glides
// to the active tab; the panel's entrance comes from shell/page-motion.tsx. For choices about ONE view (ranges, Kanban/Table)
// use ui/segmented-control instead.
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
  // One underline that glides to the active tab (UI polish 10/12/26): it
  // follows the trigger whose data-state flips to "active".
  const inner = React.useRef<HTMLDivElement | null>(null);
  const [bar, setBar] = React.useState<{ left: number; width: number } | null>(null);
  React.useEffect(() => {
    const list = inner.current;
    if (!list) return;
    const place = () => {
      const t = list.querySelector<HTMLElement>('[role="tab"][data-state="active"]');
      setBar(t ? { left: t.offsetLeft + 8, width: Math.max(0, t.offsetWidth - 16) } : null);
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(list, { attributes: true, subtree: true, attributeFilter: ["data-state"] });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    ro?.observe(list);
    return () => { mo.disconnect(); ro?.disconnect(); };
  }, []);
  return (
    <TabsPrimitive.List
      ref={(el) => {
        inner.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      className={cn("no-scrollbar relative flex h-10 items-center gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_hsl(var(--border))]", className)}
      {...props}
    >
      {children}
      {bar && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-[2px] rounded-pill bg-brand transition-[transform,width] duration-moderate ease-spring"
          style={{ width: bar.width, transform: `translateX(${bar.left}px)` }}
        />
      )}
    </TabsPrimitive.List>
  );
});
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex h-10 shrink-0 items-center whitespace-nowrap px-3 text-body font-medium text-muted-foreground transition-colors duration-instant",
      "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      "disabled:pointer-events-none disabled:opacity-40",
      "data-[state=active]:text-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("focus-visible:outline-none", className)} // entrance motion: shell/page-motion.tsx
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
