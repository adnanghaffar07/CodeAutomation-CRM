"use server";
// Account create / edit / delete / bulk actions. Same rules as contacts: capability check, caller's scope, timeline entry.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { can } from "@/lib/permissions";
import { LEAD_STATUSES } from "@/lib/records/constants";
import { cleanTags, normDomain, searchBlob } from "@/lib/records/text";
import { accountSchema, actor, canReassign, diffFields, errorMessage, fail, logActivity, type AccountInput, type ActionResult } from "@/lib/records/server";

const LABELS: Record<string, string> = {
  name: "Name", domain: "Domain", website: "Website", industry: "Industry", sizeBand: "Company size", city: "City", region: "Region",
  country: "Country", phone: "Phone", linkedinUrl: "LinkedIn", description: "Description", source: "Source", serviceInterest: "Service interest",
  nextAction: "Next action", followUpAt: "Follow-up date", qualification: "Status", ownerId: "Owner", tags: "Tags",
};

export async function createAccount(input: AccountInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await actor("accounts.write");
    const p = accountSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    const ownerId = v.ownerId && canReassign(me) ? v.ownerId : me.userId;
    const domain = normDomain(v.domain);
    const id = await withScope(me.scope, async (tx) => {
      const a = await tx.account.create({
        data: {
          workspaceId: me.workspaceId, createdById: me.userId, ownerId, assigneeIds: canReassign(me) ? v.assigneeIds : [],
          name: v.name, domain, website: v.website, industry: v.industry, sizeBand: v.sizeBand, city: v.city, region: v.region, country: v.country,
          phone: v.phone, linkedinUrl: v.linkedinUrl, description: v.description, source: v.source, serviceInterest: v.serviceInterest,
          nextAction: v.nextAction, qualification: v.qualification, followUpAt: v.followUpAt, verifiedAt: v.verified ? new Date() : null,
          tags: cleanTags(v.tags), customFields: v.customFields,
          searchText: searchBlob([v.name, domain, v.industry, v.city, v.country]),
        },
        select: { id: true },
      });
      await logActivity(tx, me, [{ recordType: "account", recordId: a.id, kind: "system", summary: "Account created" }]);
      return a.id;
    });
    revalidatePath("/accounts");
    return { ok: true, id };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function updateAccount(id: string, input: AccountInput): Promise<ActionResult> {
  try {
    const me = await actor("accounts.write");
    if (!z.string().uuid().safeParse(id).success) return fail("Invalid request.");
    const p = accountSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    return await withScope(me.scope, async (tx): Promise<ActionResult> => {
      const before = await tx.account.findUnique({ where: { id } });
      if (!before) return fail("Account not found, or you can't see it.");
      const domain = normDomain(v.domain);
      const ownerId = canReassign(me) ? v.ownerId : before.ownerId;
      const assigneeIds = canReassign(me) ? v.assigneeIds : before.assigneeIds;
      const tags = cleanTags(v.tags);
      const next = {
        name: v.name, domain, website: v.website, industry: v.industry, sizeBand: v.sizeBand, city: v.city, region: v.region, country: v.country,
        phone: v.phone, linkedinUrl: v.linkedinUrl, description: v.description, source: v.source, serviceInterest: v.serviceInterest,
        nextAction: v.nextAction, followUpAt: v.followUpAt, qualification: v.qualification, ownerId, tags,
      };
      const changes = diffFields(before as never, next, LABELS);
      await tx.account.update({
        where: { id },
        data: {
          ...next, assigneeIds, verifiedAt: v.verified ? before.verifiedAt ?? new Date() : null, customFields: v.customFields,
          searchText: searchBlob([v.name, domain, v.industry, v.city, v.country]),
        },
      });
      // Contacts carry their company's name in their search text; keep it in step when the name changes.
      if (before.name !== v.name) {
        await tx.$executeRaw`UPDATE "Contact" SET "searchText" = replace("searchText", ${before.name.toLowerCase()}, ${v.name.toLowerCase()}) WHERE "accountId" = ${id}::uuid`;
      }
      if (changes.length) {
        await logActivity(tx, me, [{
          recordType: "account", recordId: id, kind: "change",
          summary: `Updated ${changes.map((c) => c.field.toLowerCase()).join(", ")}`, detail: { changes } as never,
        }]);
      }
      revalidatePath("/accounts");
      revalidatePath(`/accounts/${id}`);
      return { ok: true };
    });
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  ownerId: z.string().uuid().optional(),
  qualification: z.enum(LEAD_STATUSES).optional(),
  addTag: z.string().trim().min(1).max(40).optional(),
  removeTag: z.string().trim().min(1).max(40).optional(),
});

export async function bulkUpdateAccounts(input: z.input<typeof bulkSchema>): Promise<ActionResult<{ updated: number }>> {
  try {
    const me = await actor("accounts.write");
    const p = bulkSchema.safeParse(input);
    if (!p.success) return fail("Pick at least one record, up to 500.");
    const { ids, ownerId, qualification, addTag, removeTag } = p.data;
    if (ownerId && !canReassign(me)) return fail("Only a manager or the CEO/Admin can change owners.");
    if (!ownerId && !qualification && !addTag && !removeTag) return fail("Choose what to change.");
    const updated = await withScope(me.scope, async (tx) => {
      const seen = (await tx.account.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id);
      if (seen.length === 0) return 0;
      if (ownerId) await tx.account.updateMany({ where: { id: { in: seen } }, data: { ownerId } });
      if (qualification) await tx.account.updateMany({ where: { id: { in: seen } }, data: { qualification } });
      if (addTag) {
        const t = cleanTags([addTag])[0];
        await tx.$executeRaw`UPDATE "Account" SET tags = ARRAY(SELECT DISTINCT x FROM unnest(tags || ARRAY[${t}]::text[]) x), "updatedAt" = now() WHERE id = ANY(${seen}::uuid[])`;
      }
      if (removeTag) {
        const t = cleanTags([removeTag])[0];
        await tx.$executeRaw`UPDATE "Account" SET tags = array_remove(tags, ${t}), "updatedAt" = now() WHERE id = ANY(${seen}::uuid[])`;
      }
      const what = [ownerId && "owner", qualification && `status to ${qualification}`, addTag && `tag "${addTag}" added`, removeTag && `tag "${removeTag}" removed`].filter(Boolean).join(", ");
      await logActivity(tx, me, seen.map((recordId) => ({ recordType: "account" as const, recordId, kind: "change" as const, summary: `Bulk update: ${what}` })));
      return seen.length;
    });
    revalidatePath("/accounts");
    return { ok: true, updated };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteAccounts(ids: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    const me = await actor("accounts.write");
    if (!can(me.role, "assignments.manage")) return fail("Only a manager or the CEO/Admin can delete records.");
    const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(ids);
    if (!parsed.success) return fail("Pick at least one record, up to 500.");
    // Contacts stay (their account link is cleared by the database); only the companies are removed.
    const deleted = await withScope(me.scope, async (tx) => (await tx.account.deleteMany({ where: { id: { in: parsed.data } } })).count);
    revalidatePath("/accounts");
    revalidatePath("/contacts");
    return { ok: true, deleted };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
