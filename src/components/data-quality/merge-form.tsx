"use client";
// Merge two contacts by their email addresses. The one you keep stays; the other is folded into it and removed.
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeContacts } from "@/app/(app)/data-quality/actions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export function MergeForm() {
  const [keep, setKeep] = React.useState("");
  const [drop, setDrop] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function merge(e: React.FormEvent) {
    e.preventDefault();
    if (!keep.trim() || !drop.trim()) return toast.error("Enter both email addresses.");
    const ok = await confirmDialog({
      title: "Merge these contacts?",
      message: `${drop.trim()} will be merged into ${keep.trim()} and removed. This can't be undone.`,
      confirmLabel: "Merge",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    const r = await mergeContacts(keep, drop);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Contacts merged.");
    setKeep("");
    setDrop("");
  }

  const field = "h-11 w-full rounded-control border border-input bg-field px-3 text-body md:h-9";
  return (
    <form onSubmit={merge} className="space-y-4">
      <label className="flex flex-col gap-1 text-footnote">
        <span className="text-muted-foreground">Keep this contact (email)</span>
        <input className={field} type="email" value={keep} onChange={(e) => setKeep(e.target.value)} placeholder="ada@example.com" />
      </label>
      <label className="flex flex-col gap-1 text-footnote">
        <span className="text-muted-foreground">Merge and remove this contact (email)</span>
        <input className={field} type="email" value={drop} onChange={(e) => setDrop(e.target.value)} placeholder="ada.lovelace@example.com" />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? "Merging…" : "Merge contacts"}</Button>
      </div>
    </form>
  );
}
