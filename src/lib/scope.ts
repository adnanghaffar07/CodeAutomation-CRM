// Runs database work with the caller's identity set as transaction-local session variables.
// The RLS policies (scripts/rls.sql) read them through app.workspace_id() / app.user_id() / app.role(),
// so a query that forgets a `where` still cannot see another workspace's rows.
//
// `set_config(..., true)` is transaction-local, which keeps it safe behind Supabase's transaction pooler.
import { prisma, type Tx } from "@/lib/db";

export type Role = "ceo_admin" | "manager" | "sales_bd" | "data_researcher";

export type Scope = { userId: string; workspaceId: string; role: Role };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run `fn` as a signed-in user of one workspace. */
export async function withScope<T>(scope: Scope, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(scope.userId) || !UUID.test(scope.workspaceId)) throw new Error("withScope: invalid scope ids");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`select
      set_config('app.user_id', ${scope.userId}, true),
      set_config('app.workspace_id', ${scope.workspaceId}, true),
      set_config('app.role', ${scope.role}, true)`;
    return fn(tx);
  });
}

/** Run `fn` as the system (background jobs, sign-in lookups). Bypasses workspace isolation: use sparingly. */
export async function withSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`select set_config('app.bypass', 'on', true)`;
    return fn(tx);
  });
}
