import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ListToolbar } from "@/components/records/list-toolbar";
import { RecordsList, type AccountListRow } from "@/components/records/records-list";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { listAccounts, parseFilters } from "@/lib/records/list";
import { loadRecordContext } from "@/lib/records/context";
import { FILTER_KEYS } from "@/lib/records/constants";

export const metadata: Metadata = { title: "Accounts" };
export const dynamic = "force-dynamic";

export default async function AccountsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const me = await requireUser();
  if (!can(me.role, "accounts.read")) redirect("/");
  const filters = parseFilters(searchParams);
  const cursor = typeof searchParams.cursor === "string" ? searchParams.cursor : undefined;

  const { page, ctx, industries } = await withScope(me.scope, async (tx) => ({
    page: await listAccounts(tx, me.scope, filters, cursor),
    ctx: await loadRecordContext(tx, me, "account"),
    industries: (await tx.account.findMany({ where: { industry: { not: null } }, select: { industry: true }, distinct: ["industry"], orderBy: { industry: "asc" }, take: 100 })).map((r) => r.industry as string),
  }));

  const rows: AccountListRow[] = page.rows.map((r) => ({ ...r, followUpAt: r.followUpAt ? r.followUpAt.toISOString() : null }));
  const filtered = FILTER_KEYS.some((k) => k !== "sort" && searchParams[k]);
  return (
    <>
      <PageHeader title="Accounts" subtitle="Companies, with every contact on them." icon={<Building2 />} />
      <ListToolbar kind="account" members={ctx.members} views={ctx.views} canShare={can(me.role, "assignments.manage")} industries={industries} />
      <RecordsList
        kind="account" rows={rows} members={ctx.members} accounts={[]} defs={ctx.defs} canReassign={can(me.role, "assignments.manage")}
        nextCursor={page.nextCursor} total={page.total} totalCapped={page.totalCapped} hasCursor={!!cursor} filtered={filtered}
      />
    </>
  );
}
