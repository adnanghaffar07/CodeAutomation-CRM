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

    // ---- Phase 2: record visibility (creator / owner / assignee) ----------------------------
    const [s1, s2] = [randomUUID(), randomUUID()];
    const asS1 = { userId: s1, workspaceId: wsA, role: "sales_bd" as const };
    const asS2 = { userId: s2, workspaceId: wsA, role: "data_researcher" as const };
    const asMgr = { userId: randomUUID(), workspaceId: wsA, role: "manager" as const };
    const mk = (extra: object = {}) => ({ workspaceId: wsA, createdById: s1, ownerId: s1, firstName: "Test", fullName: "Test Person", ...extra });

    const c1 = await withScope(asS1, (tx) => tx.contact.create({ data: mk({ email: `c1-${tag}@test.invalid` }), select: { id: true, viewerIds: true } }));
    check("trigger fills viewerIds with creator and owner", c1.viewerIds.length === 1 && c1.viewerIds[0] === s1);
    check("creator sees their own contact", (await withScope(asS1, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 1);
    check("another sales/researcher user does NOT see it", (await withScope(asS2, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 0);
    check("manager sees it", (await withScope(asMgr, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 1);
    check("CEO/Admin sees it", (await withScope(asA, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 1);
    check("CEO of another workspace does not", (await withScope(asB, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 0);

    await withScope(asMgr, (tx) => tx.contact.update({ where: { id: c1.id }, data: { assigneeIds: [s2] } }));
    check("assigning a person gives them access (trigger refreshes viewerIds)", (await withScope(asS2, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 1);
    await withScope(asMgr, (tx) => tx.contact.update({ where: { id: c1.id }, data: { assigneeIds: [] } }));
    check("removing the assignment removes their access", (await withScope(asS2, (tx) => tx.contact.findMany({ where: { id: c1.id } }))).length === 0);

    let forged = false;
    try { await withScope(asS2, (tx) => tx.contact.create({ data: mk({ createdById: s1, email: `forged-${tag}@test.invalid` }), select: { id: true } })); } catch { forged = true; }
    check("cannot create a record in someone else's name", forged);

    const updatedByOther = await withScope(asS2, (tx) => tx.contact.updateMany({ where: { id: c1.id }, data: { jobTitle: "hacked" } }));
    check("cannot edit a record you cannot see", updatedByOther.count === 0);
    const delBySales = await withScope(asS1, (tx) => tx.contact.deleteMany({ where: { id: c1.id } }));
    check("sales/researcher cannot delete, even their own", delBySales.count === 0);

    let dup = false;
    try { await withScope(asS2, (tx) => tx.contact.create({ data: mk({ createdById: s2, ownerId: s2, email: `c1-${tag}@test.invalid` }), select: { id: true } })); } catch { dup = true; }
    check("same email twice in one workspace is refused", dup);
    const sameEmailOtherWs = await withScope(asB, (tx) => tx.contact.create({ data: { workspaceId: wsB, createdById: userB, ownerId: userB, firstName: "T", fullName: "T", email: `c1-${tag}@test.invalid` }, select: { id: true } }));
    check("the same email in a different workspace is fine", !!sameEmailOtherWs.id);

    const a1 = await withScope(asS1, (tx) => tx.account.create({ data: { workspaceId: wsA, createdById: s1, ownerId: s1, name: `Acct ${tag}` }, select: { id: true } }));
    check("accounts follow the same rule (other user cannot see)", (await withScope(asS2, (tx) => tx.account.findMany({ where: { id: a1.id } }))).length === 0);
    check("accounts: manager sees it", (await withScope(asMgr, (tx) => tx.account.findMany({ where: { id: a1.id } }))).length === 1);

    // ---- timeline follows its record ---------------------------------------------------------
    await withScope(asS1, (tx) => tx.activity.createMany({ data: [{ workspaceId: wsA, recordType: "contact", recordId: c1.id, kind: "note", summary: "Note", body: "private", actorId: s1 }] }));
    check("timeline: owner reads it", (await withScope(asS1, (tx) => tx.activity.findMany({ where: { recordId: c1.id } }))).length === 1);
    check("timeline: unrelated user cannot read it", (await withScope(asS2, (tx) => tx.activity.findMany({ where: { recordId: c1.id } }))).length === 0);
    check("timeline: manager reads it", (await withScope(asMgr, (tx) => tx.activity.findMany({ where: { recordId: c1.id } }))).length === 1);
    let noteBlocked = false;
    try { await withScope(asS2, (tx) => tx.activity.createMany({ data: [{ workspaceId: wsA, recordType: "contact", recordId: c1.id, kind: "note", summary: "Note", body: "sneaky", actorId: s2 }] })); } catch { noteBlocked = true; }
    check("cannot add a note to a record you cannot see", noteBlocked);
    let spoof = false;
    try { await withScope(asS1, (tx) => tx.activity.createMany({ data: [{ workspaceId: wsA, recordType: "contact", recordId: c1.id, kind: "note", summary: "Note", body: "spoof", actorId: s2 }] })); } catch { spoof = true; }
    check("cannot write a timeline entry as someone else", spoof);
    let actUpd = false;
    try { await withScope(asS1, (tx) => tx.activity.updateMany({ data: { body: "edited" } })); } catch { actUpd = true; }
    check("timeline entries cannot be edited", actUpd);

    // ---- saved views and custom fields ---------------------------------------------------------
    await withScope(asS1, (tx) => tx.savedView.createMany({ data: [
      { workspaceId: wsA, ownerId: s1, entity: "contact", name: `private-${tag}`, shared: false },
      { workspaceId: wsA, ownerId: s1, entity: "contact", name: `shared-${tag}`, shared: true },
    ] }));
    const seenViews = (await withScope(asS2, (tx) => tx.savedView.findMany({ select: { name: true } }))).map((v) => v.name);
    check("saved views: others see only shared ones", seenViews.includes(`shared-${tag}`) && !seenViews.includes(`private-${tag}`));
    check("saved views: other workspace sees none", (await withScope(asB, (tx) => tx.savedView.findMany())).length === 0);
    let fieldBlocked = false;
    try { await withScope(asS1, (tx) => tx.customFieldDef.create({ data: { workspaceId: wsA, entity: "contact", key: "x", label: "X" } })); } catch { fieldBlocked = true; }
    check("only the CEO/Admin can define custom fields", fieldBlocked);
    await withScope(asA, (tx) => tx.customFieldDef.create({ data: { workspaceId: wsA, entity: "contact", key: `k${tag}`, label: "K" } }));
    check("everyone in the workspace can read field definitions", (await withScope(asS2, (tx) => tx.customFieldDef.findMany())).length === 1);

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
    await admin.activity.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.savedView.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.customFieldDef.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.contact.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
    await admin.account.deleteMany({ where: { workspaceId: { in: [wsA, wsB] } } });
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
