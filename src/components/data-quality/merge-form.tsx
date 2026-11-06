"use client";
// Merge two contacts (by email) or two companies (by domain). The one you keep stays; the other is folded into it and removed.
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mergeAccounts, mergeContacts } from "@/app/(app)/data-quality/actions";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export function MergeForm() {
  const [kind, setKind] = React.useState<"contact" | "account">("contact");
  const [keep, setKeep] = React.useState("");
  const [drop, setDrop] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const isContact = kind === "contact";

  async function merge(e: React.FormEvent) {
    e.preventDefault();
    if (!keep.trim() || !drop.trim()) return toast.error(isContact ? "Enter both email addresses." : "Enter both domains.");
    const ok = await confirmDialog({
      title: isContact ? "Merge these contacts?" : "Merge these companies?",
      message: `${drop.trim()} will be merged into ${keep.trim()} and removed. This can't be undone.`,
      confirmLabel: "Merge",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    const r = isContact ? await mergeContacts(keep, drop) : await mergeAccounts(keep, drop);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(isContact ? "Contacts merged." : "Companies merged.");
    setKeep("");
    setDrop("");
  }

  const field = "h-11 w-full rounded-control border border-input bg-field px-3 text-body md:h-9";
  return (
    <form onSubmit={merge} className="space-y-4">
      <div className="flex gap-2" role="group" aria-label="What to merge">
        {(["contact", "account"] as const).map((k) => (
          <Button key={k} type="button" variant={kind === k ? "default" : "outline"} aria-pressed={kind === k} onClick={() => { setKind(k); setKeep(""); setDrop(""); }}>
            {k === "contact" ? "Contacts" : "Companies"}
          </Button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-footnote">
        <span className="text-muted-foreground">{isContact ? "Keep this contact (email)" : "Keep this company (domain)"}</span>
        <input className={field} value={keep} onChange={(e) => setKeep(e.target.value)} placeholder={isContact ? "ada@example.com" : "acme.com"} />
      </label>
      <label className="flex flex-col gap-1 text-footnote">
        <span className="text-muted-foreground">{isContact ? "Merge and remove this contact (email)" : "Merge and remove this company (domain)"}</span>
        <input className={field} value={drop} onChange={(e) => setDrop(e.target.value)} placeholder={isContact ? "ada.lovelace@example.com" : "acme-old.com"} />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>{busy ? "Merging…" : isContact ? "Merge contacts" : "Merge companies"}</Button>
      </div>
    </form>
  );
}
