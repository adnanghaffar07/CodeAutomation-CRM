// Design v2 §8.2 — the page header that replaces the blue hero bands.
// Transparent, typographic, one row of actions on the right (they wrap
// under the title on a phone).
import * as React from "react";
import { cn } from "@/components/ui/cn";

export function PageHeader({
  title, subtitle, eyebrow, breadcrumb, actions, icon, children, className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional 32px glyph beside the title (rounded-control bg-brand-tint). */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-3 gap-y-3 pb-4 pt-1 md:pb-6 md:pt-2", className)}>
      <div className="min-w-0 space-y-1">
        {breadcrumb && <nav aria-label="Breadcrumb" className="text-footnote text-muted-foreground">{breadcrumb}</nav>}
        {eyebrow && (
          <p className="text-caption2 font-semibold uppercase tracking-[0.06em] text-muted-foreground">{eyebrow}</p>
        )}
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="grid size-8 shrink-0 place-items-center rounded-control bg-brand-tint text-brand-text [&_svg]:size-[18px]">
              {icon}
            </span>
          )}
          <h1 className="min-w-0 text-balance text-title1 font-bold text-foreground md:text-large-title">{title}</h1>
        </div>
        {subtitle && <p className="text-body text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
