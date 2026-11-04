// The raw Prisma client. Only scope.ts, auth code and scripts may use it directly;
// everything else runs inside withScope / withSystem so the RLS session variables are set.
//
// DATABASE_URL must be the `crm_app` role (scripts/db-setup.ts). `postgres` bypasses RLS.
import { Prisma, PrismaClient } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as { __caPrisma?: PrismaClient };

function client(): PrismaClient {
  if (!globalForPrisma.__caPrisma) {
    globalForPrisma.__caPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.__caPrisma;
}

/** Created on first use, so env is loaded before the connection is configured. One client per process. */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const c = client();
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? v.bind(c) : v;
  },
});
