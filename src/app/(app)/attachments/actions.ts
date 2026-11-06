"use server";
// File attachments for contacts and accounts. Files live in a private Supabase Storage bucket; the browser
// never reads it directly. Every action loads the parent record with withScope first, so the database's
// visibility rules decide whether the caller may touch its files.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { actor, errorMessage, fail, logActivity, type ActionResult } from "@/lib/records/server";
import { loadAttachments, type AttachmentItem } from "@/lib/records/attachments";
import { ATTACHMENT_BUCKET, SIGNED_URL_SECONDS, canDeleteAttachment, checkUpload, sanitizeFileName, storagePathFor } from "@/lib/attachments";
import type { Tx } from "@/lib/db";
import type { Capability } from "@/lib/permissions";

const typeSchema = z.enum(["contact", "account"]);
const idSchema = z.string().uuid();
const capFor = (t: "contact" | "account"): Capability => (t === "contact" ? "contacts.write" : "accounts.write");

async function recordExists(tx: Tx, t: "contact" | "account", id: string): Promise<boolean> {
  const r = t === "contact"
    ? await tx.contact.findUnique({ where: { id }, select: { id: true } })
    : await tx.account.findUnique({ where: { id }, select: { id: true } });
  return !!r;
}

export async function uploadAttachment(formData: FormData): Promise<ActionResult> {
  let storedPath: string | null = null;
  try {
    const t = typeSchema.safeParse(formData.get("recordType"));
    const id = idSchema.safeParse(formData.get("recordId"));
    const file = formData.get("file");
    if (!t.success || !id.success || !(file instanceof File)) return fail("Invalid request.");
    const me = await actor(capFor(t.data));

    const bytes = new Uint8Array(await file.arrayBuffer());
    const safeName = sanitizeFileName(file.name);
    const check = checkUpload(safeName, bytes.byteLength, bytes.subarray(0, 16));
    if (!check.ok) return fail(check.error);

    const path = storagePathFor(me.workspaceId, t.data, id.data, randomUUID(), safeName);
    // Prove the caller may see the record before anything is stored.
    const visible = await withScope(me.scope, (tx) => recordExists(tx, t.data, id.data));
    if (!visible) return fail("Record not found, or you can't see it.");

    const storage = createAdminSupabase().storage.from(ATTACHMENT_BUCKET);
    const up = await storage.upload(path, bytes, { contentType: check.mime, upsert: false });
    if (up.error) return fail("Could not store the file. Try again.");
    storedPath = path;

    await withScope(me.scope, async (tx) => {
      await tx.attachment.create({
        data: { workspaceId: me.workspaceId, recordType: t.data, recordId: id.data, fileName: safeName, mimeType: check.mime, sizeBytes: bytes.byteLength, storagePath: path, uploadedById: me.userId },
      });
      await logActivity(tx, me, [{ recordType: t.data, recordId: id.data, kind: "system", summary: `Attached file: ${safeName}` }]);
    });
    storedPath = null;
    revalidatePath(`/${t.data}s/${id.data}`);
    return { ok: true };
  } catch (e) {
    if (storedPath) await createAdminSupabase().storage.from(ATTACHMENT_BUCKET).remove([storedPath]).catch(() => undefined);
    return fail(errorMessage(e));
  }
}

export async function listAttachments(recordType: "contact" | "account", recordId: string): Promise<ActionResult<{ items: AttachmentItem[] }>> {
  try {
    const t = typeSchema.safeParse(recordType);
    if (!t.success || !idSchema.safeParse(recordId).success) return fail("Invalid request.");
    const me = await actor(t.data === "contact" ? "contacts.read" : "accounts.read");
    const items = await withScope(me.scope, async (tx) => ((await recordExists(tx, t.data, recordId)) ? loadAttachments(tx, t.data, recordId) : null));
    if (!items) return fail("Record not found, or you can't see it.");
    return { ok: true, items };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function downloadAttachment(attachmentId: string): Promise<ActionResult<{ url: string }>> {
  try {
    if (!idSchema.safeParse(attachmentId).success) return fail("Invalid request.");
    const me = await actor("contacts.read");
    const row = await withScope(me.scope, async (tx) => {
      const a = await tx.attachment.findUnique({ where: { id: attachmentId } });
      if (!a) return null;
      const rt = a.recordType === "contact" || a.recordType === "account" ? a.recordType : null;
      if (!rt || !(await recordExists(tx, rt, a.recordId))) return null; // the parent record decides
      return a;
    });
    if (!row) return fail("File not found, or you can't see it.");
    const { data, error } = await createAdminSupabase().storage.from(ATTACHMENT_BUCKET).createSignedUrl(row.storagePath, SIGNED_URL_SECONDS, { download: row.fileName });
    if (error || !data) return fail("Could not prepare the download.");
    return { ok: true, url: data.signedUrl };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteAttachment(attachmentId: string): Promise<ActionResult> {
  try {
    if (!idSchema.safeParse(attachmentId).success) return fail("Invalid request.");
    const me = await actor("contacts.write");
    const info = await withScope(me.scope, async (tx) => {
      const a = await tx.attachment.findUnique({ where: { id: attachmentId } });
      if (!a || (a.recordType !== "contact" && a.recordType !== "account")) return null;
      if (!canDeleteAttachment(me.role, me.userId, a.uploadedById)) throw new Error("Only the person who uploaded a file, a manager or the CEO/Admin can delete it.");
      const gone = await tx.attachment.deleteMany({ where: { id: a.id } });
      if (gone.count === 0) throw new Error("You can't delete that file.");
      await logActivity(tx, me, [{ recordType: a.recordType, recordId: a.recordId, kind: "system", summary: `Removed file: ${a.fileName}` }]);
      return { storagePath: a.storagePath, recordType: a.recordType, recordId: a.recordId };
    });
    if (!info) return fail("File not found, or you can't see it.");
    await createAdminSupabase().storage.from(ATTACHMENT_BUCKET).remove([info.storagePath]).catch(() => undefined);
    revalidatePath(`/${info.recordType}s/${info.recordId}`);
    return { ok: true };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
