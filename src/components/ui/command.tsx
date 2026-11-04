"use client";
import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/components/ui/cn";

export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn("flex h-full w-full flex-col overflow-hidden bg-transparent text-popover-foreground", className)}
    {...props}
  />
));
Command.displayName = "Command";

export function CommandDialog({
  open, onOpenChange, children, shouldFilter = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
  /** Pass false if results are already filtered server-side (disables cmdk's fuzzy filter). */
  shouldFilter?: boolean;
}) {
  return (
    // modal={false} prevents Radix from setting `pointer-events: none` on
    // <body>, which could get stranded when a route change unmounts the
    // dialog mid-close animation. Only the focus-trap and body-lock are
    // disabled. Radix renders NO Overlay in non-modal mode, so the scrim is
    // a plain element: it dims the page (tab bar and top bar included) and
    // takes the outside tap.
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        {open && (
          <div
            aria-hidden
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-[90] bg-[hsl(var(--scrim))] backdrop-blur-[2px] animate-in fade-in-0 duration-base"
          />
        )}
        <DialogPrimitive.Content
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="fixed left-[50%] top-[12vh] z-[91] grid w-[640px] max-w-[calc(100vw-32px)] translate-x-[-50%] overflow-hidden rounded-overlay material-popover p-0 text-popover-foreground shadow-e4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-base data-[state=open]:ease-enter"
        >
          <DialogPrimitive.Title className="sr-only">Command Palette</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search accounts and deals, or jump to a page.
          </DialogPrimitive.Description>
          <Command
            shouldFilter={shouldFilter}
            className="[&_[cmdk-input-wrapper]_svg]:size-4"
          >
            {children}
            {/* Footer hints — purely visual. */}
            <div aria-hidden className="hidden h-9 items-center gap-3 border-t border-border px-3 text-caption text-muted-foreground sm:flex">
              <span>↑↓ to navigate</span><span>·</span><span>↵ to open</span><span>·</span><span>esc to close</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b border-border px-4" cmdk-input-wrapper="">
    <Search className="size-4 shrink-0 text-tertiary" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn("flex h-12 w-full bg-transparent text-callout outline-none placeholder:text-tertiary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn("max-h-[min(420px,60dvh)] overflow-y-auto overflow-x-hidden overscroll-contain py-1.5", className)} {...props} />
));
CommandList.displayName = "CommandList";

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => <CommandPrimitive.Empty ref={ref} className="py-8 text-center text-body text-muted-foreground" {...props} />);
CommandEmpty.displayName = "CommandEmpty";

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn("overflow-hidden text-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground", className)}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn("relative mx-1.5 flex min-h-9 max-md:min-h-11 cursor-default select-none items-center gap-3 rounded-overlay-inner px-2.5 py-1.5 text-body outline-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[selected=true]:bg-brand data-[selected=true]:text-white data-[selected=true]:[&_svg]:text-white data-[selected=true]:[&_.text-muted-foreground]:text-white/80 data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40", className)}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

/** Right-aligned hint inside a CommandItem (turns white on the selected row). */
export function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto text-caption tabular-nums text-muted-foreground", className)} {...props} />;
}
