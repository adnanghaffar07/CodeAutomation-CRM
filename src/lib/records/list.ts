// Server-side lists for contacts and accounts: filters, search and keyset pagination.
//
// Keyset ("seek") pagination: a page is "the next 50 after this (sort value, id)". It never uses OFFSET, so page
// 1,000 costs the same as page 1. Row-level security still applies to every statement (the transaction runs
// inside withScope), so a Sales user's list only ever contains their own records.
import { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import type { Scope } from "@/lib/scope";
import { COUNT_CAP, PAGE_SIZE, type EntityKind, type ListFilters } from "@/lib/records/constants";
import { escapeLike, searchTokens } from "@/lib/records/text";

export type ContactRow = {
  id: string;
  fullName: string;
  email: string | null;
  emailStatus: string;
  jobTitle: string | null;
  accountId: string | null;
  accountName: string | null;
  ownerId: string | null;
  qualification: string;
  tags: string[];
  followUpAt: Date | null;
  createdAt: Date;
};

export type AccountRow = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  sizeBand: string | null;
  ownerId: string | null;
  qualification: string;
  tags: string[];
  followUpAt: Date | null;
  createdAt: Date;
  contactCount: number;
};

export type Page<T> = { rows: T[]; nextCursor: string | null; total: number | null; totalCapped: boolean };

type Cursor = { k: string; id: string };
const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decode(raw?: string): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return typeof c?.k === "string" && typeof c?.id === "string" ? c : null;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The WHERE conditions shared by both lists. `t` is the table alias. */
function conditions(kind: EntityKind, f: ListFilters, scope: Scope): Prisma.Sql[] {
  const c: Prisma.Sql[] = [Prisma.sql`t."workspaceId" = ${scope.workspaceId}::uuid`];
  for (const token of searchTokens(f.q)) c.push(Prisma.sql`t."searchText" ILIKE ${"%" + escapeLike(token) + "%"}`);
  if (f.status) c.push(Prisma.sql`t."qualification" = ${f.status}::"LeadStatus"`);
  if (f.tag) c.push(Prisma.sql`t."tags" @> ARRAY[${f.tag.toLowerCase()}]::text[]`);
  if (f.owner === "me") c.push(Prisma.sql`t."ownerId" = ${scope.userId}::uuid`);
  else if (f.owner === "none") c.push(Prisma.sql`t."ownerId" IS NULL`);
  else if (f.owner && UUID.test(f.owner)) c.push(Prisma.sql`t."ownerId" = ${f.owner}::uuid`);
  if (f.due === "overdue") c.push(Prisma.sql`t."followUpAt" < now()`);
  if (f.due === "week") c.push(Prisma.sql`t."followUpAt" BETWEEN now() AND now() + interval '7 days'`);
  if (f.country) c.push(Prisma.sql`t."country" = ${f.country}`);
  if (kind === "contact") {
    if (f.emailStatus) c.push(Prisma.sql`t."emailStatus" = ${f.emailStatus}::"EmailStatus"`);
    if (f.accountId && UUID.test(f.accountId)) c.push(Prisma.sql`t."accountId" = ${f.accountId}::uuid`);
  } else if (f.industry) {
    c.push(Prisma.sql`t."industry" = ${f.industry}`);
  }
  return c;
}

/** ORDER BY and the "after this row" condition for the chosen sort. */
function ordering(kind: EntityKind, f: ListFilters, cursor: Cursor | null) {
  const nameCol = Prisma.raw(kind === "contact" ? `t."fullName"` : `t."name"`);
  if (f.sort === "name") {
    return {
      order: Prisma.sql`${nameCol} ASC, t.id ASC`,
      after: cursor ? Prisma.sql`(${nameCol}, t.id) > (${cursor.k}, ${cursor.id}::uuid)` : null,
    };
  }
  const desc = f.sort === "newest";
  return {
    order: desc ? Prisma.sql`t."createdAt" DESC, t.id DESC` : Prisma.sql`t."createdAt" ASC, t.id ASC`,
    after: cursor
      ? desc
        ? Prisma.sql`(t."createdAt", t.id) < (${new Date(cursor.k)}, ${cursor.id}::uuid)`
        : Prisma.sql`(t."createdAt", t.id) > (${new Date(cursor.k)}, ${cursor.id}::uuid)`
      : null,
  };
}

function cursorFor(kind: EntityKind, f: ListFilters, row: { id: string; createdAt: Date; fullName?: string; name?: string }): string {
  if (f.sort === "name") return encode({ k: (kind === "contact" ? row.fullName : row.name) ?? "", id: row.id });
  return encode({ k: row.createdAt.toISOString(), id: row.id });
}

async function cappedCount(tx: Tx, kind: EntityKind, where: Prisma.Sql[]): Promise<number> {
  const table = Prisma.raw(kind === "contact" ? `"Contact"` : `"Account"`);
  const res = await tx.$queryRaw<{ n: bigint }[]>(
    Prisma.sql`SELECT count(*) AS n FROM (SELECT 1 FROM ${table} t WHERE ${Prisma.join(where, " AND ")} LIMIT ${COUNT_CAP + 1}) s`,
  );
  return Number(res[0]?.n ?? 0);
}

export async function listContacts(tx: Tx, scope: Scope, f: ListFilters, rawCursor?: string): Promise<Page<ContactRow>> {
  const cursor = decode(rawCursor);
  const where = conditions("contact", f, scope);
  const { order, after } = ordering("contact", f, cursor);
  const rows = await tx.$queryRaw<ContactRow[]>(Prisma.sql`
    SELECT t.id, t."fullName", t.email, t."emailStatus"::text AS "emailStatus", t."jobTitle", t."accountId", a.name AS "accountName",
           t."ownerId", t.qualification::text AS qualification, t.tags, t."followUpAt", t."createdAt"
    FROM "Contact" t
    LEFT JOIN "Account" a ON a.id = t."accountId"
    WHERE ${Prisma.join(after ? [...where, after] : where, " AND ")}
    ORDER BY ${order}
    LIMIT ${PAGE_SIZE + 1}`);
  const more = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const count = cursor ? null : await cappedCount(tx, "contact", where);
  return { rows: page, nextCursor: more ? cursorFor("contact", f, page[page.length - 1]) : null, total: count === null ? null : Math.min(count, COUNT_CAP), totalCapped: (count ?? 0) > COUNT_CAP };
}

export async function listAccounts(tx: Tx, scope: Scope, f: ListFilters, rawCursor?: string): Promise<Page<AccountRow>> {
  const cursor = decode(rawCursor);
  const where = conditions("account", f, scope);
  const { order, after } = ordering("account", f, cursor);
  const rows = await tx.$queryRaw<AccountRow[]>(Prisma.sql`
    SELECT t.id, t.name, t.domain, t.industry, t.country, t."sizeBand", t."ownerId", t.qualification::text AS qualification,
           t.tags, t."followUpAt", t."createdAt",
           (SELECT count(*)::int FROM "Contact" c WHERE c."accountId" = t.id) AS "contactCount"
    FROM "Account" t
    WHERE ${Prisma.join(after ? [...where, after] : where, " AND ")}
    ORDER BY ${order}
    LIMIT ${PAGE_SIZE + 1}`);
  const more = rows.length > PAGE_SIZE;
  const page = rows.slice(0, PAGE_SIZE);
  const count = cursor ? null : await cappedCount(tx, "account", where);
  return { rows: page, nextCursor: more ? cursorFor("account", f, page[page.length - 1]) : null, total: count === null ? null : Math.min(count, COUNT_CAP), totalCapped: (count ?? 0) > COUNT_CAP };
}

/** Parse the URL's search params into filters, ignoring anything unknown or malformed. */
export function parseFilters(sp: Record<string, string | string[] | undefined>): ListFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const pick = <T extends string>(v: string | undefined, allowed: readonly T[]): T | undefined => (allowed as readonly string[]).includes(v ?? "") ? (v as T) : undefined;
  return {
    q: one("q")?.slice(0, 120),
    status: pick(one("status"), ["new", "researching", "contacted", "engaged", "qualified", "disqualified"] as const),
    emailStatus: pick(one("emailStatus"), ["active", "unsubscribed", "do_not_contact", "bounced"] as const),
    owner: one("owner")?.slice(0, 40),
    tag: one("tag")?.slice(0, 60),
    country: one("country")?.slice(0, 60),
    industry: one("industry")?.slice(0, 80),
    accountId: one("accountId"),
    due: pick(one("due"), ["overdue", "week"] as const),
    sort: pick(one("sort"), ["newest", "oldest", "name"] as const) ?? "newest",
  };
}
