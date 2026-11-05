"use server";
// Things both record types share: timeline notes, saved list views, and custom field definitions.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withScope } from "@/lib/scope";
import { can } from "@/lib/permissions";
import { FILTER_KEYS } from "@/lib/records/constants";
import { actor, errorMessage, fail, isUniqueViolation, logActivity, type ActionResult } from "@/lib/records/server";

export async function addNote(recordType: "contact" | "account", recordId: string, body: string): Promise<ActionResult> {
  try {
    const me = await actor(recordType === "contact" ? "contacts.write" : "accounts.write");
    const p = z.object({ t: z.enum(["contact", "account"]), id: z.string().uuid(), body: z.string().trim().min(1, "Write something first").max(5000) }).safeParse({ t: recordType, id: recordId, body });
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid note.");
    await withScope(me.scope, async (tx) => {
      // Insert is allowed only for records the caller can see; this also gives a clear error otherwise.
      const exists = recordType === "contact"
        ? await tx.contact.findUnique({ where: { id: recordId }, select: { id: true } })
        : await tx.account.findUnique({ where: { id: recordId }, select: { id: true } });
      if (!exists) throw new Error("Record not found, or you can't see it.");
      await logActivity(tx, me, [{ recordType, recordId, kind: "note", summary: "Note", body: p.data.body }]);
    });
    revalidatePath(`/${recordType}s/${recordId}`);
    return { ok: true };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const viewSchema = z.object({
  entity: z.enum(["contact", "account"]),
  name: z.string().trim().min(1, "Give the view a name").max(60),
  filters: z.record(z.string(), z.string().max(200)).default({}),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
  shared: z.boolean().default(false),
});

export async function saveView(input: z.input<typeof viewSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await actor("contacts.read");
    const p = viewSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    const allowed = new Set<string>(FILTER_KEYS);
    const filters = Object.fromEntries(Object.entries(v.filters).filter(([k, val]) => allowed.has(k) && val && k !== "sort"));
    const shared = v.shared && can(me.role, "assignments.manage");
    const id = await withScope(me.scope, async (tx) => {
      const row = await tx.savedView.upsert({
        where: { workspaceId_ownerId_entity_name: { workspaceId: me.workspaceId, ownerId: me.userId, entity: v.entity, name: v.name } },
        update: { filters, sort: v.sort, shared },
        create: { workspaceId: me.workspaceId, ownerId: me.userId, entity: v.entity, name: v.name, filters, sort: v.sort, shared },
        select: { id: true },
      });
      return row.id;
    });
    revalidatePath(`/${v.entity}s`);
    return { ok: true, id };
  } catch (e) {
    return fail(isUniqueViolation(e) ? "You already have a view with that name." : errorMessage(e));
  }
}

export async function deleteView(id: string): Promise<ActionResult> {
  try {
    const me = await actor("contacts.read");
    if (!z.string().uuid().safeParse(id).success) return fail("Invalid request.");
    await withScope(me.scope, (tx) => tx.savedView.deleteMany({ where: { id } }));
    revalidatePath("/contacts");
    revalidatePath("/accounts");
    return { ok: true };
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const fieldSchema = z.object({
  entity: z.enum(["contact", "account"]),
  label: z.string().trim().min(1, "Give the field a label").max(60),
  type: z.enum(["text", "number", "date", "select"]),
  options: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});

export async function createCustomField(input: z.input<typeof fieldSchema>): Promise<ActionResult> {
  try {
    const me = await actor("settings.access");
    const p = fieldSchema.safeParse(input);
    if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the form.");
    const v = p.data;
    if (v.type === "select" && v.options.length < 2) return fail("A choice field needs at least two options.");
    const key = v.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!key) return fail("Use letters or numbers in the label.");
    await withScope(me.scope, async (tx) => {
      const count = await tx.customFieldDef.count({ where: { entity: v.entity } });
      await tx.customFieldDef.create({ data: { workspaceId: me.workspaceId, entity: v.entity, key, label: v.label, type: v.type, options: v.type === "select" ? v.options : [], position: count } });
    });
    revalidatePath("/settings/fields");
    return { ok: true };
  } catch (e) {
    return fail(isUniqueViolation(e) ? "A field with that name already exists." : errorMessage(e));
  }
}

export async function deleteCustomField(id: string): Promise<ActionResult> {
  try {
    const me = await actor("settings.access");
    if (!z.string().uuid().safeParse(id).success) return fail("Invalid request.");
    // Values already saved on records stay in their data; the field just stops being shown.
    await withScope(me.scope, (tx) => tx.customFieldDef.deleteMany({ where: { id } }));
    revalidatePath("/settings/fields");
    return { ok: true };
  } catch (e) {
    return fail(errorMessage(e));
  }
}
