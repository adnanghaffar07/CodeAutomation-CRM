"use client";
// Create / edit forms for contacts and accounts. The same form is used in the "New" dialog and on the record page.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea, nativeSelectClass } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EMAIL_STATUSES, EMAIL_STATUS_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, SIZE_BANDS } from "@/lib/records/constants";
import type { MemberLite } from "@/components/records/bits";
import { createContact, updateContact } from "@/app/(app)/contacts/actions";
import { createAccount, updateAccount } from "@/app/(app)/accounts/actions";

export type CustomFieldDefLite = { key: string; label: string; type: "text" | "number" | "date" | "select"; options: string[] };
export type AccountOption = { id: string; name: string };

function Field({ label, htmlFor, children, wide }: { label: string; htmlFor: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "space-y-1.5 md:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

const dateValue = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const sel = nativeSelectClass + " w-full";

function CustomInputs({ defs, values, onChange }: { defs: CustomFieldDefLite[]; values: Record<string, string>; onChange: (k: string, v: string) => void }) {
  if (defs.length === 0) return null;
  return (
    <>
      <h3 className="pt-2 text-footnote font-semibold text-muted-foreground md:col-span-2">Custom fields</h3>
      {defs.map((d) => (
        <Field key={d.key} label={d.label} htmlFor={`cf-${d.key}`}>
          {d.type === "select" ? (
            <select id={`cf-${d.key}`} className={sel} value={values[d.key] ?? ""} onChange={(e) => onChange(d.key, e.target.value)}>
              <option value="">Not set</option>
              {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <Input id={`cf-${d.key}`} type={d.type === "number" ? "number" : d.type === "date" ? "date" : "text"} value={values[d.key] ?? ""} onChange={(e) => onChange(d.key, e.target.value)} />
          )}
        </Field>
      ))}
    </>
  );
}

function OwnerSelect({ id, value, onChange, members }: { id: string; value: string; onChange: (v: string) => void; members: MemberLite[] }) {
  return (
    <select id={id} className={sel} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Unassigned</option>
      {members.map((m) => <option key={m.userId} value={m.userId}>{m.fullName}</option>)}
    </select>
  );
}

// ───────────────────────────────────────── contacts

export type ContactInitial = {
  id?: string; firstName: string; lastName: string; email: string | null; emailStatus: string; phone: string | null; jobTitle: string | null;
  linkedinUrl: string | null; city: string | null; region: string | null; country: string | null; source: string | null;
  serviceInterest: string | null; nextAction: string | null; accountId: string | null; ownerId: string | null; assigneeIds: string[];
  qualification: string; followUpAt: Date | string | null; verifiedAt: Date | string | null; tags: string[]; customFields: Record<string, unknown>;
};

export const EMPTY_CONTACT: ContactInitial = {
  firstName: "", lastName: "", email: "", emailStatus: "active", phone: "", jobTitle: "", linkedinUrl: "", city: "", region: "", country: "",
  source: "", serviceInterest: "", nextAction: "", accountId: "", ownerId: "", assigneeIds: [], qualification: "new", followUpAt: null,
  verifiedAt: null, tags: [], customFields: {},
};

export function ContactForm({ initial, members, accounts, defs, canReassign, onDone }: {
  initial: ContactInitial; members: MemberLite[]; accounts: AccountOption[]; defs: CustomFieldDefLite[]; canReassign: boolean; onDone?: (id?: string) => void;
}) {
  const router = useRouter();
  const [v, setV] = React.useState({ ...initial, tags: initial.tags.join(", "), followUpAt: dateValue(initial.followUpAt), verified: !!initial.verifiedAt });
  const [cf, setCf] = React.useState<Record<string, string>>(Object.fromEntries(Object.entries(initial.customFields ?? {}).map(([k, x]) => [k, x == null ? "" : String(x)])));
  const [busy, setBusy] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const text = (k: keyof typeof v) => (v[k] as string | null) ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const customFields = Object.fromEntries(defs.map((d) => [d.key, cf[d.key] === "" || cf[d.key] === undefined ? null : d.type === "number" ? Number(cf[d.key]) : cf[d.key]]));
    const payload = {
      firstName: v.firstName, lastName: v.lastName, email: v.email, phone: v.phone, jobTitle: v.jobTitle, linkedinUrl: v.linkedinUrl, city: v.city,
      region: v.region, country: v.country, source: v.source, serviceInterest: v.serviceInterest, nextAction: v.nextAction, accountId: v.accountId,
      ownerId: v.ownerId, assigneeIds: v.assigneeIds, qualification: v.qualification as never, emailStatus: v.emailStatus as never,
      followUpAt: v.followUpAt || null, verified: v.verified, tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean), customFields,
    };
    const r = initial.id ? await updateContact(initial.id, payload as never) : await createContact(payload as never);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(initial.id ? "Saved" : "Contact created");
    router.refresh();
    onDone?.("id" in r ? (r as { id: string }).id : initial.id);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <Field label="First name" htmlFor="c-first"><Input id="c-first" required value={v.firstName} onChange={set("firstName")} autoFocus={!initial.id} /></Field>
      <Field label="Last name" htmlFor="c-last"><Input id="c-last" value={v.lastName} onChange={set("lastName")} /></Field>
      <Field label="Email" htmlFor="c-email"><Input id="c-email" type="email" value={text("email")} onChange={set("email")} /></Field>
      <Field label="Email status" htmlFor="c-estatus">
        <select id="c-estatus" className={sel} value={v.emailStatus} onChange={set("emailStatus")}>
          {EMAIL_STATUSES.map((s) => <option key={s} value={s}>{EMAIL_STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Phone" htmlFor="c-phone"><Input id="c-phone" value={text("phone")} onChange={set("phone")} /></Field>
      <Field label="Job title" htmlFor="c-title"><Input id="c-title" value={text("jobTitle")} onChange={set("jobTitle")} /></Field>
      <Field label="Account" htmlFor="c-account">
        <select id="c-account" className={sel} value={v.accountId ?? ""} onChange={set("accountId")}>
          <option value="">No account</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="LinkedIn URL" htmlFor="c-linkedin"><Input id="c-linkedin" value={text("linkedinUrl")} onChange={set("linkedinUrl")} /></Field>
      <Field label="City" htmlFor="c-city"><Input id="c-city" value={text("city")} onChange={set("city")} /></Field>
      <Field label="Country" htmlFor="c-country"><Input id="c-country" value={text("country")} onChange={set("country")} /></Field>
      <Field label="Status" htmlFor="c-status">
        <select id="c-status" className={sel} value={v.qualification} onChange={set("qualification")}>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Owner" htmlFor="c-owner">
        {canReassign ? <OwnerSelect id="c-owner" value={v.ownerId ?? ""} onChange={(x) => setV((p) => ({ ...p, ownerId: x }))} members={members} /> : <Input id="c-owner" value={members.find((m) => m.userId === v.ownerId)?.fullName ?? "You"} disabled />}
      </Field>
      <Field label="Service interest" htmlFor="c-service"><Input id="c-service" value={text("serviceInterest")} onChange={set("serviceInterest")} /></Field>
      <Field label="Source" htmlFor="c-source"><Input id="c-source" value={text("source")} onChange={set("source")} placeholder="e.g. Conference, referral" /></Field>
      <Field label="Next action" htmlFor="c-next"><Input id="c-next" value={text("nextAction")} onChange={set("nextAction")} /></Field>
      <Field label="Follow-up date" htmlFor="c-follow"><Input id="c-follow" type="date" value={v.followUpAt} onChange={set("followUpAt")} /></Field>
      <Field label="Tags (comma separated)" htmlFor="c-tags" wide><Input id="c-tags" value={v.tags} onChange={set("tags")} placeholder="hot, webinar" /></Field>
      <label className="flex items-center gap-2 text-body md:col-span-2">
        <input type="checkbox" checked={v.verified} onChange={(e) => setV((p) => ({ ...p, verified: e.target.checked }))} className="size-4 accent-[hsl(var(--brand))]" /> Details verified
      </label>
      <CustomInputs defs={defs} values={cf} onChange={(k, x) => setCf((p) => ({ ...p, [k]: x }))} />
      <div className="flex justify-end gap-2 pt-2 md:col-span-2">
        <Button type="submit" disabled={busy || !v.firstName.trim()}>{busy && <Loader2 className="animate-spin" />} {initial.id ? "Save changes" : "Create contact"}</Button>
      </div>
    </form>
  );
}

export function NewContactDialog({ open, onOpenChange, ...rest }: { open: boolean; onOpenChange: (o: boolean) => void } & Omit<React.ComponentProps<typeof ContactForm>, "initial" | "onDone">) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>New contact</DialogTitle><DialogDescription>Add a person you want to sell to.</DialogDescription></DialogHeader>
        <ContactForm {...rest} initial={EMPTY_CONTACT} onDone={(id) => { onOpenChange(false); if (id) router.push(`/contacts/${id}`); }} />
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────────────────── accounts

export type AccountInitial = {
  id?: string; name: string; domain: string | null; website: string | null; industry: string | null; sizeBand: string | null; city: string | null;
  region: string | null; country: string | null; phone: string | null; linkedinUrl: string | null; description: string | null; source: string | null;
  serviceInterest: string | null; nextAction: string | null; ownerId: string | null; assigneeIds: string[]; qualification: string;
  followUpAt: Date | string | null; verifiedAt: Date | string | null; tags: string[]; customFields: Record<string, unknown>;
};

export const EMPTY_ACCOUNT: AccountInitial = {
  name: "", domain: "", website: "", industry: "", sizeBand: "", city: "", region: "", country: "", phone: "", linkedinUrl: "", description: "",
  source: "", serviceInterest: "", nextAction: "", ownerId: "", assigneeIds: [], qualification: "new", followUpAt: null, verifiedAt: null, tags: [], customFields: {},
};

export function AccountForm({ initial, members, defs, canReassign, onDone }: {
  initial: AccountInitial; members: MemberLite[]; defs: CustomFieldDefLite[]; canReassign: boolean; onDone?: (id?: string) => void;
}) {
  const router = useRouter();
  const [v, setV] = React.useState({ ...initial, tags: initial.tags.join(", "), followUpAt: dateValue(initial.followUpAt), verified: !!initial.verifiedAt });
  const [cf, setCf] = React.useState<Record<string, string>>(Object.fromEntries(Object.entries(initial.customFields ?? {}).map(([k, x]) => [k, x == null ? "" : String(x)])));
  const [busy, setBusy] = React.useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV((p) => ({ ...p, [k]: e.target.value }));
  const text = (k: keyof typeof v) => (v[k] as string | null) ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const customFields = Object.fromEntries(defs.map((d) => [d.key, cf[d.key] === "" || cf[d.key] === undefined ? null : d.type === "number" ? Number(cf[d.key]) : cf[d.key]]));
    const payload = {
      name: v.name, domain: v.domain, website: v.website, industry: v.industry, sizeBand: v.sizeBand, city: v.city, region: v.region, country: v.country,
      phone: v.phone, linkedinUrl: v.linkedinUrl, description: v.description, source: v.source, serviceInterest: v.serviceInterest, nextAction: v.nextAction,
      ownerId: v.ownerId, assigneeIds: v.assigneeIds, qualification: v.qualification as never, followUpAt: v.followUpAt || null, verified: v.verified,
      tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean), customFields,
    };
    const r = initial.id ? await updateAccount(initial.id, payload as never) : await createAccount(payload as never);
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(initial.id ? "Saved" : "Account created");
    router.refresh();
    onDone?.("id" in r ? (r as { id: string }).id : initial.id);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <Field label="Company name" htmlFor="a-name" wide><Input id="a-name" required value={v.name} onChange={set("name")} autoFocus={!initial.id} /></Field>
      <Field label="Domain" htmlFor="a-domain"><Input id="a-domain" value={text("domain")} onChange={set("domain")} placeholder="example.com" /></Field>
      <Field label="Website" htmlFor="a-web"><Input id="a-web" value={text("website")} onChange={set("website")} /></Field>
      <Field label="Industry" htmlFor="a-industry"><Input id="a-industry" value={text("industry")} onChange={set("industry")} /></Field>
      <Field label="Company size" htmlFor="a-size">
        <select id="a-size" className={sel} value={v.sizeBand ?? ""} onChange={set("sizeBand")}>
          <option value="">Not set</option>
          {SIZE_BANDS.map((s) => <option key={s} value={s}>{s} employees</option>)}
        </select>
      </Field>
      <Field label="City" htmlFor="a-city"><Input id="a-city" value={text("city")} onChange={set("city")} /></Field>
      <Field label="Country" htmlFor="a-country"><Input id="a-country" value={text("country")} onChange={set("country")} /></Field>
      <Field label="Phone" htmlFor="a-phone"><Input id="a-phone" value={text("phone")} onChange={set("phone")} /></Field>
      <Field label="LinkedIn URL" htmlFor="a-linkedin"><Input id="a-linkedin" value={text("linkedinUrl")} onChange={set("linkedinUrl")} /></Field>
      <Field label="Status" htmlFor="a-status">
        <select id="a-status" className={sel} value={v.qualification} onChange={set("qualification")}>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="Owner" htmlFor="a-owner">
        {canReassign ? <OwnerSelect id="a-owner" value={v.ownerId ?? ""} onChange={(x) => setV((p) => ({ ...p, ownerId: x }))} members={members} /> : <Input id="a-owner" value={members.find((m) => m.userId === v.ownerId)?.fullName ?? "You"} disabled />}
      </Field>
      <Field label="Service interest" htmlFor="a-service"><Input id="a-service" value={text("serviceInterest")} onChange={set("serviceInterest")} /></Field>
      <Field label="Source" htmlFor="a-source"><Input id="a-source" value={text("source")} onChange={set("source")} /></Field>
      <Field label="Next action" htmlFor="a-next"><Input id="a-next" value={text("nextAction")} onChange={set("nextAction")} /></Field>
      <Field label="Follow-up date" htmlFor="a-follow"><Input id="a-follow" type="date" value={v.followUpAt} onChange={set("followUpAt")} /></Field>
      <Field label="Description" htmlFor="a-desc" wide><Textarea id="a-desc" value={text("description")} onChange={set("description")} /></Field>
      <Field label="Tags (comma separated)" htmlFor="a-tags" wide><Input id="a-tags" value={v.tags} onChange={set("tags")} /></Field>
      <label className="flex items-center gap-2 text-body md:col-span-2">
        <input type="checkbox" checked={v.verified} onChange={(e) => setV((p) => ({ ...p, verified: e.target.checked }))} className="size-4 accent-[hsl(var(--brand))]" /> Details verified
      </label>
      <CustomInputs defs={defs} values={cf} onChange={(k, x) => setCf((p) => ({ ...p, [k]: x }))} />
      <div className="flex justify-end gap-2 pt-2 md:col-span-2">
        <Button type="submit" disabled={busy || !v.name.trim()}>{busy && <Loader2 className="animate-spin" />} {initial.id ? "Save changes" : "Create account"}</Button>
      </div>
    </form>
  );
}

export function NewAccountDialog({ open, onOpenChange, ...rest }: { open: boolean; onOpenChange: (o: boolean) => void } & Omit<React.ComponentProps<typeof AccountForm>, "initial" | "onDone">) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>New account</DialogTitle><DialogDescription>Add a company you want to sell to.</DialogDescription></DialogHeader>
        <AccountForm {...rest} initial={EMPTY_ACCOUNT} onDone={(id) => { onOpenChange(false); if (id) router.push(`/accounts/${id}`); }} />
      </DialogContent>
    </Dialog>
  );
}
