// Background import worker logic (SPEC R-8.6). Runs one queued job at a time.
// Each row is applied under the UPLOADER's own scope, so row-level security decides what a duplicate check or an
// update can see. A duplicate the uploader cannot see is reported only as "duplicate", never with whose record it is.
import { withScope, withSystem, type Scope } from "@/lib/scope";
import { checkRow, DUPLICATE_MESSAGE, mappingFromIndex, type ImportKind } from "@/lib/imports";
import { searchBlob, normEmail } from "@/lib/records/text";
import type { Prisma } from "@prisma/client";

const PAGE = 500;

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "P2002";

/** Claims the oldest due job (SKIP LOCKED, so several workers never take the same one) and returns its id. */
export async function claimJob(): Promise<{ id: string; kind: string; payload: Record<string, unknown> } | null> {
  return withSystem(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; kind: string; payload: Record<string, unknown> }[]>`
      select id, kind, payload from "Job" where status = 'queued' and "runAt" <= now()
      order by "runAt" asc limit 1 for update skip locked`;
    const job = rows[0];
    if (!job) return null;
    await tx.job.update({ where: { id: job.id }, data: { status: "running", attempts: { increment: 1 } } });
    return job;
  });
}

export async function finishJob(id: string, error?: string) {
  await withSystem((tx) => tx.job.update({
    where: { id },
    data: error ? { status: "failed", lastError: error.slice(0, 500), finishedAt: new Date() } : { status: "done", finishedAt: new Date() },
  }));
}

/** Who applies the import: the uploader, with their role as of now. Null if they are no longer an active member. */
async function uploaderScope(workspaceId: string, userId: string): Promise<(Scope & { email: string }) | null> {
  const m = await withSystem((tx) => tx.workspaceMember.findFirst({
    where: { workspaceId, userId, status: "active" }, select: { role: true, email: true },
  }));
  return m ? { userId, workspaceId, role: m.role, email: m.email } : null;
}

export async function runImportBatch(batchId: string): Promise<void> {
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
    const raws = page.map((p) => p.raw as string[]);
    const checks = raws.map((r) => checkRow(kind, meta.headers, r, mapping));
    const keys = checks.map((c) => (c.ok ? c.key : null));

    const outcomes = await withScope(scope, async (tx) => {
      const out: { id: string; outcome: string; message: string | null; recordId: string | null }[] = [];
      for (let i = 0; i < page.length; i++) {
        const c = checks[i];
        const row = page[i];
        const key = keys[i];
        if (!c.ok) { out.push({ id: row.id, outcome: "rejected", message: c.message, recordId: null }); continue; }
        if (key && seen.has(key)) { out.push({ id: row.id, outcome: "duplicate", message: "Duplicate: appears earlier in this file.", recordId: null }); continue; }
        if (key) seen.add(key);

        // Visible-only lookup: a record the uploader cannot see is not returned here.
        const existing = key ? await findVisible(tx, kind, c.values, key) : null;
        if (existing) {
          if (duplicateMode === "fill_blanks") {
            const changed = await fillBlanks(tx, kind, existing.id, c.values, scope);
            out.push({ id: row.id, outcome: changed ? "updated" : "duplicate", message: changed ? `Filled empty fields: ${changed.join(", ")}` : DUPLICATE_MESSAGE, recordId: existing.id });
          } else {
            out.push({ id: row.id, outcome: "duplicate", message: DUPLICATE_MESSAGE, recordId: existing.id });
          }
          continue;
        }

        // A record exists that the uploader cannot see: report it as a duplicate without saying anything more.
        if (key && await existsHidden(kind, key)) {
          out.push({ id: row.id, outcome: "duplicate", message: DUPLICATE_MESSAGE, recordId: null });
          continue;
        }

        try {
          const id = await create(tx, kind, c.values, scope, batch.id);
          out.push({ id: row.id, outcome: "created", message: null, recordId: id });
        } catch (e) {
          if (isUniqueViolation(e)) out.push({ id: row.id, outcome: "duplicate", message: DUPLICATE_MESSAGE, recordId: null });
          else out.push({ id: row.id, outcome: "rejected", message: "Could not save this row.", recordId: null });
        }
      }
      return out;
    });

    await withSystem(async (tx) => {
      for (const o of outcomes) {
        await tx.importRow.update({ where: { id: o.id }, data: { outcome: o.outcome, message: o.message, recordId: o.recordId } });
      }
      await tx.importBatch.update({
        where: { id: batchId },
        data: { accepted: { increment: outcomes.filter((o) => o.outcome === "created").length }, updated: { increment: outcomes.filter((o) => o.outcome === "updated").length },
          duplicates: { increment: outcomes.filter((o) => o.outcome === "duplicate").length }, rejected: { increment: outcomes.filter((o) => o.outcome === "rejected").length } },
      });
    });
  }

  await withSystem((tx) => tx.importBatch.update({ where: { id: batchId }, data: { status: "done", finishedAt: new Date() } }));
}

type Tx = Prisma.TransactionClient;
type Values = Record<string, unknown>;

async function findVisible(tx: Tx, kind: ImportKind, v: Values, key: string): Promise<{ id: string } | null> {
  if (kind === "contact") {
    return tx.contact.findFirst({ where: { email: key.slice(6) }, select: { id: true } });
  }
  return tx.account.findFirst({ where: { domain: key.slice(7) }, select: { id: true } });
}

/** Only tells whether a record exists at all, never its details (SPEC R-8.9). Runs as the system, returns a boolean. */
async function existsHidden(kind: ImportKind, key: string): Promise<boolean> {
  const n = await withSystem((tx) => kind === "contact"
    ? tx.contact.count({ where: { email: key.slice(6) } })
    : tx.account.count({ where: { domain: key.slice(7) } }));
  return n > 0;
}

async function fillBlanks(tx: Tx, kind: ImportKind, id: string, v: Values, scope: Scope & { email: string }): Promise<string[] | null> {
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

async function create(tx: Tx, kind: ImportKind, v: Values, scope: Scope & { email: string }, batchId: string): Promise<string> {
  if (kind === "contact") {
    let accountId: string | null = null;
    const company = typeof v.companyName === "string" ? v.companyName.trim() : "";
    if (company) {
      const acc = await tx.account.findFirst({ where: { name: { equals: company, mode: "insensitive" } }, select: { id: true } });
      accountId = acc?.id ?? null;
    }
    const fullName = String(v.fullName);
    const c = await tx.contact.create({
      data: {
        workspaceId: scope.workspaceId, createdById: scope.userId, ownerId: scope.userId, assigneeIds: [], importBatchId: batchId,
        firstName: String(v.firstName), lastName: String(v.lastName ?? ""), fullName, email: normEmail(v.email as string | null),
        phone: (v.phone as string) ?? null, jobTitle: (v.jobTitle as string) ?? null, linkedinUrl: (v.linkedinUrl as string) ?? null,
        city: (v.city as string) ?? null, region: (v.region as string) ?? null, country: (v.country as string) ?? null,
        source: (v.source as string) ?? "import", serviceInterest: (v.serviceInterest as string) ?? null, accountId,
        searchText: searchBlob([fullName, v.email as string, v.jobTitle as string, company, v.city as string, v.country as string]),
      },
      select: { id: true },
    });
    await tx.activity.create({ data: { workspaceId: scope.workspaceId, recordType: "contact", recordId: c.id, kind: "system", source: "system", summary: "Contact imported", actorId: scope.userId, actorEmail: scope.email } });
    return c.id;
  }
  const a = await tx.account.create({
    data: {
      workspaceId: scope.workspaceId, createdById: scope.userId, ownerId: scope.userId, assigneeIds: [], importBatchId: batchId,
      name: String(v.name), domain: (v.domain as string) ?? null, website: (v.website as string) ?? null, industry: (v.industry as string) ?? null,
      sizeBand: (v.sizeBand as string) ?? null, city: (v.city as string) ?? null, region: (v.region as string) ?? null, country: (v.country as string) ?? null,
      phone: (v.phone as string) ?? null, linkedinUrl: (v.linkedinUrl as string) ?? null, source: (v.source as string) ?? "import",
      searchText: searchBlob([String(v.name), v.domain as string, v.industry as string, v.city as string, v.country as string]),
    },
    select: { id: true },
  });
  await tx.activity.create({ data: { workspaceId: scope.workspaceId, recordType: "account", recordId: a.id, kind: "system", source: "system", summary: "Account imported", actorId: scope.userId, actorEmail: scope.email } });
  return a.id;
}
