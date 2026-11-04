"use client";
// Design v2 §9.8 — right-side sheet (Radix Dialog). Floats 8px off the
// edges on desktop; full width on a phone.
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/components/ui/cn";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideClose?: boolean }
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 z-[90] bg-[hsl(var(--scrim))] backdrop-blur-[2px] duration-base data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-2 right-2 z-[91] flex w-[min(480px,calc(100vw-16px))] flex-col overflow-hidden rounded-sheet bg-popover text-popover-foreground shadow-e4 outline-none",
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8 data-[state=open]:fade-in-0 data-[state=open]:duration-slow data-[state=open]:ease-sheet",
        "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-8 data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast",
        className,
      )}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-pill text-muted-foreground transition-colors duration-instant hover:bg-foreground/6 hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-1 border-b border-border px-5 pb-3 pt-4 pr-12", className)} {...props} />;
}

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-title3 font-semibold text-foreground", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-footnote text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";
