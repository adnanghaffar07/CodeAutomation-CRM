import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContactForm } from "@/components/records/record-forms";
import { EmailStatusBadge, LeadBadge } from "@/components/records/bits";
import { Timeline } from "@/components/records/timeline";
import { Attachments } from "@/components/records/attachments";
import { loadAttachments } from "@/lib/records/attachments";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { loadRecordContext } from "@/lib/records/context";
import { loadTimeline } from "@/lib/records/timeline";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ContactPage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  if (!can(me.role, "contacts.read")) redirect("/");
  if (!UUID.test(params.id)) notFound();

  const data = await withScope(me.scope, async (tx) => {
    const contact = await tx.contact.findUnique({ where: { id: params.id }, include: { account: { select: { id: true, name: true } } } });
    if (!contact) return null;
    return { contact, ctx: await loadRecordContext(tx, me, "contact", { withAccounts: true }), timeline: await loadTimeline(tx, "contact", contact.id), attachments: await loadAttachments(tx, "contact", contact.id) };
  });
  if (!data) notFound(); // either it does not exist or the caller may not see it: the page cannot tell them which

  const { contact: c, ctx, timeline, attachments } = data;
  const accounts = c.account && !ctx.accounts.some((a) => a.id === c.account!.id) ? [c.account, ...ctx.accounts] : ctx.accounts;
  return (
    <>
      <PageHeader
        icon={<Users />}
        breadcrumb={<Link href="/contacts" className="inline-flex items-center gap-1 hover:text-foreground"><ChevronLeft className="size-3.5" /> Contacts</Link>}
        title={c.fullName}
        subtitle={[c.jobTitle, c.account?.name].filter(Boolean).join(" at ") || undefined}
      >
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <LeadBadge status={c.qualification} />
          <EmailStatusBadge status={c.emailStatus} />
          {c.verifiedAt && <Badge variant="success">Verified</Badge>}
          {c.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
        </div>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent>
            <ContactForm
              key={c.updatedAt.toISOString()}
              initial={{ ...c, customFields: (c.customFields ?? {}) as Record<string, unknown> }}
              members={ctx.members} accounts={accounts} defs={ctx.defs} canReassign={can(me.role, "assignments.manage")}
            />
          </CardContent>
        </Card>
        <div className="space-y-6 self-start">
          <Card>
            <CardHeader><CardTitle>Attachments ({attachments.length})</CardTitle></CardHeader>
            <CardContent><Attachments recordType="contact" recordId={c.id} items={attachments} canUpload={can(me.role, "contacts.write")} userId={me.userId} canDeleteAny={can(me.role, "assignments.manage")} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent><Timeline recordType="contact" recordId={c.id} items={timeline} /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
