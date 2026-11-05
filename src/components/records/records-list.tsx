"use client";
// The table for both lists: row selection, a bulk-action bar, "New" dialog and keyset paging links.
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronRight, Loader2, Plus, Trash2, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, nativeSelectClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmailStatusBadge, FollowUp, LeadBadge, Person, Tags, type MemberLite } from "@/components/records/bits";
import { NewAccountDialog, NewContactDialog, type AccountOption, type CustomFieldDefLite } from "@/components/records/record-forms";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type EntityKind } from "@/lib/records/constants";
import { bulkUpdateContacts, deleteContacts } from "@/app/(app)/contacts/actions";
import { bulkUpdateAccounts, deleteAccounts } from "@/app/(app)/accounts/actions";

export type ContactListRow = { id: string; fullName: string; email: string | null; emailStatus: string; jobTitle: string | null; accountId: string | null; accountName: string | null; ownerId: string | null; qualification: string; tags: string[]; followUpAt: string | null };
export type AccountListRow = { id: string; name: string; domain: string | null; industry: string | null; country: string | null; sizeBand: string | null; ownerId: string | null; qualification: string; tags: string[]; followUpAt: string | null; contactCount: number };

type Props = {
  kind: EntityKind;
  rows: (ContactListRow | AccountListRow)[];
  members: MemberLite[];
  accounts: AccountOption[];
  defs: CustomFieldDefLite[];
  canReassign: boolean;
  nextCursor: string | null;
  total: number | null;
  totalCapped: boolean;
  hasCursor: boolean;
  filtered: boolean;
};

export function RecordsList(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [tag, setTag] = React.useState("");
  const noun = p.kind === "contact" ? "contact" : "account";

  React.useEffect(() => setSelected(new Set()), [p.rows]);

  const allIds = p.rows.map((r) => r.id);
  const allOn = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const pageLink = (cursor: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (cursor) next.set("cursor", cursor); else next.delete("cursor");
    return next.toString() ? `${pathname}?${next}` : pathname;
  };

  async function bulk(change: { ownerId?: string; qualification?: string; addTag?: string }) {
    setBusy(true);
    const ids = [...selected];
    const r = p.kind === "contact" ? await bulkUpdateContacts({ ids, ...change } as never) : await bulkUpdateAccounts({ ids, ...change } as never);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(`Updated ${"updated" in r ? r.updated : ids.length} ${noun}${ids.length === 1 ? "" : "s"}`);
    setTag("");
    router.refresh();
  }

  async function remove() {
    const n = selected.size;
    if (!(await confirmDialog({ title: `Delete ${n} ${noun}${n === 1 ? "" : "s"}?`, message: "This can't be undone. Their history stays in the audit trail.", confirmLabel: "Delete", variant: "destructive" }))) return;
    setBusy(true);
    const ids = [...selected];
    const r = p.kind === "contact" ? await deleteContacts(ids) : await deleteAccounts(ids);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Deleted");
    router.refresh();
  }

  const totalText = p.total === null ? "" : `${p.totalCapped ? `${p.total.toLocaleString()}+` : p.total.toLocaleString()} ${noun}${p.total === 1 && !p.totalCapped ? "" : "s"}`;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-body text-muted-foreground" aria-live="polite">{totalText}</p>
        <Button onClick={() => setNewOpen(true)}><Plus /> New {noun}</Button>
      </div>

      {selected.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="sticky top-14 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-card bg-brand-tint px-3 py-2 shadow-e2">
          <span className="text-footnote font-semibold text-brand-text">{selected.size} selected</span>
          <select aria-label="Set status" className={nativeSelectClass + " !h-8 text-footnote"} value="" disabled={busy} onChange={(e) => e.target.value && bulk({ qualification: e.target.value })}>
            <option value="">Set status…</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
          </select>
          {p.canReassign && (
            <select aria-label="Assign owner" className={nativeSelectClass + " !h-8 text-footnote"} value="" disabled={busy} onChange={(e) => e.target.value && bulk({ ownerId: e.target.value })}>
              <option value="">Assign owner…</option>
              {p.members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
            </select>
          )}
          <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (tag.trim()) void bulk({ addTag: tag.trim() }); }}>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add tag" aria-label="Add tag" className="!h-8 w-32 text-footnote" />
            <Button type="submit" size="sm" variant="outline" disabled={busy || !tag.trim()}>Add</Button>
          </form>
          {p.canReassign && <Button size="sm" variant="destructive-ghost" disabled={busy} onClick={remove}><Trash2 /> Delete</Button>}
          {busy && <Loader2 className="size-4 animate-spin text-brand-text" />}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      )}

      {p.rows.length === 0 ? (
        <EmptyState
          icon={p.kind === "contact" ? <Users /> : <UserCheck />}
          title={p.filtered ? `No ${noun}s match these filters` : `No ${noun}s yet`}
          hint={p.filtered ? "Try removing a filter or searching for something else." : `Add your first ${noun}, or import a file when imports arrive.`}
          action={!p.filtered ? <Button onClick={() => setNewOpen(true)}><Plus /> New {noun}</Button> : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-card bg-card shadow-e1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" aria-label="Select all on this page" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(allIds))} className="size-4 accent-[hsl(var(--brand))]" />
                </TableHead>
                {p.kind === "contact" ? (
                  <><TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Status</TableHead><TableHead>Owner</TableHead><TableHead>Tags</TableHead><TableHead>Follow-up</TableHead></>
                ) : (
                  <><TableHead>Company</TableHead><TableHead>Industry</TableHead><TableHead>Status</TableHead><TableHead>Contacts</TableHead><TableHead>Owner</TableHead><TableHead>Tags</TableHead><TableHead>Follow-up</TableHead></>
                )}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.kind === "contact"
                ? (p.rows as ContactListRow[]).map((r) => (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                    <TableCell><input type="checkbox" aria-label={`Select ${r.fullName}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[hsl(var(--brand))]" /></TableCell>
                    <TableCell>
                      <Link href={`/contacts/${r.id}`} className="font-medium text-foreground hover:text-brand-text">{r.fullName}</Link>
                      <div className="flex items-center gap-1.5 text-footnote text-muted-foreground">{r.jobTitle}{r.jobTitle && r.email ? " · " : ""}{r.email}<EmailStatusBadge status={r.emailStatus} /></div>
                    </TableCell>
                    <TableCell className="text-footnote">{r.accountId ? <Link href={`/accounts/${r.accountId}`} className="hover:text-brand-text">{r.accountName ?? "Account"}</Link> : <span className="text-tertiary">None</span>}</TableCell>
                    <TableCell><LeadBadge status={r.qualification} /></TableCell>
                    <TableCell><Person id={r.ownerId} members={p.members} /></TableCell>
                    <TableCell><Tags tags={r.tags} /></TableCell>
                    <TableCell><FollowUp at={r.followUpAt} /></TableCell>
                    <TableCell><Link href={`/contacts/${r.id}`} aria-label={`Open ${r.fullName}`}><ChevronRight className="size-4 text-tertiary" /></Link></TableCell>
                  </TableRow>
                ))
                : (p.rows as AccountListRow[]).map((r) => (
                  <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                    <TableCell><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[hsl(var(--brand))]" /></TableCell>
                    <TableCell>
                      <Link href={`/accounts/${r.id}`} className="font-medium text-foreground hover:text-brand-text">{r.name}</Link>
                      <div className="text-footnote text-muted-foreground">{r.domain}{r.domain && r.country ? " · " : ""}{r.country}</div>
                    </TableCell>
                    <TableCell className="text-footnote">{r.industry ?? <span className="text-tertiary">Not set</span>}</TableCell>
                    <TableCell><LeadBadge status={r.qualification} /></TableCell>
                    <TableCell className="text-footnote tabular-nums">{r.contactCount}</TableCell>
                    <TableCell><Person id={r.ownerId} members={p.members} /></TableCell>
                    <TableCell><Tags tags={r.tags} /></TableCell>
                    <TableCell><FollowUp at={r.followUpAt} /></TableCell>
                    <TableCell><Link href={`/accounts/${r.id}`} aria-label={`Open ${r.name}`}><ChevronRight className="size-4 text-tertiary" /></Link></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(p.hasCursor || p.nextCursor) && (
        <div className="mt-4 flex items-center justify-center gap-4 text-body">
          {p.hasCursor && <Link href={pageLink(null)} className="font-medium text-brand-text hover:underline">Back to first page</Link>}
          {p.nextCursor && <Link href={pageLink(p.nextCursor)} className="font-medium text-brand-text hover:underline">Next 50</Link>}
        </div>
      )}

      {p.kind === "contact"
        ? <NewContactDialog open={newOpen} onOpenChange={setNewOpen} members={p.members} accounts={p.accounts} defs={p.defs} canReassign={p.canReassign} />
        : <NewAccountDialog open={newOpen} onOpenChange={setNewOpen} members={p.members} defs={p.defs} canReassign={p.canReassign} />}
    </>
  );
}
