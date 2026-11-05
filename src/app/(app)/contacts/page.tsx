import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/records/list-toolbar";
import { RecordsList, type ContactListRow } from "@/components/records/records-list";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { listContacts, parseFilters } from "@/lib/records/list";
import { loadRecordContext } from "@/lib/records/context";
import { FILTER_KEYS } from "@/lib/records/constants";

export const metadata: Metadata = { title: "Contacts" };
export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const me = await requireUser();
  if (!can(me.role, "contacts.read")) redirect("/");
  const filters = parseFilters(searchParams);
  const cursor = typeof searchParams.cursor === "string" ? searchParams.cursor : undefined;

  const { page, ctx } = await withScope(me.scope, async (tx) => ({
    page: await listContacts(tx, me.scope, filters, cursor),
    ctx: await loadRecordContext(tx, me, "contact", { withAccounts: true }),
  }));

  const rows: ContactListRow[] = page.rows.map((r) => ({ ...r, followUpAt: r.followUpAt ? r.followUpAt.toISOString() : null }));
  const filtered = FILTER_KEYS.some((k) => k !== "sort" && searchParams[k]);
  return (
    <>
      <PageHeader title="Contacts" subtitle={me.role === "sales_bd" || me.role === "data_researcher" ? "People you created, own or were assigned." : "Every person in the workspace."} icon={<Users />} />
      <ListToolbar kind="contact" members={ctx.members} views={ctx.views} canShare={can(me.role, "assignments.manage")} />
      <RecordsList
        kind="contact" rows={rows} members={ctx.members} accounts={ctx.accounts} defs={ctx.defs} canReassign={can(me.role, "assignments.manage")}
        nextCursor={page.nextCursor} total={page.total} totalCapped={page.totalCapped} hasCursor={!!cursor} filtered={filtered}
      />
    </>
  );
}
