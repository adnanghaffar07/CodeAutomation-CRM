import { cn } from "@/components/ui/cn";

/**
 * EmptyState — the single canonical "nothing to show" treatment so no chart,
 * list, or panel ever renders as a bare dashed grid or a blank box.
 *
 * Deliberately distinguishes "no activity in this range" (a designed, calm
 * state) from a real zero value (which still renders as a normal `0` in its
 * tile). Pass an `icon` ReactNode from the caller — icons are only imported in
 * client components so this stays safe in any context.
 *
 * Design v2 §9.14: no border, no dashed box — a brand-tinted icon disc with a
 * soft halo ring, a title and a hint, with at most one helpful action.
 */
export function EmptyState({
  title = "No activity in this range",
  hint,
  icon,
  action,
  height,
  size = "md",
  className,
}: {
  title?: string;
  hint?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** When rendered in place of a fixed-height chart, match that height. */
  height?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center px-6 text-center",
        size === "sm" ? "gap-1.5 py-6" : "gap-2 py-10",
        className,
      )}
      style={height ? { height } : undefined}
      role="status"
    >
      {icon && (
        <div className="mb-1 grid size-12 place-items-center rounded-pill bg-brand-tint text-brand-text ring-[6px] ring-brand-tint/40 [&_svg]:size-6 [&_svg]:stroke-[1.5]">
          {icon}
        </div>
      )}
      <p className="text-headline font-semibold text-foreground">{title}</p>
      {hint && <p className="max-w-[40ch] text-footnote text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
