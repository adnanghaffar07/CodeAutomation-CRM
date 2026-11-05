// The small lookups every record screen needs: who can be an owner, which custom fields exist, saved views, account choices.
import type { Tx } from "@/lib/db";
import type { CurrentUser } from "@/lib/session";
import type { EntityKind } from "@/lib/records/constants";
import type { MemberLite } from "@/components/records/bits";
import type { AccountOption, CustomFieldDefLite } from "@/components/records/record-forms";
import type { ViewRow } from "@/components/records/list-toolbar";

export type RecordContext = { members: MemberLite[]; defs: CustomFieldDefLite[]; views: ViewRow[]; accounts: AccountOption[] };

/** Everything is read inside the caller's scope. Account choices are capped; a searchable picker replaces the cap at larger sizes. */
export async function loadRecordContext(tx: Tx, me: CurrentUser, kind: EntityKind, opts: { withAccounts?: boolean } = {}): Promise<RecordContext> {
  const [members, defs, views, accounts] = await Promise.all([
    tx.workspaceMember.findMany({ where: { status: "active" }, select: { userId: true, fullName: true }, orderBy: { fullName: "asc" } }),
    tx.customFieldDef.findMany({ where: { entity: kind }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    tx.savedView.findMany({ where: { entity: kind }, orderBy: { name: "asc" } }),
    opts.withAccounts ? tx.account.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }) : Promise.resolve([]),
  ]);
  return {
    members,
    defs: defs.map((d) => ({ key: d.key, label: d.label, type: d.type, options: d.options })),
    views: views.map((v) => ({
      id: v.id, name: v.name, sort: v.sort, shared: v.shared, mine: v.ownerId === me.userId,
      filters: Object.fromEntries(Object.entries((v.filters ?? {}) as Record<string, unknown>).map(([k, x]) => [k, String(x)])),
    })),
    accounts,
  };
}
