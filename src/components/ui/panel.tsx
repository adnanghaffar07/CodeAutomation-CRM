import * as React from "react";
import { cn } from "@/components/ui/cn";
import { ICON_CHIP, chipFor, type ChipAccent } from "@/components/ui/stat";

/**
 * Panel — a card with its header inside (UI polish, 10/12/26, after the
 * Tarento CRM reference): title + optional context and icon chip on the left,
 * an optional action ("View all") on the right, a hairline, then the body.
 * Use it for dashboard widgets and other self-contained content blocks; plain
 * zones keep SectionHeader above their content.
 *
 * `flush` drops the body padding for edge-to-edge lists (divide-y rows) and
 * tables; the panel clips them to its rounded corners.
 */
export function Panel({
  title,
  context,
  action,
  icon,
  accent,
  flush,
  className,
  bodyClassName,
  children,
  ...rest
}: {
  title: React.ReactNode;
  context?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: ChipAccent;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={cn("overflow-hidden rounded-card bg-card text-card-foreground shadow-e1", className)} {...rest}>
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && (
            <span aria-hidden className={cn(ICON_CHIP, chipFor("neutral", accent))}>
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-headline font-semibold text-foreground">{title}</h2>
            {context && <p className="truncate text-caption text-muted-foreground">{context}</p>}
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2 text-footnote">{action}</div>}
      </header>
      <div className={cn(!flush && "p-4 md:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** The standard "View all" style link for a Panel action. */
export const PANEL_LINK = "font-medium text-brand-text transition-colors hover:text-brand-hover hover:underline";
