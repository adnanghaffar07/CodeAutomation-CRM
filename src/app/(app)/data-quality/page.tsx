import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MergeForm } from "@/components/data-quality/merge-form";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";

export const metadata: Metadata = { title: "Data quality" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await requireUser();
  if (!can(me.role, "reports.read")) redirect("/");

  // Counts only what the caller can see (row-level security applies to every count).
  const m = await withScope(me.scope, async (tx) => ({
    contacts: await tx.contact.count(),
    contactsNoEmail: await tx.contact.count({ where: { email: null } }),
    contactsNoPhone: await tx.contact.count({ where: { phone: null } }),
    contactsNoCompany: await tx.contact.count({ where: { accountId: null } }),
    contactsNoOwner: await tx.contact.count({ where: { ownerId: null } }),
    accounts: await tx.account.count(),
    accountsNoDomain: await tx.account.count({ where: { domain: null } }),
    accountsNoIndustry: await tx.account.count({ where: { industry: null } }),
    accountsNoOwner: await tx.account.count({ where: { ownerId: null } }),
  }));

  const rows: { label: string; missing: number; of: number }[] = [
    { label: "Contacts without an email", missing: m.contactsNoEmail, of: m.contacts },
    { label: "Contacts without a phone number", missing: m.contactsNoPhone, of: m.contacts },
    { label: "Contacts not linked to a company", missing: m.contactsNoCompany, of: m.contacts },
    { label: "Contacts without an owner", missing: m.contactsNoOwner, of: m.contacts },
    { label: "Accounts without a domain", missing: m.accountsNoDomain, of: m.accounts },
    { label: "Accounts without an industry", missing: m.accountsNoIndustry, of: m.accounts },
    { label: "Accounts without an owner", missing: m.accountsNoOwner, of: m.accounts },
  ];

  return (
    <>
      <PageHeader title="Data quality" subtitle="Gaps in the records and a way to merge duplicates." icon={<ShieldCheck />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Missing data</CardTitle>
            <CardDescription>{m.contacts.toLocaleString()} contacts and {m.accounts.toLocaleString()} accounts you can see.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-3 py-3 text-footnote">
                  <span>{r.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {r.missing.toLocaleString()} of {r.of.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Merge two contacts</CardTitle>
            <CardDescription>Use this when the same person was entered twice. Managers and the CEO/Admin only.</CardDescription>
          </CardHeader>
          <CardContent>
            <MergeForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
