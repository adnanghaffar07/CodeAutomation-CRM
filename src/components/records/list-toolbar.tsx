"use client";
// Search, filters, sort and saved views for a list. All state lives in the page URL, so a filtered list can be
// bookmarked, shared, and survives a refresh; changing any filter returns to the first page.
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Loader2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, nativeSelectClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EMAIL_STATUSES, EMAIL_STATUS_LABEL, FILTER_KEYS, LEAD_STATUSES, LEAD_STATUS_LABEL, SORTS, SORT_LABEL, type EntityKind } from "@/lib/records/constants";
import type { MemberLite } from "@/components/records/bits";
import { deleteView, saveView } from "@/app/(app)/views/actions";

export type ViewRow = { id: string; name: string; filters: Record<string, string>; sort: string; shared: boolean; mine: boolean };

export function ListToolbar({
  kind, members, views, canShare, industries,
}: { kind: EntityKind; members: MemberLite[]; views: ViewRow[]; canShare: boolean; industries?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [saveOpen, setSaveOpen] = React.useState(false);

  const push = React.useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    next.delete("cursor");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, router]);

  // Debounced search: wait for a pause in typing before asking the server.
  React.useEffect(() => {
    const t = setTimeout(() => { if ((params.get("q") ?? "") !== q.trim()) push({ q: q.trim() || null }); }, 350);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = FILTER_KEYS.filter((k) => k !== "sort" && params.get(k));
  const get = (k: string) => params.get(k) ?? "";
  const sel = nativeSelectClass + " !h-9 text-footnote";

  function applyView(v: ViewRow) {
    const next = new URLSearchParams();
    for (const [k, val] of Object.entries(v.filters)) if (val) next.set(k, val);
    if (v.sort && v.sort !== "newest") next.set("sort", v.sort);
    setQ(v.filters.q ?? "");
    router.push(next.toString() ? `${pathname}?${next}` : pathname);
  }

  async function removeView(v: ViewRow) {
    const r = await deleteView(v.id);
    if (!r.ok) toast.error(r.error); else { toast.success("View deleted"); router.refresh(); }
  }

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={kind === "contact" ? "Search name, email, company, title…" : "Search company, domain, industry…"} className="pl-9" aria-label="Search" />
        </div>
        <select aria-label="Status" className={sel} value={get("status")} onChange={(e) => push({ status: e.target.value || null })}>
          <option value="">Any status</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
        </select>
        {kind === "contact" && (
          <select aria-label="Email status" className={sel} value={get("emailStatus")} onChange={(e) => push({ emailStatus: e.target.value || null })}>
            <option value="">Any email status</option>
            {EMAIL_STATUSES.map((s) => <option key={s} value={s}>{EMAIL_STATUS_LABEL[s]}</option>)}
          </select>
        )}
        {kind === "account" && industries && industries.length > 0 && (
          <select aria-label="Industry" className={sel} value={get("industry")} onChange={(e) => push({ industry: e.target.value || null })}>
            <option value="">Any industry</option>
            {industries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        <select aria-label="Owner" className={sel} value={get("owner")} onChange={(e) => push({ owner: e.target.value || null })}>
          <option value="">Any owner</option>
          <option value="me">Mine</option>
          <option value="none">Unassigned</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
        </select>
        <select aria-label="Follow-up" className={sel} value={get("due")} onChange={(e) => push({ due: e.target.value || null })}>
          <option value="">Any follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="week">Due in 7 days</option>
        </select>
        <select aria-label="Sort" className={sel} value={get("sort") || "newest"} onChange={(e) => push({ sort: e.target.value === "newest" ? null : e.target.value })}>
          {SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
        </select>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><Bookmark /> Views{views.length ? ` (${views.length})` : ""}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-caption font-medium text-muted-foreground">Saved views</DropdownMenuLabel>
            {views.length === 0 && <div className="px-2.5 py-2 text-footnote text-muted-foreground">None yet. Set filters, then save them.</div>}
            {views.map((v) => (
              <DropdownMenuItem key={v.id} onSelect={() => applyView(v)} className="justify-between">
                <span className="truncate">{v.name}{v.shared && <span className="ml-1.5 text-caption text-muted-foreground">shared</span>}</span>
                {v.mine && (
                  <span role="button" tabIndex={0} aria-label={`Delete view ${v.name}`} className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); void removeView(v); }}><Trash2 className="size-3.5" /></span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setSaveOpen(true)}>Save current filters…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {(active.length > 0 || get("sort")) && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); router.push(pathname); }}><X /> Clear</Button>
        )}
      </div>
      <SaveViewDialog open={saveOpen} onOpenChange={setSaveOpen} kind={kind} canShare={canShare} filters={Object.fromEntries(FILTER_KEYS.filter((k) => k !== "sort" && params.get(k)).map((k) => [k, params.get(k)!]))} sort={get("sort") || "newest"} onSaved={() => router.refresh()} />
    </div>
  );
}

function SaveViewDialog({ open, onOpenChange, kind, canShare, filters, sort, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; kind: EntityKind; canShare: boolean; filters: Record<string, string>; sort: string; onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await saveView({ entity: kind, name, filters, sort: sort as never, shared });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("View saved");
    setName(""); setShared(false); onOpenChange(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
            <DialogDescription>Remembers the search, filters and sort you have set right now.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="view-name">Name</Label>
            <Input id="view-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My hot leads" />
          </div>
          {canShare && (
            <label className="flex items-center gap-2 text-body">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="size-4 accent-[hsl(var(--brand))]" /> Share with the whole team
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !name.trim()}>{busy && <Loader2 className="animate-spin" />} Save view</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
