"use server";
// Import wizard actions. The browser parses the CSV and sends rows in chunks (each well under the 4.5 MB request
// limit), then startImport applies them in the same request. Every call runs under the caller's scope.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { actor, errorMessage, fail, type ActionResult } from "@/lib/records/server";
import { IMPORT_FIELDS, MAX_IMPORT_ROWS, type ImportKind } from "@/lib/imports";
import { runImportBatch } from "@/lib/imports-run";

const MAX_CHUNK = 1000;
const MAX_COLS = 80;

const createSchema = z.object({
  kind: z.enum(["contact", "account"]),
  fileName: z.string().trim().min(1).max(200),
  headers: z.array(z.string().max(200)).min(1).max(MAX_COLS),
  mapping: z.record(z.string(), z.number().int().min(0).max(MAX_COLS)),
  duplicateMode: z.enum(["skip", "fill_blanks"]),
  totalRows: z.number().int().min(1).max(MAX_IMPORT_ROWS),
});

export async function createImportBatch(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await actor("imports.use");
    const p = createSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the import settings.");
    const v = p.data;
    const allowed = Object.keys(IMPORT_FIELDS[v.kind as ImportKind]);
    const bad = Object.keys(v.mapping).find((f) => !allowed.includes(f));
    if (bad) return fail(`Unknown field: ${bad}`);
    const required = v.kind === "contact" ? ["email", "fullName", "firstName"] : ["name"];
    if (!required.some((f) => f in v.mapping)) {
      return fail(v.kind === "contact" ? "Map an Email, Full name or First name column." : "Map a Company name column.");
    }
    const id = await withScope(me.scope, async (tx) => {
      const b = await tx.importBatch.create({
        data: {
          workspaceId: me.workspaceId, recordType: v.kind, fileName: v.fileName, uploadedById: me.userId,
          mapping: { headers: v.headers, mapping: v.mapping }, duplicateMode: v.duplicateMode, totalRows: v.totalRows,
        },
        select: { id: true },
      });
      return b.id;
    });
    return { ok: true, id };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const stageSchema = z.object({
  batchId: z.string().uuid(),
  startRow: z.number().int().min(1),
  rows: z.array(z.array(z.string().max(2000)).max(MAX_COLS)).min(1).max(MAX_CHUNK),
});

export async function stageImportRows(input: z.input<typeof stageSchema>): Promise<ActionResult<{ staged: number }>> {
  try {
    const me = await actor("imports.use");
    const p = stageSchema.safeParse(input);
    if (!p.success) return fail("Could not read those rows. Try a smaller file.");
    const { batchId, startRow, rows } = p.data;
    const staged = await withScope(me.scope, async (tx) => {
      const b = await tx.importBatch.findUnique({ where: { id: batchId }, select: { status: true, uploadedById: true } });
      if (!b || b.uploadedById !== me.userId) throw new Error("That import isn't open for changes.");
      if (b.status !== "staging") throw new Error("That import has already been queued.");
      await tx.importRow.createMany({
        data: rows.map((raw, i) => ({ workspaceId: me.workspaceId, batchId, rowNumber: startRow + i, raw })),
      });
      return rows.length;
    });
    return { ok: true, staged };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Ends staging and applies the rows now, in this request. Small files only (see MAX_IMPORT_ROWS). */
export async function startImport(batchId: string, decisions: Record<string, "merge" | "skip"> = {}): Promise<ActionResult> {
  try {
    const me = await actor("imports.use");
    if (!z.string().uuid().safeParse(batchId).success) return fail("Invalid request.");
    if (!z.record(z.string().regex(/^\d+$/), z.enum(["merge", "skip"])).safeParse(decisions).success) return fail("Invalid choices.");
    await withScope(me.scope, async (tx) => {
      const b = await tx.importBatch.findUnique({ where: { id: batchId }, select: { status: true, uploadedById: true, _count: { select: { rows: true } } } });
      if (!b || b.uploadedById !== me.userId) throw new Error("That import isn't open for changes.");
      if (b.status !== "staging") throw new Error("That import has already been run.");
      if (b._count.rows === 0) throw new Error("No rows were received.");
      await tx.importBatch.update({ where: { id: batchId }, data: { status: "queued" } });
    });
    await runImportBatch(batchId, decisions);
    revalidatePath("/imports");
    return { ok: true };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export type ImportStatus = {
  id: string; fileName: string; recordType: string; status: string; totalRows: number;
  accepted: number; rejected: number; duplicates: number; updated: number; finished: boolean; createdAt: string;
};

export async function importStatus(batchId: string): Promise<ActionResult<{ batch: ImportStatus }>> {
  try {
    const me = await actor("imports.use");
    const b = await withScope(me.scope, (tx) => tx.importBatch.findUnique({ where: { id: batchId } }));
    if (!b) return fail("Import not found, or you can't see it.");
    return {
      ok: true,
      batch: {
        id: b.id, fileName: b.fileName, recordType: b.recordType, status: b.status, totalRows: b.totalRows, accepted: b.accepted,
        rejected: b.rejected, duplicates: b.duplicates, updated: b.updated, finished: b.status === "done" || b.status === "failed", createdAt: b.createdAt.toISOString(),
      },
    };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Rows that were rejected or skipped as duplicates, as CSV text (SPEC R-8.8). Only the uploader and managers can read it. */
export async function importErrorReport(batchId: string): Promise<ActionResult<{ csv: string; fileName: string }>> {
  try {
    const me = await actor("imports.use");
    const result = await withScope(me.scope, async (tx) => {
      const b = await tx.importBatch.findUnique({ where: { id: batchId }, select: { fileName: true, mapping: true } });
      if (!b) return null;
      const rows = await tx.importRow.findMany({
        where: { batchId, outcome: { in: ["rejected", "duplicate"] } }, orderBy: { rowNumber: "asc" }, take: 50_000,
        select: { rowNumber: true, outcome: true, message: true, raw: true },
      });
      return { fileName: b.fileName, headers: (b.mapping as { headers: string[] }).headers, rows };
    });
    if (!result) return fail("Import not found, or you can't see it.");
    const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const lines = [["Row", "Result", "Reason", ...result.headers].map(esc).join(",")];
    for (const r of result.rows) lines.push([r.rowNumber, r.outcome, r.message, ...((r.raw as string[]) ?? [])].map(esc).join(","));
    return { ok: true, csv: lines.join("\r\n"), fileName: `errors-${result.fileName.replace(/\.csv$/i, "")}.csv` };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
