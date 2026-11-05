// Audit trail (SPEC §R-5.1). Always written inside the same transaction as the change it describes,
// so a change cannot commit without its audit row. The table is append-only for the app role.
import type { Tx } from "@/lib/db";
import type { Scope } from "@/lib/scope";

export type AuditEntry = {
  action: string; // dotted verb, e.g. "user.invited", "user.role_changed", "credential.saved"
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
};

export async function audit(tx: Tx, scope: Scope & { email?: string }, e: AuditEntry): Promise<void> {
  // createMany (no RETURNING): a plain member may insert audit rows but is not allowed to read them back.
  await tx.auditLog.createMany({
    data: [{
      workspaceId: scope.workspaceId,
      actorId: scope.userId,
      actorEmail: scope.email ?? null,
      action: e.action,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      meta: (e.meta ?? undefined) as never,
    }],
  });
}
