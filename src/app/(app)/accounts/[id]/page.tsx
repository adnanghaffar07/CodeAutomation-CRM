import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AccountForm } from "@/components/records/record-forms";
import { EmailStatusBadge, LeadBadge } from "@/components/records/bits";
import { Timeline } from "@/components/records/timeline";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { loadRecordContext } from "@/lib/records/context";
import { loadTimeline } from "@/lib/records/timeline";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AccountPage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  if (!can(me.role, "accounts.read")) redirect("/");
  if (!UUID.test(params.id)) notFound();

  const data = await withScope(me.scope, async (tx) => {
    const account = await tx.account.findUnique({ where: { id: params.id } });
    if (!account) return null;
    const [ctx, timeline, contacts, contactCount] = await Promise.all([
      loadRecordContext(tx, me, "account"),
      loadTimeline(tx, "account", account.id),
      tx.contact.findMany({ where: { accountId: account.id }, select: { id: true, fullName: true, jobTitle: true, email: true, emailStatus: true, qualification: true }, orderBy: { fullName: "asc" }, take: 25 }),
      tx.contact.count({ where: { accountId: account.id } }),
    ]);
    return { account, ctx, timeline, contacts, contactCount };
  });
  if (!data) notFound();

  const { account: a, ctx, timeline, contacts, contactCount } = data;
  return (
    <>
      <PageHeader
        icon={<Building2 />}
        breadcrumb={<Link href="/accounts" className="inline-flex items-center gap-1 hover:text-foreground"><ChevronLeft className="size-3.5" /> Accounts</Link>}
        title={a.name}
        subtitle={[a.industry, a.domain, a.country].filter(Boolean).join(" · ") || undefined}
      >
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <LeadBadge status={a.qualification} />
          {a.verifiedAt && <Badge variant="success">Verified</Badge>}
          {a.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <AccountForm key={a.updatedAt.toISOString()} initial={{ ...a, customFields: (a.customFields ?? {}) as Record<string, unknown> }} members={ctx.members} defs={ctx.defs} canReassign={can(me.role, "assignments.manage")} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Contacts ({contactCount})</CardTitle></CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-body text-muted-foreground">No contacts at this company that you can see yet.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {contacts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/contacts/${c.id}`} className="font-medium text-foreground hover:text-brand-text">{c.fullName}</Link>
                        <div className="truncate text-footnote text-muted-foreground">{[c.jobTitle, c.email].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5"><EmailStatusBadge status={c.emailStatus} /><LeadBadge status={c.qualification} /></div>
                    </li>
                  ))}
                </ul>
              )}
              {contactCount > contacts.length && <Link href={`/contacts?accountId=${a.id}`} className="mt-3 inline-block text-body font-medium text-brand-text hover:underline">See all {contactCount}</Link>}
            </CardContent>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
          <CardContent><Timeline recordType="account" recordId={a.id} items={timeline} /></CardContent>
        </Card>
      </div>
    </>
  );
}
