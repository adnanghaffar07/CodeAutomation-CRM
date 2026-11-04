"use client";
// Quick-add: Contact · Account · Assignment · Note.

import * as React from "react";
import { Building2, ClipboardCheck, MessageSquarePlus, Plus, UserPlus } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuShortcut, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/cn";

export type QuickAddAction = "contact" | "account" | "task" | "note";

export function QuickAddMenu({
  open, onOpenChange, onAction, canAddAccount, className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAction: (a: QuickAddAction) => void;
  canAddAccount: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange} modal={false}>
      <SimpleTooltip label="Quick add" shortcut="Q">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Quick add"
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand text-white shadow-e1 tap-clean transition-[background-color,transform] duration-instant hover:bg-brand-hover active:scale-95 data-[state=open]:bg-brand-pressed",
              className,
            )}
          >
            <Plus className="size-[18px] transition-transform duration-moderate ease-spring" />
          </button>
        </DropdownMenuTrigger>
      </SimpleTooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-caption font-medium text-muted-foreground">Quick add</DropdownMenuLabel>
        {canAddAccount && (
          <>
            <DropdownMenuItem onSelect={() => onAction("contact")}><UserPlus /> Contact</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction("account")}><Building2 /> Account</DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem onSelect={() => onAction("task")}><ClipboardCheck /> Assignment <DropdownMenuShortcut>T</DropdownMenuShortcut></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("note")}><MessageSquarePlus /> Note</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
