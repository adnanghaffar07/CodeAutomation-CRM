"use client";
// Design v2 §9.3 — Radix Select styled as a field (or a pill for filters),
// with a material popover list and the menu-item spec for rows.
import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { INPUT_CLASS } from "@/components/ui/input";

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { variant?: "field" | "pill" }
>(({ className, children, variant = "field", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      INPUT_CLASS,
      "items-center justify-between gap-2 text-left [&>span]:truncate data-[placeholder]:text-tertiary",
      variant === "pill" &&
        "h-8 w-auto rounded-pill border-0 bg-muted px-3 text-footnote font-medium hover:bg-accent max-md:h-10",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronsUpDown className="size-4 shrink-0 text-tertiary" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", sideOffset = 6, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={sideOffset}
      className={cn(
        "z-[100] min-w-[var(--radix-select-trigger-width)] max-h-[min(var(--radix-select-content-available-height),360px)] overflow-hidden rounded-overlay p-1.5 material-popover text-popover-foreground shadow-e3",
        "origin-[var(--radix-select-content-transform-origin)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-base",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-fast",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("px-2.5 pb-1 pt-2 text-caption font-medium text-muted-foreground", className)} {...props} />
));
SelectLabel.displayName = "SelectLabel";

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-8 cursor-default select-none items-center gap-2 rounded-overlay-inner py-1 pl-2.5 pr-8 text-body outline-none transition-colors duration-instant",
      "data-[highlighted]:bg-brand data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-40 max-md:min-h-11",
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2.5 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />
));
SelectSeparator.displayName = "SelectSeparator";
