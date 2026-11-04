"use client";

// Bottom sheet — the mobile equivalent of a dropdown.
//
// Built on vaul (already a dependency, previously unused), which is a Radix
// Dialog underneath: focus trapping, scroll locking and Escape all come for
// free, and on top of that it adds the two things a phone needs and a
// dropdown cannot do — drag to dismiss, and a handle that says "pull me".
//
// Every sheet pads its bottom by the home-indicator inset, so the last row is
// never sitting under the iPhone's gesture bar.

import * as React from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "@/components/ui/cn";

const Drawer = ({ shouldScaleBackground = true, ...props }: React.ComponentProps<typeof Vaul.Root>) => (
  <Vaul.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = "Drawer";

const DrawerTrigger = Vaul.Trigger;
const DrawerClose = Vaul.Close;
const DrawerPortal = Vaul.Portal;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof Vaul.Overlay>,
  React.ComponentPropsWithoutRef<typeof Vaul.Overlay>
>(({ className, ...props }, ref) => (
  <Vaul.Overlay ref={ref} className={cn("fixed inset-0 z-[90] bg-[hsl(var(--scrim))] backdrop-blur-[2px]", className)} {...props} />
));
DrawerOverlay.displayName = "DrawerOverlay";

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof Vaul.Content>,
  React.ComponentPropsWithoutRef<typeof Vaul.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <Vaul.Content
      ref={ref}
      className={cn(
        // A rounded sheet on the overlay surface (Design v2 §9.8). z-[95]
        // is kept: it sits above the z-[90] scrim and the z-[60] tab bar.
        "fixed inset-x-0 bottom-0 z-[95] mt-24 flex max-h-[92dvh] flex-col rounded-t-sheet bg-popover text-popover-foreground shadow-e4 outline-none",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    >
      {/* The grab handle. Not decoration — it is the affordance that tells
          someone the sheet can be flicked away instead of hunted for an X. */}
      <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-9 shrink-0 rounded-pill bg-foreground/20" />
      {children}
    </Vaul.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1 px-5 pb-3 pt-4 text-left", className)} {...props} />;
}

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof Vaul.Title>,
  React.ComponentPropsWithoutRef<typeof Vaul.Title>
>(({ className, ...props }, ref) => (
  <Vaul.Title ref={ref} className={cn("text-title3 font-semibold text-foreground", className)} {...props} />
));
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof Vaul.Description>,
  React.ComponentPropsWithoutRef<typeof Vaul.Description>
>(({ className, ...props }, ref) => (
  <Vaul.Description ref={ref} className={cn("text-footnote text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = "DrawerDescription";

export {
  Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose,
  DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
};
