// Small shared pieces for the assignment pages. No state, so they work in server and client components.
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type AssignmentStatus, type Flags } from "@/lib/assignments";

const STATUS_VARIANT: Record<AssignmentStatus, "secondary" | "default" | "warning" | "success" | "destructive"> = {
  open: "secondary", in_progress: "default", on_hold: "secondary", verified: "warning", approved: "success", rejected: "destructive",
};

export function StatusBadge({ status }: { status: AssignmentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function FlagBadges({ flags }: { flags: Flags }) {
  if (!flags.overdue && !flags.dueSoon && !flags.missingEvidence) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.overdue && <Badge variant="destructive">Overdue</Badge>}
      {!flags.overdue && flags.dueSoon && <Badge variant="warning">Due soon</Badge>}
      {flags.missingEvidence && <Badge variant="warning">Missing evidence</Badge>}
    </span>
  );
}

/** "12 Nov 2026" in the server's locale, or a dash when there is no deadline. */
export function formatDue(d: Date | null): string {
  if (!d) return "No deadline";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Plain words for each history entry (see EVENT in src/lib/assignments.ts). */
export const EVENT_LABEL: Record<string, string> = {
  assigned: "Assigned",
  reassigned: "Reassigned",
  started: "Started",
  held: "Put on hold",
  resumed: "Resumed",
  evidence_added: "Evidence added",
  submitted: "Submitted",
  verified: "Passed the system checks",
  approved: "Completed (approved)",
  returned: "Returned for changes",
  rejected: "Rejected",
  repeat_started: "Next round started",
  repeat_stopped: "Repeats stopped",
};

/** "12 Nov 2026, 14:05 UTC". Times are shown in UTC everywhere in the assignment pages. */
export function formatWhen(d: Date): string {
  return `${d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
}
