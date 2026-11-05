"use client";
// A record's timeline (SPEC R-3.5) and the note box. Entries are append-only; corrections are new notes.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bot, CalendarClock, Loader2, Mail, MessageSquare, Pencil, Phone, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/components/records/bits";
import { addNote } from "@/app/(app)/views/actions";

export type TimelineItem = {
  id: string; kind: string; summary: string; body: string | null; actorEmail: string | null; source: string; occurredAt: string;
  changes?: { field: string; from: unknown; to: unknown }[];
};

const ICON: Record<string, React.ReactNode> = {
  note: <StickyNote />, change: <Pencil />, system: <Bot />, email: <Mail />, call: <Phone />, meeting: <CalendarClock />, task: <MessageSquare />,
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "empty" : Array.isArray(v) ? v.join(", ") || "empty" : String(v));

export function Timeline({ recordType, recordId, items }: { recordType: "contact" | "account"; recordId: string; items: TimelineItem[] }) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await addNote(recordType, recordId, body);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setBody("");
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={post} className="mb-5 space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note: what happened, what was agreed, what's next…" aria-label="New note" rows={3} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy || !body.trim()}>{busy && <Loader2 className="animate-spin" />} Add note</Button>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState size="sm" icon={<StickyNote />} title="Nothing yet" hint="Notes, emails, calls and changes will appear here." />
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-5">
          {items.map((it) => (
            <li key={it.id} className="relative">
              <span aria-hidden className="absolute -left-[31px] top-0.5 grid size-5 place-items-center rounded-pill bg-muted text-muted-foreground ring-4 ring-card [&_svg]:size-3">{ICON[it.kind] ?? <StickyNote />}</span>
              <div className="flex flex-wrap items-baseline gap-x-2 text-footnote">
                <span className="font-medium text-foreground">{it.summary}</span>
                {it.source === "integration" && <span className="rounded-pill bg-brand-tint px-1.5 text-caption2 font-semibold text-brand-text">Synced</span>}
                <span className="text-muted-foreground">{formatDateTime(it.occurredAt)}{it.actorEmail ? ` · ${it.actorEmail}` : ""}</span>
              </div>
              {it.body && <p className="mt-1 whitespace-pre-wrap text-body text-foreground">{it.body}</p>}
              {it.changes && it.changes.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-footnote text-muted-foreground">
                  {it.changes.map((c, i) => <li key={i}><span className="font-medium">{c.field}:</span> {show(c.from)} → {show(c.to)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
