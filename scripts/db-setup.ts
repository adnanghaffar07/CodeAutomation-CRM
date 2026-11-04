// One-time / repeatable database setup (run after `prisma db push`):
//   1. creates the non-superuser role `crm_app` (first run only) with a generated password,
//   2. applies scripts/rls.sql (grants, API lock-down, forced row-level security),
//   3. points DATABASE_URL at crm_app, so the running app can never bypass RLS,
//   4. seeds the CodeAutomation workspace.
// Admin work uses DIRECT_URL (the `postgres` user). Secrets are never printed.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadEnv, setEnvVars } from "./_env";

loadEnv();

async function main() {
  const direct = process.env.DIRECT_URL;
  if (!direct) throw new Error("DIRECT_URL is not set");
  const admin = new PrismaClient({ datasources: { db: { url: direct } } });

  try {
    const existing = await admin.$queryRaw<{ n: number }[]>`select count(*)::int as n from pg_roles where rolname = 'crm_app'`;
    const roleExists = existing[0].n > 0;
    const password = randomBytes(24).toString("hex");

    const sql = fs.readFileSync(path.join(__dirname, "rls.sql"), "utf8").replace("__CRM_APP_PASSWORD__", password);
    const statements = sql.split(/^--#\s*$/m).map((s) => s.trim()).filter(Boolean);
    for (const st of statements) await admin.$executeRawUnsafe(st);
    console.log(`RLS script applied (${statements.length} statements).`);

    if (!roleExists) {
      // Pooler login names for a custom role are "<role>.<project-ref>".
      const url = new URL(direct);
      const ref = url.username.split(".")[1];
      if (!ref) throw new Error("Could not read the project ref from DIRECT_URL");
      const appUrl = new URL(process.env.DATABASE_URL ?? direct);
      appUrl.username = `crm_app.${ref}`;
      appUrl.password = password;
      setEnvVars({ DATABASE_URL: appUrl.toString() });
      console.log("Created role crm_app and pointed DATABASE_URL at it (.env and .env.local).");
    } else {
      console.log("Role crm_app already exists; DATABASE_URL left as is.");
    }

    await admin.workspace.upsert({
      where: { slug: "codeautomation" },
      update: {},
      create: { name: "CodeAutomation", slug: "codeautomation" },
    });
    console.log("Workspace 'CodeAutomation' is in place.");
  } finally {
    await admin.$disconnect();
  }
}

main().catch((e) => {
  console.error("db-setup failed:", String(e.message ?? e).replace(/:\/\/([^:]+):[^@]+@/g, "://$1:<hidden>@"));
  process.exit(1);
});
