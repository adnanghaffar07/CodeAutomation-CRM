// Small pieces shared by the contact and account screens.
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shell/user-avatar";
import { EMAIL_STATUS_LABEL, LEAD_STATUS_LABEL, type EmailStatusValue, type LeadStatusValue } from "@/lib/records/constants";

export type MemberLite = { userId: string; fullName: string };

const LEAD_VARIANT: Record<LeadStatusValue, "secondary" | "default" | "warning" | "success" | "destructive"> = {
  new: "secondary", researching: "default", contacted: "default", engaged: "warning", qualified: "success", disqualified: "destructive",
};

export function LeadBadge({ status }: { status: string }) {
  const s = status as LeadStatusValue;
  return <Badge variant={LEAD_VARIANT[s] ?? "secondary"}>{LEAD_STATUS_LABEL[s] ?? status}</Badge>;
}

export function EmailStatusBadge({ status }: { status: string }) {
  if (status === "active") return null;
  return <Badge variant={status === "bounced" ? "warning" : "destructive"}>{EMAIL_STATUS_LABEL[status as EmailStatusValue] ?? status}</Badge>;
}

export function Person({ id, members }: { id: string | null; members: MemberLite[] }) {
  if (!id) return <span className="text-footnote text-tertiary">Unassigned</span>;
  const m = members.find((x) => x.userId === id);
  const name = m?.fullName ?? "Former member";
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <UserAvatar name={name} size={20} />
      <span className="truncate text-footnote">{name}</span>
    </span>
  );
}

export function Tags({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.slice(0, max).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
      {tags.length > max && <span className="text-caption text-muted-foreground">+{tags.length - max}</span>}
    </span>
  );
}

const DAY = 86_400_000;
export function FollowUp({ at }: { at: Date | string | null }) {
  if (!at) return <span className="text-footnote text-tertiary">None</span>;
  const d = new Date(at);
  const overdue = d.getTime() < Date.now() - DAY;
  return (
    <span className={overdue ? "text-footnote font-medium text-destructive" : "text-footnote text-muted-foreground"}>
      {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d)}{overdue ? " · overdue" : ""}
    </span>
  );
}

export function formatDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}
