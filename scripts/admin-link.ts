// Bootstrap / recovery for the CEO/Admin account (and any member):
//   npm run admin:link -- sheraz@codeautomation.dev "Sheraz" ceo_admin
// Creates the Supabase user and the workspace membership if they do not exist, then writes a single-use
// sign-in link to .invite-links/<email>.txt (git-ignored). The link is NOT printed, so it never lands in a log.
// Open the file, use the link within about an hour, choose a password. Re-run any time to get a fresh link.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./_env";

loadEnv();

const ROLES = ["ceo_admin", "manager", "sales_bd", "data_researcher"];

async function main() {
  const [email, fullName = "Admin", role = "ceo_admin"] = process.argv.slice(2);
  if (!email || !ROLES.includes(role)) {
    throw new Error('Usage: npm run admin:link -- <email> "<Full name>" [ceo_admin|manager|sales_bd|data_researcher]');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_SERVICE_ROLE_KEY (Supabase secret key) in .env.local first.");

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  let kind: "invite" | "recovery" = "invite";
  let res = await sb.auth.admin.generateLink({ type: "invite", email });
  if (res.error) {
    kind = "recovery";
    res = await sb.auth.admin.generateLink({ type: "recovery", email });
  }
  if (res.error || !res.data?.user || !res.data.properties?.hashed_token) throw new Error(res.error?.message ?? "Could not create the link");

  const admin = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
  try {
    const ws = await admin.workspace.findUniqueOrThrow({ where: { slug: "codeautomation" } });
    const member = await admin.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: ws.id, userId: res.data.user.id } },
      update: {},
      create: { workspaceId: ws.id, userId: res.data.user.id, email: email.toLowerCase(), fullName, role: role as never },
    });
    await admin.auditLog.createMany({
      data: [{ workspaceId: ws.id, actorEmail: "system (admin-link script)", action: "user.link_issued", entityType: "user", entityId: member.userId, meta: { email, role: member.role } }],
    });
  } finally {
    await admin.$disconnect();
  }

  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const link = `${base}/auth/confirm?token_hash=${encodeURIComponent(res.data.properties.hashed_token)}&type=${kind}`;
  const dir = path.join(process.cwd(), ".invite-links");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${email.replace(/[^a-z0-9@._-]/gi, "_")}.txt`);
  fs.writeFileSync(file, link + "\n");
  console.log(`Access link for ${email} written to ${path.relative(process.cwd(), file)}. Open it in a browser within about an hour.`);
}

main().catch((e) => {
  console.error("admin-link failed:", String(e.message ?? e));
  process.exit(1);
});
