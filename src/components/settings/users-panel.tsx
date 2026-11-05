"use client";
// Members table with invite, role change, suspend/reinstate and one-time access links (CEO/Admin).
// Managers see the same table read-only.

import * as React from "react";
import { Check, Copy, KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeSelectClass } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/shell/user-avatar";
import { ROLES, ROLE_LABEL } from "@/lib/permissions";
import type { Role } from "@/lib/scope";
import { changeRole, inviteUser, issueAccessLink, setStatus, type ActionResult } from "@/app/(app)/settings/users/actions";

export type MemberRow = { id: string; userId: string; fullName: string; email: string; role: Role; status: "active" | "suspended"; createdAt: string };

function LinkDialog({ link, note, onClose }: { link: string | null; note?: string; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => setCopied(false), [link]);
  async function copy() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { toast.error("Copy failed. Select the link and copy it by hand."); }
  }
  return (
    <Dialog open={!!link} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Access link</DialogTitle>
          <DialogDescription>{note ?? "Send this single-use link to the person."} Treat it like a password: anyone holding it can sign in as them until it is used.</DialogDescription>
        </DialogHeader>
        <Input readOnly value={link ?? ""} onFocus={(e) => e.currentTarget.select()} aria-label="Access link" className="font-mono text-footnote" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
          <Button onClick={copy}>{copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPanel({ members, canManage, meUserId }: { members: MemberRow[]; canManage: boolean; meUserId: string }) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [link, setLink] = React.useState<{ url: string; note?: string } | null>(null);

  async function run(id: string, fn: () => Promise<ActionResult>, success?: string) {
    setBusyId(id);
    const r = await fn();
    setBusyId(null);
    if (!r.ok) return toast.error(r.error);
    if (r.link) setLink({ url: r.link, note: r.note });
    else if (r.note) toast.warning(r.note);
    else if (success) toast.success(success);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">{members.length} {members.length === 1 ? "person" : "people"} in this workspace</p>
        {canManage && <Button onClick={() => setInviteOpen(true)}><UserPlus /> Invite person</Button>}
      </div>

      <div className="overflow-hidden rounded-card bg-card shadow-e1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const self = m.userId === meUserId;
              const busy = busyId === m.id;
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={m.fullName} size={28} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{m.fullName}{self && <span className="ml-1.5 text-footnote text-muted-foreground">(you)</span>}</div>
                        <div className="truncate text-footnote text-muted-foreground">{m.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage && !self ? (
                      <select
                        aria-label={`Role for ${m.fullName}`}
                        className={nativeSelectClass}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => run(m.id, () => changeRole(m.id, e.target.value), "Role updated")}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.status === "active" ? "success" : "warning"}>{m.status === "active" ? "Active" : "Suspended"}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {m.status === "active" && (
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(m.id, () => issueAccessLink(m.id))}>
                            <KeyRound /> Access link
                          </Button>
                        )}
                        {!self && (
                          <Button
                            size="sm"
                            variant={m.status === "active" ? "destructive-ghost" : "outline"}
                            disabled={busy}
                            onClick={async () => {
                              if (m.status === "active" && !(await confirmDialog({
                                title: `Suspend ${m.fullName}?`,
                                message: "They are signed out of the CRM on their next click and can't sign in until reinstated. Their data stays.",
                                confirmLabel: "Suspend", variant: "destructive",
                              }))) return;
                              run(m.id, () => setStatus(m.id, m.status === "active" ? "suspended" : "active"), m.status === "active" ? "Suspended" : "Reinstated");
                            }}
                          >
                            {busy && <Loader2 className="animate-spin" />} {m.status === "active" ? "Suspend" : "Reinstate"}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} onLink={(url, note) => setLink({ url, note })} />
      <LinkDialog link={link?.url ?? null} note={link?.note} onClose={() => setLink(null)} />
    </>
  );
}

function InviteDialog({ open, onOpenChange, onLink }: { open: boolean; onOpenChange: (o: boolean) => void; onLink: (url: string, note?: string) => void }) {
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("sales_bd");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await inviteUser({ fullName, email, role });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    onOpenChange(false);
    setFullName(""); setEmail(""); setRole("sales_bd");
    if (r.link) onLink(r.link, r.note);
    toast.success("Person added");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Invite a person</DialogTitle>
            <DialogDescription>They get access once they open the single-use link you send them and choose a password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Full name</Label>
            <Input id="inv-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Work email</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-role">Role</Label>
            <select id="inv-role" className={nativeSelectClass + " w-full"} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          {error && <p role="alert" className="rounded-control bg-destructive-tint px-3 py-2 text-footnote text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !fullName || !email}>{busy && <Loader2 className="animate-spin" />} Create access link</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
