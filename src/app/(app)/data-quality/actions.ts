"use server";
// Data quality actions: merge two contacts (managers and the CEO/Admin only). Runs under the caller's scope.
import { revalidatePath } from "next/cache";
import { withScope } from "@/lib/scope";
import { actor, errorMessage, fail, type ActionResult } from "@/lib/records/server";
import { normEmail } from "@/lib/records/text";
import { audit } from "@/lib/audit";

const BLANK_FIELDS = ["phone", "jobTitle", "linkedinUrl", "city", "region", "country", "source", "serviceInterest", "accountId"] as const;

/**
 * Merges the contact with `dropEmail` into the contact with `keepEmail`:
 * empty fields on the kept contact are filled from the dropped one, tags are combined, the timeline and attachments
 * move to the kept contact, and the dropped contact is deleted. Both must be visible to the caller.
 */
export async function mergeContacts(keepEmailInput: string, dropEmailInput: string): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await actor("assignments.manage");
    const keepEmail = normEmail(keepEmailInput);
    const dropEmail = normEmail(dropEmailInput);
    if (!keepEmail || !dropEmail) return fail("Enter the email address of both contacts.");
    if (keepEmail === dropEmail) return fail("Those are the same contact.");

    const keptId = await withScope(me.scope, async (tx) => {
      const [keep, drop] = await Promise.all([
        tx.contact.findFirst({ where: { email: keepEmail } }),
        tx.contact.findFirst({ where: { email: dropEmail } }),
      ]);
      if (!keep) throw new Error("No contact with the first email address, or you can't see it.");
      if (!drop) throw new Error("No contact with the second email address, or you can't see it.");

      const data: Record<string, unknown> = {};
      for (const f of BLANK_FIELDS) {
        const current = (keep as Record<string, unknown>)[f];
        const other = (drop as Record<string, unknown>)[f];
        if ((current === null || current === "") && other) data[f] = other;
      }
      data.tags = [...new Set([...keep.tags, ...drop.tags])].slice(0, 30);
      if (!keep.verifiedAt && drop.verifiedAt) data.verifiedAt = drop.verifiedAt;
      await tx.contact.update({ where: { id: keep.id }, data });

      // The timeline can't be moved (append-only), so its entries are copied to the kept contact.
      const acts = await tx.activity.findMany({ where: { recordType: "contact", recordId: drop.id } });
      if (acts.length > 0) {
        await tx.activity.createMany({
          data: acts.map((a) => ({
            workspaceId: a.workspaceId, recordType: "contact", recordId: keep.id, kind: a.kind, source: a.source,
            summary: a.summary, body: a.body, detail: a.detail ?? undefined, actorId: a.actorId, actorEmail: a.actorEmail,
          })),
        });
      }

      // Attachments: copied to the kept contact by the merging manager, then the originals are removed.
      const files = await tx.attachment.findMany({ where: { recordType: "contact", recordId: drop.id } });
      if (files.length > 0) {
        await tx.attachment.createMany({
          data: files.map((f) => ({
            workspaceId: f.workspaceId, recordType: "contact", recordId: keep.id, fileName: f.fileName, mimeType: f.mimeType,
            sizeBytes: f.sizeBytes, storagePath: f.storagePath, uploadedById: me.userId,
          })),
        });
        await tx.attachment.deleteMany({ where: { id: { in: files.map((f) => f.id) } } });
      }

      await tx.activity.create({
        data: {
          workspaceId: me.workspaceId, recordType: "contact", recordId: keep.id, kind: "change", source: "manual",
          summary: "Merged a duplicate contact into this one", actorId: me.userId, actorEmail: me.email,
        },
      });
      await tx.contact.delete({ where: { id: drop.id } });
      await audit(tx, me.scope, { action: "contact.merged", entityType: "contact", entityId: keep.id, meta: { removedId: drop.id } });
      return keep.id;
    });

    revalidatePath("/contacts");
    revalidatePath("/data-quality");
    return { ok: true, id: keptId };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
