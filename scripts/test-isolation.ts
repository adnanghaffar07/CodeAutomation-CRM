// Proves workspace isolation end to end against the real database:
// two throwaway workspaces, queried as the app role (crm_app) through withScope.
// Also checks the Supabase REST API (publishable key) cannot read the tables.
// All test rows are removed at the end, pass or fail.
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "./_env";

loadEnv();

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { withScope, withSystem } = await import("../src/lib/scope");
  const { prisma } = await import("../src/lib/db");
  const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  const tag = randomUUID().slice(0, 8);
  const [wsA, wsB] = [randomUUID(), randomUUID()];
  const [userA, userB] = [randomUUID(), randomUUID()];

  try {
    const who = await prisma.$queryRaw<{ u: string; super: boolean; bypass: boolean }[]>`
      select current_user as u, rolsuper as super, rolbypassrls as bypass from pg_roles where rolname = current_user`;
    check("app connects as crm_app (not superuser, no BYPASSRLS)", who[0].u === "crm_app" && !who[0].super && !who[0].bypass, who[0].u);

    await admin.workspace.createMany({ data: [
      { id: wsA, name: `Test A ${tag}`, slug: `test-a-${tag}` },
      { id: wsB, name: `Test B ${tag}`, slug: `test-b-${tag}` },
    ] });
    await admin.workspaceMember.createMany({ data: [
      { workspaceId: wsA, userId: userA, email: `a-${tag}@test.invalid`, fullName: "Alice (A)", role: "ceo_admin" },
      { workspaceId: wsB, userId: userB, email: `b-${tag}@test.invalid`, fullName: "Bob (B)", role: "sales_bd" },
    ] });

    const asA = { userId: userA, workspaceId: wsA, role: "ceo_admin" as const };
    const asB = { userId: userB, workspaceId: wsB, role: "sales_bd" as const };

    const wsSeenByA = await withScope(asA, (tx) => tx.workspace.findMany({ select: { id: true } }));
    check("A sees only workspace A", wsSeenByA.length === 1 && wsSeenByA[0].id === wsA, `${wsSeenByA.length} row(s)`);

    const membersSeenByA = await withScope(asA, (tx) => tx.workspaceMember.findMany({ select: { workspaceId: true } }));
    check("A sees only A's members", membersSeenByA.length > 0 && membersSeenByA.every((m) => m.workspaceId === wsA));

    const membersSeenByB = await withScope(asB, (tx) => tx.workspaceMember.findMany({ select: { workspaceId: true } }));
    check("B sees only B's members", membersSeenByB.length === 1 && membersSeenByB[0].workspaceId === wsB);

    const direct = await withScope(asB, (tx) => tx.workspaceMember.findMany({ where: { workspaceId: wsA } }));
    check("B asking for A's rows by id gets nothing", direct.length === 0);

    const noScope = await prisma.workspace.findMany();
    check("no scope set means no rows", noScope.length === 0, `${noScope.length} row(s)`);

    let blocked = false;
    try {
      await withScope(asA, (tx) => tx.workspaceMember.create({
        data: { workspaceId: wsB, userId: randomUUID(), email: `x-${tag}@test.invalid`, fullName: "Intruder", role: "sales_bd" },
      }));
    } catch { blocked = true; }
    check("A cannot write into workspace B", blocked);

    let updated = 0;
    try { updated = (await withScope(asA, (tx) => tx.workspace.updateMany({ where: { id: wsB }, data: { name: "hacked" } }))).count; } catch { /* blocked */ }
    check("A cannot modify workspace B", updated === 0);

    const system = await withSystem((tx) => tx.workspace.findMany({ where: { id: { in: [wsA, wsB] } }, select: { id: true } }));
    check("system scope sees both (for background jobs)", system.length === 2);

    // ---- Phase 1: roles inside a workspace -------------------------------------------------
    const asAManager = { userId: userA, workspaceId: wsA, role: "manager" as const };
    const asASales = { userId: userA, workspaceId: wsA, role: "sales_bd" as const };

    const memberA = await admin.workspaceMember.findFirstOrThrow({ where: { workspaceId: wsA } });
    const mgrUpdate = await withScope(asAManager, (tx) => tx.workspaceMember.updateMany({ where: { id: memberA.id }, data: { role: "ceo_admin" } }));
    check("manager cannot change anyone's role", mgrUpdate.count === 0);
    const ceoUpdate = await withScope(asA, (tx) => tx.workspaceMember.updateMany({ where: { id: memberA.id }, data: { fullName: "Alice (A) renamed" } }));
    check("CEO/Admin can update members of their own workspace", ceoUpdate.count === 1);
    let salesInsertBlocked = false;
    try {
      await withScope(asASales, (tx) => tx.workspaceMember.create({ data: { workspaceId: wsA, userId: randomUUID(), email: `s-${tag}@test.invalid`, fullName: "Sneaky", role: "ceo_admin" } }));
    } catch { salesInsertBlocked = true; }
    check("sales user cannot add a CEO/Admin", salesInsertBlocked);
    const salesSeesMembers = await withScope(asASales, (tx) => tx.workspaceMember.findMany());
    check("everyone can read their workspace's member list", salesSeesMembers.length >= 1 && salesSeesMembers.every((m) => m.workspaceId === wsA));

    // ---- Audit log: append-only, readable by CEO/Admin and manager only ---------------------
    const { audit } = await import("../src/lib/audit");
    await withScope(asASales, (tx) => audit(tx, asASales, { action: "test.sales_wrote", entityType: "test" }));
    await withScope(asA, (tx) => audit(tx, asA, { action: "test.ceo_wrote", entityType: "test" }));
    const salesAudit = await withScope(asASales, (tx) => tx.auditLog.findMany());
    check("sales user can write but not read the audit log", salesAudit.length === 0);
    const ceoAudit = await withScope(asA, (tx) => tx.auditLog.findMany());
    check("CEO/Admin reads only their workspace's audit entries", ceoAudit.length === 2 && ceoAudit.every((a) => a.workspaceId === wsA), `${ceoAudit.length} row(s)`);
    const bAudit = await withScope(asB, (tx) => tx.auditLog.findMany());
    check("another workspace sees none of it", bAudit.length === 0);
    let auditUpdateBlocked = false;
    try { await withScope(asA, (tx) => tx.auditLog.updateMany({ data: { action: "tampered" } })); } catch { auditUpdateBlocked = true; }
    check("audit entries cannot be edited", auditUpdateBlocked);
    let auditDeleteBlocked = false;
    try { await withScope(asA, (tx) => tx.auditLog.deleteMany()); } catch { auditDeleteBlocked = true; }
    check("audit entries cannot be deleted", auditDeleteBlocked);

    // ---- Integration credentials: CEO/Admin only, own workspace only -----------------------
    await admin.integrationCredential.createMany({ data: [
      { workspaceId: wsA, provider: "instantly", label: "t", ciphertext: "x", hint: "1234", createdById: userA },
      { workspaceId: wsB, provider: "instantly", label: "t", ciphertext: "x", hint: "5678", createdById: userB },
    ] });
    const credCeo = await withScope(asA, (tx) => tx.integrationCredential.findMany({ select: { workspaceId: true } }));
    check("CEO/Admin sees only their workspace's credentials", credCeo.length === 1 && credCeo[0].workspaceId === wsA);
    const credMgr = await withScope(asAManager, (tx) => tx.integrationCredential.findMany());
    check("manager cannot see credentials", credMgr.length === 0);
    const credSales = await withScope(asASales, (tx) => tx.integrationCredential.findMany());
    check("sales user cannot see credentials", credSales.length === 0);

    // Supabase REST API with the public key must not expose the tables.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      const res = await fetch(`${url}/rest/v1/Workspace?select=id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const body = await res.text();
      const leaked = res.ok && body.trim() !== "[]";
      check("REST API with the publishable key returns no data", !leaked, `HTTP ${res.status}`);
    }
  } finally {
    await admin.integrationCredential.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.auditLog.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.workspaceMember.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.workspace.deleteMany({ where: { id: { in: [wsA, wsB] } } });
    await admin.$disconnect();
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nAll isolation checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("test-isolation error:", String(e.message ?? e).replace(/:\/\/([^:]+):[^@]+@/g, "://$1:<hidden>@"));
  process.exit(1);
});
