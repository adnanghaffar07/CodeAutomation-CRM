"use server";
// Integration credentials (CEO/Admin only). Secrets are encrypted before they touch the database, are never
// returned to the browser (only the provider, label and last 4 characters), and every change is audited.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/session";
import { requireCapability } from "@/lib/permissions";
import { withScope } from "@/lib/scope";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { PROVIDERS } from "@/lib/providers";

export type CredResult = { ok: true } | { ok: false; error: string };

const saveSchema = z.object({
  provider: z.enum(PROVIDERS),
  label: z.string().trim().min(1).max(60).default("default"),
  secret: z.string().min(8, "That looks too short to be a key.").max(8000),
});

export async function saveCredential(input: unknown): Promise<CredResult> {
  try {
    const me = await currentUser();
    if (!me) return { ok: false, error: "Not signed in" };
    requireCapability(me.role, "integrations.manage");
    const p = saveSchema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the form." };
    const { provider, label, secret } = p.data;
    const ciphertext = encryptSecret(secret);
    const hint = secret.slice(-4);

    await withScope(me.scope, async (tx) => {
      const row = await tx.integrationCredential.upsert({
        where: { workspaceId_provider_label: { workspaceId: me.workspaceId, provider, label } },
        update: { ciphertext, hint },
        create: { workspaceId: me.workspaceId, provider, label, ciphertext, hint, createdById: me.userId },
      });
      // The secret itself is never written to the audit log.
      await audit(tx, me.scope, { action: "credential.saved", entityType: "credential", entityId: row.id, meta: { provider, label } });
    });
    revalidatePath("/settings/credentials");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function deleteCredential(id: string): Promise<CredResult> {
  try {
    const me = await currentUser();
    if (!me) return { ok: false, error: "Not signed in" };
    requireCapability(me.role, "integrations.manage");
    if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid request." };
    await withScope(me.scope, async (tx) => {
      const row = await tx.integrationCredential.findUnique({ where: { id } });
      if (!row) return;
      await tx.integrationCredential.delete({ where: { id } });
      await audit(tx, me.scope, { action: "credential.deleted", entityType: "credential", entityId: id, meta: { provider: row.provider, label: row.label } });
    });
    revalidatePath("/settings/credentials");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
