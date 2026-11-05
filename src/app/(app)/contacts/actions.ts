"use server";
// Contact create / edit / delete / bulk actions. Every one: checks the capability, runs under the caller's scope
// (so row-level security limits it to records they may see), and writes to the record's timeline.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { can } from "@/lib/permissions";
import { LEAD_STATUSES } from "@/lib/records/constants";
import { cleanTags, fullName, normEmail, searchBlob } from "@/lib/records/text";
import {
  actor, canReassign, contactSchema, diffFields, errorMessage, fail, isUniqueViolation, logActivity,
  type ActionResult, type ContactInput,
} from "@/lib/records/server";

const LABELS: Record<string, string> = {
  fullName: "Name", email: "Email", emailStatus: "Email status", phone: "Phone", jobTitle: "Job title", accountId: "Account",
  linkedinUrl: "LinkedIn", city: "City", region: "Region", country: "Country", source: "Source", serviceInterest: "Service interest",
  nextAction: "Next action", followUpAt: "Follow-up date", qualification: "Status", ownerId: "Owner", tags: "Tags",
};

const DUPLICATE = "A contact with that email already exists in this workspace.";

export async function createContact(input: ContactInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await actor("contacts.write");
    const p = contactSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    const ownerId = v.ownerId && canReassign(me) ? v.ownerId : me.userId;

    const id = await withScope(me.scope, async (tx) => {
      const account = v.accountId ? await tx.account.findUnique({ where: { id: v.accountId }, select: { name: true } }) : null;
      if (v.accountId && !account) throw new Error("That account doesn't exist, or you can't see it.");
      const name = fullName(v.firstName, v.lastName);
      const email = normEmail(v.email);
      const c = await tx.contact.create({
        data: {
          workspaceId: me.workspaceId, createdById: me.userId, ownerId,
          assigneeIds: canReassign(me) ? v.assigneeIds : [],
          firstName: v.firstName, lastName: v.lastName, fullName: name, email, emailStatus: v.emailStatus,
          phone: v.phone, jobTitle: v.jobTitle, linkedinUrl: v.linkedinUrl, city: v.city, region: v.region, country: v.country,
          source: v.source, serviceInterest: v.serviceInterest, nextAction: v.nextAction, accountId: v.accountId,
          qualification: v.qualification, followUpAt: v.followUpAt, verifiedAt: v.verified ? new Date() : null,
          tags: cleanTags(v.tags), customFields: v.customFields,
          searchText: searchBlob([name, email, v.jobTitle, account?.name, v.city, v.country, v.phone]),
        },
        select: { id: true },
      });
      await logActivity(tx, me, [{ recordType: "contact", recordId: c.id, kind: "system", summary: "Contact created" }]);
      return c.id;
    });
    revalidatePath("/contacts");
    return { ok: true, id };
  } catch (e) {
    return fail(isUniqueViolation(e) ? DUPLICATE : errorMessage(e));
  }
}

export async function updateContact(id: string, input: ContactInput): Promise<ActionResult> {
  try {
    const me = await actor("contacts.write");
    if (!z.string().uuid().safeParse(id).success) return fail("Invalid request.");
    const p = contactSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;

    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const before = await tx.contact.findUnique({ where: { id } });
      if (!before) return fail("Contact not found, or you can't see it.");
      const accountId = v.accountId;
      const account = accountId ? await tx.account.findUnique({ where: { id: accountId }, select: { name: true } }) : null;
      if (accountId && !account) return fail("That account doesn't exist, or you can't see it.");

      // Only CEO/Admin and managers hand records to other people.
      const ownerId = canReassign(me) ? v.ownerId : before.ownerId;
      const assigneeIds = canReassign(me) ? v.assigneeIds : before.assigneeIds;
      const name = fullName(v.firstName, v.lastName);
      const email = normEmail(v.email);
      const tags = cleanTags(v.tags);
      const next = {
        fullName: name, email, emailStatus: v.emailStatus, phone: v.phone, jobTitle: v.jobTitle, accountId, linkedinUrl: v.linkedinUrl,
        city: v.city, region: v.region, country: v.country, source: v.source, serviceInterest: v.serviceInterest, nextAction: v.nextAction,
        followUpAt: v.followUpAt, qualification: v.qualification, ownerId, tags,
      };
      const changes = diffFields(before as never, next, LABELS);

      await tx.contact.update({
        where: { id },
        data: {
          firstName: v.firstName, lastName: v.lastName, ...next, assigneeIds,
          verifiedAt: v.verified ? before.verifiedAt ?? new Date() : null,
          customFields: v.customFields,
          searchText: searchBlob([name, email, v.jobTitle, account?.name, v.city, v.country, v.phone]),
        },
      });
      if (changes.length) {
        await logActivity(tx, me, [{
          recordType: "contact", recordId: id, kind: "change",
          summary: `Updated ${changes.map((c) => c.field.toLowerCase()).join(", ")}`,
          detail: { changes } as never,
        }]);
      }
      revalidatePath("/contacts");
      revalidatePath(`/contacts/${id}`);
      return { ok: true };
    });
  } catch (e) {
    return fail(isUniqueViolation(e) ? DUPLICATE : errorMessage(e));
  }
}

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  ownerId: z.string().uuid().optional(),
  qualification: z.enum(LEAD_STATUSES).optional(),
  addTag: z.string().trim().min(1).max(40).optional(),
  removeTag: z.string().trim().min(1).max(40).optional(),
});

export async function bulkUpdateContacts(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ updated: number }>> {
  try {
    const me = await actor("contacts.write");
    const p = bulkSchema.safeParse(input);
    if (!p.success) return fail("Pick at least one record, up to 500.");
    const { ids, ownerId, qualification, addTag, removeTag } = p.data;
    if (ownerId && !canReassign(me)) return fail("Only a manager or the CEO/Admin can change owners.");
    if (!ownerId && !qualification && !addTag && !removeTag) return fail("Choose what to change.");

    const updated = await withScope(me.scope, async (tx) => {
      // Only records the caller can see are returned here; everything below acts on exactly those.
      const rows = await tx.contact.findMany({ where: { id: { in: ids } }, select: { id: true } });
      const seen = rows.map((r) => r.id);
      if (seen.length === 0) return 0;
      if (ownerId) await tx.contact.updateMany({ where: { id: { in: seen } }, data: { ownerId } });
      if (qualification) await tx.contact.updateMany({ where: { id: { in: seen } }, data: { qualification } });
      if (addTag) {
        const t = cleanTags([addTag])[0];
        await tx.$executeRaw`UPDATE "Contact" SET tags = ARRAY(SELECT DISTINCT x FROM unnest(tags || ARRAY[${t}]::text[]) x), "updatedAt" = now() WHERE id = ANY(${seen}::uuid[])`;
      }
      if (removeTag) {
        const t = cleanTags([removeTag])[0];
        await tx.$executeRaw`UPDATE "Contact" SET tags = array_remove(tags, ${t}), "updatedAt" = now() WHERE id = ANY(${seen}::uuid[])`;
      }
      const what = [ownerId && "owner", qualification && `status to ${qualification}`, addTag && `tag "${addTag}" added`, removeTag && `tag "${removeTag}" removed`].filter(Boolean).join(", ");
      await logActivity(tx, me, seen.map((recordId) => ({ recordType: "contact" as const, recordId, kind: "change" as const, summary: `Bulk update: ${what}` })));
      return seen.length;
    });
    revalidatePath("/contacts");
    return { ok: true, updated };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteContacts(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    const me = await actor("contacts.write");
    if (!can(me.role, "assignments.manage")) return fail("Only a manager or the CEO/Admin can delete records.");
    const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
    if (!parsed.success) return fail("Pick at least one record, up to 500.");
    // The timeline is append-only, so a deleted record's history stays behind (hidden with the record).
    const deleted = await withScope(me.scope, async (tx) => (await tx.contact.deleteMany({ where: { id: { in: parsed.data } } })).count);
    revalidatePath("/contacts");
    return { ok: true, deleted };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
