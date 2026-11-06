// Import logic (SPEC R-8.6). Runs inside the upload request; the file size is capped in imports.ts.
// Each page is handled with a few bulk queries (not one set of queries per row), so a page finishes well inside
// the database transaction limit even when the database is far away.
// Rows are applied under the UPLOADER's own scope, so row-level security decides what a duplicate check or an
// update can see. A duplicate the uploader cannot see is reported only as "duplicate", never with whose record it is.
import { randomUUID } from "node:crypto";
import { withScope, withSystem, type Scope } from "@/lib/scope";
import { checkRow, DUPLICATE_MESSAGE, mappingFromIndex, type ImportKind, type RowResult } from "@/lib/imports";
import { searchBlob, normEmail } from "@/lib/records/text";
import type { Prisma } from "@prisma/client";

const PAGE = 500;

export type Tx = Prisma.TransactionClient;
export type Values = Record<string, unknown>;
export type Who = Scope & { email: string };
type Out = { id: string; outcome: string; message: string | null; recordId: string | null };

/** Who applies the import: the uploader, with their role as of now. Null if they are no longer an active member. */
async function uploaderScope(workspaceId: string, userId: string): Promise<Who | null> {
  const m = await withSystem((tx) => tx.workspaceMember.findFirst({
    where: { workspaceId, userId, status: "active" }, select: { role: true, email: true },
  }));
  return m ? { userId, workspaceId, role: m.role, email: m.email } : null;
}

/** `decisions` is keyed by file row number: "merge" fills the matched record's empty fields; anything else skips it. */
export async function runImportBatch(batchId: string, decisions: Record<string, "merge" | "skip"> = {}): Promise<void> {
  const batch = await withSystem((tx) => tx.importBatch.findUnique({ where: { id: batchId } }));
  if (!batch) throw new Error("Import not found");
  const scope = await uploaderScope(batch.workspaceId, batch.uploadedById);
  if (!scope) {
    await withSystem((tx) => tx.importBatch.update({ where: { id: batchId }, data: { status: "failed", finishedAt: new Date() } }));
    throw new Error("The person who started this import no longer has access.");
  }
  const kind = batch.recordType as ImportKind;
  const meta = batch.mapping as { headers: string[]; mapping: Record<string, number> };
  const mapping = mappingFromIndex(meta.mapping, meta.headers);
  const duplicateMode = batch.duplicateMode === "fill_blanks" ? "fill_blanks" : "skip";
  await withSystem((tx) => tx.importBatch.update({ where: { id: batchId }, data: { status: "running" } }));

  // Keys already seen in this file (for "duplicate within the upload"). Kept across pages.
  const seen = new Set<string>();

  for (;;) {
    const page = await withSystem((tx) => tx.importRow.findMany({
      where: { batchId, outcome: "pending" }, orderBy: { rowNumber: "asc" }, take: PAGE, select: { id: true, rowNumber: true, raw: true },
    }));
    if (page.length === 0) break;
    const checks = page.map((p) => checkRow(kind, meta.headers, p.raw as string[], mapping));
    const keys = checks.map((c) => (c.ok ? c.key : null));
    // Looked up before the page transaction opens, so the two never run at the same time.
    const hiddenKeys = await keysThatExist(kind, keys.filter((k): k is string => !!k));

    await withScope(scope, async (tx) => {
      const outcomes = await applyPage(tx, kind, scope, duplicateMode, page.map((p) => p.id), page.map((p) => p.rowNumber), decisions, checks, keys, hiddenKeys, seen, batch.id);
      await tx.importBatch.update({
        where: { id: batchId },
        data: {
          accepted: { increment: outcomes.filter((o) => o.outcome === "created").length },
          updated: { increment: outcomes.filter((o) => o.outcome === "updated").length },
          duplicates: { increment: outcomes.filter((o) => o.outcome === "duplicate").length },
          rejected: { increment: outcomes.filter((o) => o.outcome === "rejected").length },
        },
      });
      await markRows(tx, page.map((p) => p.id), outcomes);
    });
  }

  await withSystem((tx) => tx.importBatch.update({ where: { id: batchId }, data: { status: "done", finishedAt: new Date() } }));
}

/** Decides every row of one page, then writes the new records with bulk inserts. */
async function applyPage(
  tx: Tx, kind: ImportKind, scope: Who, duplicateMode: string, pageIds: string[], pageNums: number[],
  decisions: Record<string, "merge" | "skip">, checks: RowResult[], keys: (string | null)[],
  hiddenKeys: Set<string>, seen: Set<string>, batchId: string,
): Promise<Out[]> {
  // 1. Records the uploader can see that match a key (one query).
  const wanted = [...new Set(keys.filter((k): k is string => !!k))];
  const visible = new Map<string, string>();
  if (wanted.length > 0 && kind === "contact") {
    const rows = await tx.contact.findMany({ where: { email: { in: wanted.map((k) => k.slice(6)) } }, select: { id: true, email: true } });
    for (const r of rows) if (r.email) visible.set(`email:${r.email}`, r.id);
  } else if (wanted.length > 0) {
    const rows = await tx.account.findMany({ where: { domain: { in: wanted.map((k) => k.slice(7)) } }, select: { id: true, domain: true } });
    for (const r of rows) if (r.domain) visible.set(`domain:${r.domain}`, r.id);
  }

  // 2. Companies named in the file (one query, case-insensitive).
  const companyIds = new Map<string, string>();
  if (kind === "contact") {
    const names = [...new Set(checks.map((c) => (c.ok && typeof c.values.companyName === "string" ? c.values.companyName.trim().toLowerCase() : "")).filter(Boolean))];
    if (names.length > 0) {
      const rows = await tx.$queryRaw<{ id: string; lname: string }[]>`
        select id, lower(name) as lname from "Account" where lower(name) = any(${names}::text[])`;
      for (const r of rows) if (!companyIds.has(r.lname)) companyIds.set(r.lname, r.id);
    }
  }

  // 3. Decide each row.
  const out: Out[] = [];
  const toContacts: { id: string; v: Values; company: string | null }[] = [];
  // Companies named in the file that do not exist yet: each becomes one account (lower-case name -> new account).
  const newCompanies = new Map<string, { id: string; name: string }>();
  const toAccounts: { id: string; v: Values }[] = [];
  for (let i = 0; i < checks.length; i++) {
    const c = checks[i];
    const key = keys[i];
    if (!c.ok) { out.push({ id: pageIds[i], outcome: "rejected", message: c.message, recordId: null }); continue; }
    if (key && seen.has(key)) { out.push({ id: pageIds[i], outcome: "duplicate", message: "Duplicate: appears earlier in this file.", recordId: null }); continue; }
    if (key) seen.add(key);

    const existingId = key ? visible.get(key) : undefined;
    if (existingId) {
      const decided = decisions[String(pageNums[i])];
      const merge = decided ? decided === "merge" : duplicateMode === "fill_blanks";
      if (merge) {
        const changed = await fillBlanks(tx, kind, existingId, c.values, scope);
        out.push({ id: pageIds[i], outcome: changed ? "updated" : "duplicate", message: changed ? `Filled empty fields: ${changed.join(", ")}` : DUPLICATE_MESSAGE, recordId: existingId });
      } else {
        out.push({ id: pageIds[i], outcome: "duplicate", message: DUPLICATE_MESSAGE, recordId: existingId });
      }
      continue;
    }

    // A record exists that the uploader cannot see: report it as a duplicate without saying anything more.
    if (key && hiddenKeys.has(key)) {
      out.push({ id: pageIds[i], outcome: "duplicate", message: DUPLICATE_MESSAGE, recordId: null });
      continue;
    }

    const id = randomUUID();
    if (kind === "contact") {
      const name = typeof c.values.companyName === "string" ? c.values.companyName.trim() : "";
      const lower = name.toLowerCase();
      if (lower && !companyIds.has(lower) && !newCompanies.has(lower)) newCompanies.set(lower, { id: randomUUID(), name });
      toContacts.push({ id, v: c.values, company: lower || null });
    } else {
      toAccounts.push({ id, v: c.values });
    }
    out.push({ id: pageIds[i], outcome: "created", message: null, recordId: id });
  }

  // 4. Bulk inserts, each with its timeline entry.
  if (newCompanies.size > 0) {
    const accs = [...newCompanies.values()];
    await tx.account.createMany({
      data: accs.map((a) => ({
        id: a.id, workspaceId: scope.workspaceId, createdById: scope.userId, ownerId: scope.userId, assigneeIds: [], tags: [],
        importBatchId: batchId, name: a.name, source: "import", searchText: searchBlob([a.name]),
      })),
    });
    await tx.activity.createMany({
      data: accs.map((a) => ({
        workspaceId: scope.workspaceId, recordType: "account", recordId: a.id, kind: "system", source: "system",
        summary: "Account created from a contact import", actorId: scope.userId, actorEmail: scope.email,
      })),
    });
    for (const [lower, a] of newCompanies) companyIds.set(lower, a.id);
  }
  if (toContacts.length > 0) {
    await tx.contact.createMany({
      data: toContacts.map(({ id, v, company: companyKey }) => {
        const accountId = companyKey ? companyIds.get(companyKey) ?? null : null;
        const fullName = String(v.fullName);
        const company = typeof v.companyName === "string" ? v.companyName.trim() : "";
        return {
          id, workspaceId: scope.workspaceId, createdById: scope.userId, ownerId: scope.userId, assigneeIds: [], tags: [], importBatchId: batchId,
          firstName: String(v.firstName), lastName: String(v.lastName ?? ""), fullName, email: normEmail(v.email as string | null),
          phone: (v.phone as string) ?? null, jobTitle: (v.jobTitle as string) ?? null, linkedinUrl: (v.linkedinUrl as string) ?? null,
          city: (v.city as string) ?? null, region: (v.region as string) ?? null, country: (v.country as string) ?? null,
          source: (v.source as string) ?? "import", serviceInterest: (v.serviceInterest as string) ?? null, accountId,
          searchText: searchBlob([fullName, v.email as string, v.jobTitle as string, company, v.city as string, v.country as string]),
        };
      }),
    });
    await tx.activity.createMany({
      data: toContacts.map(({ id }) => ({
        workspaceId: scope.workspaceId, recordType: "contact", recordId: id, kind: "system", source: "system",
        summary: "Contact imported", actorId: scope.userId, actorEmail: scope.email,
      })),
    });
  }
  if (toAccounts.length > 0) {
    await tx.account.createMany({
      data: toAccounts.map(({ id, v }) => ({
        id, workspaceId: scope.workspaceId, createdById: scope.userId, ownerId: scope.userId, assigneeIds: [], tags: [], importBatchId: batchId,
        name: String(v.name), domain: (v.domain as string) ?? null, website: (v.website as string) ?? null, industry: (v.industry as string) ?? null,
        sizeBand: (v.sizeBand as string) ?? null, city: (v.city as string) ?? null, region: (v.region as string) ?? null, country: (v.country as string) ?? null,
        phone: (v.phone as string) ?? null, linkedinUrl: (v.linkedinUrl as string) ?? null, source: (v.source as string) ?? "import",
        searchText: searchBlob([String(v.name), v.domain as string, v.industry as string, v.city as string, v.country as string]),
      })),
    });
    await tx.activity.createMany({
      data: toAccounts.map(({ id }) => ({
        workspaceId: scope.workspaceId, recordType: "account", recordId: id, kind: "system", source: "system",
        summary: "Account imported", actorId: scope.userId, actorEmail: scope.email,
      })),
    });
  }
  return out;
}

/** Writes the outcome of every row of the page in one statement. */
async function markRows(tx: Tx, ids: string[], outcomes: Out[]): Promise<void> {
  if (outcomes.length === 0) return;
  await tx.$executeRaw`
    update "ImportRow" r set outcome = v.outcome, message = v.message, "recordId" = v.rid::uuid
    from unnest(${ids}::uuid[], ${outcomes.map((o) => o.outcome)}::text[], ${outcomes.map((o) => o.message)}::text[], ${outcomes.map((o) => o.recordId)}::text[]) as v(id, outcome, message, rid)
    where r.id = v.id`;
}

/** Which of these keys already exist anywhere in the workspace. Returns only keys, never record details (SPEC R-8.9). */
export async function keysThatExist(kind: ImportKind, keys: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (keys.length === 0) return out;
  if (kind === "contact") {
    const rows = await withSystem((tx) => tx.contact.findMany({ where: { email: { in: keys.map((k) => k.slice(6)) } }, select: { email: true } }));
    for (const r of rows) if (r.email) out.add(`email:${r.email}`);
  } else {
    const rows = await withSystem((tx) => tx.account.findMany({ where: { domain: { in: keys.map((k) => k.slice(7)) } }, select: { domain: true } }));
    for (const r of rows) if (r.domain) out.add(`domain:${r.domain}`);
  }
  return out;
}

/** Fills only the empty fields of an existing record from the file's values. Returns the fields changed, or null. */
export async function fillBlanks(tx: Tx, kind: ImportKind, id: string, v: Values, scope: Who): Promise<string[] | null> {
  const fields = kind === "contact"
    ? ["phone", "jobTitle", "linkedinUrl", "city", "region", "country", "source", "serviceInterest"]
    : ["website", "industry", "sizeBand", "city", "region", "country", "phone", "linkedinUrl", "source"];
  const current = (kind === "contact"
    ? await tx.contact.findUnique({ where: { id }, select: { phone: true, jobTitle: true, linkedinUrl: true, city: true, region: true, country: true, source: true, serviceInterest: true } })
    : await tx.account.findUnique({ where: { id }, select: { website: true, industry: true, sizeBand: true, city: true, region: true, country: true, phone: true, linkedinUrl: true, source: true } })) as Record<string, unknown> | null;
  if (!current) return null;
  const data: Record<string, unknown> = {};
  for (const f of fields) if ((current[f] === null || current[f] === "") && v[f]) data[f] = v[f];
  const changed = Object.keys(data);
  if (changed.length === 0) return null;
  if (kind === "contact") await tx.contact.update({ where: { id }, data });
  else await tx.account.update({ where: { id }, data });
  await tx.activity.create({
    data: {
      workspaceId: scope.workspaceId, recordType: kind, recordId: id, kind: "change", source: "manual",
      summary: `Import filled empty fields: ${changed.join(", ")}`, actorId: scope.userId, actorEmail: scope.email,
    },
  });
  return changed;
}
