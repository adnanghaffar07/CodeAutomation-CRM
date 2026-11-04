import { cn } from "@/components/ui/cn";

/**
 * SectionHeader — the one canonical section/zone header used to group dense
 * dashboards into labeled zones. Title leads, an optional context line
 * supports it, optional inline controls sit on the right. Sentence case, no
 * rule underneath (hierarchy comes from type and space, not lines).
 *
 * `eyebrow` is the ONE allowed uppercase label per section (Design v2 §5.3b).
 */
export function SectionHeader({
  title,
  context,
  right,
  eyebrow,
  className,
}: {
  title: string;
  context?: string;
  right?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-3 pb-3", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-0.5 text-caption2 font-semibold uppercase tracking-[0.06em] text-muted-foreground">{eyebrow}</p>
        )}
        <h2 className="text-title3 font-semibold text-foreground">{title}</h2>
        {context && <p className="mt-0.5 truncate text-footnote text-muted-foreground">{context}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}
