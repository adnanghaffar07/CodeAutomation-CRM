import * as React from "react";
import { cn } from "@/components/ui/cn";

// Design v2 §9.11 — one raised surface, hairline row rules, an OPAQUE tinted
// sticky header band (bg-table-head), density-driven row height (44 / 36px),
// tabular numerals.
export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement> & { wrapperClassName?: string }>(
  ({ className, wrapperClassName, ...props }, ref) => (
    <div className={cn("relative w-full overflow-auto rounded-card bg-card shadow-e1", wrapperClassName)}>
      <table ref={ref} className={cn("w-full border-separate border-spacing-0 text-body", className)} {...props} />
    </div>
  )
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />
);
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />
);
TableBody.displayName = "TableBody";

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tfoot ref={ref} className={cn("bg-muted/50 font-medium", className)} {...props} />
);
TableFooter.displayName = "TableFooter";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn("group transition-colors duration-instant hover:bg-foreground/[0.03] data-[state=selected]:bg-brand-tint", className)}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "sticky top-0 z-10 h-9 whitespace-nowrap border-b border-border bg-table-head px-3 text-left align-middle text-caption font-medium text-muted-foreground first:pl-4 last:pr-4",
        className,
      )}
      {...props}
    />
  )
);
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "h-[var(--row-h)] border-b border-border/70 px-3 align-middle text-foreground first:pl-4 last:pr-4 group-last:border-b-0",
        className,
      )}
      {...props}
    />
  )
);
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => <caption ref={ref} className={cn("mt-3 text-footnote text-muted-foreground", className)} {...props} />
);
TableCaption.displayName = "TableCaption";

/** Right-aligned tabular numeral cell classes. */
export const NUMERIC = "text-right tabular-nums";

/** The empty-cell glyph. */
export function EmptyCell() {
  return <span className="text-tertiary">—</span>;
}

/** Pagination footer row. */
export function TablePagination({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex h-12 items-center justify-between px-4 text-footnote text-muted-foreground", className)} {...props} />;
}
