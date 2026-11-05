// Applies scripts/rls.sql to a THROWAWAY benchmark database (BENCH_URL), never to the real one.
//   BENCH_URL=postgresql://postgres:bench@127.0.0.1:55432/postgres npx tsx scripts/bench/apply-rls.ts
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const url = process.env.BENCH_URL;
if (!url || !/127\.0\.0\.1|localhost/.test(url)) {
  console.error("Refusing to run: BENCH_URL must point at a local throwaway database.");
  process.exit(1);
}

async function main() {
  const db = new PrismaClient({ datasources: { db: { url: url! } } });
  const sql = fs.readFileSync(path.join(__dirname, "..", "rls.sql"), "utf8").replace("__CRM_APP_PASSWORD__", "bench");
  const statements = sql.split(/^--#\s*$/m).map((s) => s.trim()).filter(Boolean);
  for (const st of statements) await db.$executeRawUnsafe(st);
  console.log(`Applied ${statements.length} statements to ${String(url).replace(/:[^:@/]+@/, ":<hidden>@")}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(String(e.message ?? e).split("\n").slice(-3).join(" | ")); process.exit(1); });
