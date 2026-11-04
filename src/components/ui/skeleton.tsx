import { cn } from "@/components/ui/cn";

/**
 * Skeleton — shared loading placeholder. A calm opacity pulse (no shimmer),
 * and it only fades in after 300ms so fast loads never flash a skeleton.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-control bg-muted animate-[fade-in_150ms_300ms_both,pulse-soft_1.6s_var(--ease-standard)_450ms_infinite]",
        className,
      )}
      {...props}
    />
  );
}

/** A KPI-tile sized skeleton — drop-in placeholder for a grid of Stat tiles. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-card bg-card p-4 shadow-e1", className)}>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

/** A chart-area skeleton sized to a recharts container height. */
export function SkeletonChart({ height = 260, className }: { height?: number; className?: string }) {
  return <Skeleton className={cn("w-full rounded-card", className)} style={{ height }} />;
}
