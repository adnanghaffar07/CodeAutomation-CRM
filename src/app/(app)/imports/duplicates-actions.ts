"use server";
// Duplicates found by an import: list them, and merge a duplicate row's details into the record it matched.
// Only records the caller can see are named or changed (row-level security applies to every query).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { actor, errorMessage, fail, type ActionResult } from "@/lib/records/server";
import { checkRow, mappingFromIndex, type ImportKind } from "@/lib/imports";
import { fillBlanks, keysThatExist } from "@/lib/imports-run";

export type DuplicateRow = {
  id: string;
  rowNumber: number;
  summary: string;
  recordId: string | null;
  recordName: string | null;
  canMerge: boolean;
  message: string | null;
};

export async function importDuplicates(batchId: string): Promise<ActionResult<{ kind: string; rows: DuplicateRow[] }>> {
  try {
    const me = await actor("imports.use");
    if (!z.string().uuid().safeParse(batchId).success) return fail("Invalid request.");
    const out = await withScope(me.scope, async (tx) => {
      const b = await tx.importBatch.findUnique({ where: { id: batchId }, select: { recordType: true } });
      if (!b) return null;
      const rows = await tx.importRow.findMany({
        where: { batchId, outcome: "duplicate" }, orderBy: { rowNumber: "asc" }, take: 500,
        select: { id: true, rowNumber: true, raw: true, message: true, recordId: true },
      });
      const ids = rows.map((r) => r.recordId).filter((x): x is string => !!x);
      const names = new Map<string, string>();
      if (ids.length > 0 && b.recordType === "contact") {
        for (const c of await tx.contact.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } })) names.set(c.id, c.fullName);
      } else if (ids.length > 0) {
        for (const a of await tx.account.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })) names.set(a.id, a.name);
      }
      return {
        kind: b.recordType,
        rows: rows.map((r): DuplicateRow => ({
          id: r.id,
          rowNumber: r.rowNumber,
          summary: ((r.raw as string[]) ?? []).filter(Boolean).slice(0, 4).join(" · "),
          recordId: r.recordId,
          recordName: r.recordId ? names.get(r.recordId) ?? null : null,
          canMerge: !!r.recordId,
          message: r.message,
        })),
      };
    });
    if (!out) return fail("Import not found, or you can't see it.");
    return { ok: true, kind: out.kind, rows: out.rows };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Fills the empty fields of the matched record from this duplicate row. Existing values are never overwritten. */
export async function mergeImportRow(rowId: string): Promise<ActionResult<{ changed: string[] }>> {
  try {
    const me = await actor("imports.use");
    if (!z.string().uuid().safeParse(rowId).success) return fail("Invalid request.");
    type MergeOutcome = { error: string } | { changed: string[] };
    const result: MergeOutcome = await withScope(me.scope, async (tx): Promise<MergeOutcome> => {
      const row = await tx.importRow.findUnique({ where: { id: rowId }, select: { batchId: true, raw: true, outcome: true, recordId: true } });
      if (!row || row.outcome !== "duplicate" || !row.recordId) return { error: "That row can't be merged." };
      const recordId = row.recordId;
      const b = await tx.importBatch.findUnique({ where: { id: row.batchId }, select: { recordType: true, mapping: true, workspaceId: true } });
      if (!b) return { error: "Import not found." };
      const meta = b.mapping as { headers: string[]; mapping: Record<string, number> };
      const mapping = mappingFromIndex(meta.mapping, meta.headers);
      const kind = b.recordType as ImportKind;
      const check = checkRow(kind, meta.headers, row.raw as string[], mapping);
      if (!check.ok) return { error: check.message };
      const changed = await fillBlanks(tx, kind, recordId, check.values, me.scope);
      await tx.importRow.update({
        where: { id: rowId },
        data: changed
          ? { outcome: "updated", message: `Merged: filled empty fields (${changed.join(", ")})`, recordId }
          : { outcome: "duplicate", message: "Merged: nothing empty to fill; existing values kept" },
      });
      if (changed) {
        await tx.importBatch.update({ where: { id: row.batchId }, data: { duplicates: { decrement: 1 }, updated: { increment: 1 } } });
      }
      return { changed: changed ?? [] };
    });
    if ("error" in result) return fail(result.error);
    revalidatePath("/imports");
    return { ok: true, changed: result.changed };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export type PreviewRow = {
  rowNumber: number;
  summary: string;
  status: "new" | "match" | "hidden" | "repeat" | "invalid";
  recordId: string | null;
  recordName: string | null;
  message: string | null;
};

/**
 * Checks every staged row before anything is written (like HANDLL's dedupe preview): new, matches an existing record
 * you can see, matches a record you can't see (no details), repeats an earlier row, or invalid.
 */
export async function previewImport(batchId: string): Promise<ActionResult<{ kind: string; rows: PreviewRow[] }>> {
  try {
    const me = await actor("imports.use");
    if (!z.string().uuid().safeParse(batchId).success) return fail("Invalid request.");
    const result = await withScope(me.scope, async (tx) => {
      const b = await tx.importBatch.findUnique({ where: { id: batchId }, select: { recordType: true, mapping: true } });
      if (!b) return null;
      const kind = b.recordType as ImportKind;
      const meta = b.mapping as { headers: string[]; mapping: Record<string, number> };
      const mapping = mappingFromIndex(meta.mapping, meta.headers);
      const staged = await tx.importRow.findMany({ where: { batchId }, orderBy: { rowNumber: "asc" }, take: 500, select: { rowNumber: true, raw: true } });
      const checks = staged.map((r) => checkRow(kind, meta.headers, r.raw as string[], mapping));
      const keys = checks.map((c) => (c.ok ? c.key : null));
      const wanted = [...new Set(keys.filter((k): k is string => !!k))];

      // Visible matches (row-level security decides what you can see).
      const visible = new Map<string, { id: string; name: string }>();
      if (wanted.length > 0 && kind === "contact") {
        for (const r of await tx.contact.findMany({ where: { email: { in: wanted.map((k) => k.slice(6)) } }, select: { id: true, email: true, fullName: true } })) {
          if (r.email) visible.set(`email:${r.email}`, { id: r.id, name: r.fullName });
        }
      } else if (wanted.length > 0) {
        for (const r of await tx.account.findMany({ where: { domain: { in: wanted.map((k) => k.slice(7)) } }, select: { id: true, domain: true, name: true } })) {
          if (r.domain) visible.set(`domain:${r.domain}`, { id: r.id, name: r.name });
        }
      }
      const hidden = await keysThatExist(kind, wanted);

      const seen = new Set<string>();
      const rows: PreviewRow[] = staged.map((s, i): PreviewRow => {
        const c = checks[i];
        const key = keys[i];
        const summary = ((s.raw as string[]) ?? []).filter(Boolean).slice(0, 4).join(" · ");
        const base = { rowNumber: s.rowNumber, summary, recordId: null, recordName: null };
        if (!c.ok) return { ...base, status: "invalid", message: c.message };
        if (key && seen.has(key)) return { ...base, status: "repeat", message: "Repeats a row earlier in this file." };
        if (key) seen.add(key);
        const hit = key ? visible.get(key) : undefined;
        if (hit) return { ...base, status: "match", recordId: hit.id, recordName: hit.name, message: null };
        if (key && hidden.has(key)) return { ...base, status: "hidden", message: "Matches a record you can't see. Ask a manager to review it." };
        return { ...base, status: "new", message: null };
      });
      return { kind, rows };
    });
    if (!result) return fail("Import not found, or you can't see it.");
    return { ok: true, kind: result.kind, rows: result.rows };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
