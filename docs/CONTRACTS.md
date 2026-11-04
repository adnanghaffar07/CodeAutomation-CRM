# Contracts

The rules every module codes against. Do not change a signature or rule here without updating this file in the same change. Requirements are in [SPEC.md](SPEC.md).

## 1. Stack

Next.js 14.2 (App Router), React 18, TypeScript (strict), Tailwind 3 + `tailwindcss-animate`, Radix primitives, `cmdk`, `vaul`, `sonner`, `framer-motion`, `next-themes`, `lucide-react`, `@tanstack/react-table`, `react-hook-form` + `zod`. Prisma 5.22 on PostgreSQL 17 (Supabase). Supabase Auth for identity. Vitest for tests. Node 20.12+.

## 2. Database access

### 2.1 Connections
| Variable | Used by | Role | Notes |
|---|---|---|---|
| `DATABASE_URL` | the running app | `crm_app` | Transaction pooler (port 6543), `?pgbouncer=true`. **Must be `crm_app`**: `postgres` bypasses RLS. |
| `DIRECT_URL` | `prisma db push`, `scripts/db-setup.ts`, tests | `postgres` | Session pooler (port 5432). Admin only; never used by request handlers. |

Prisma CLI reads `.env`; Next.js reads `.env.local`. `npm run db:setup` keeps both in step. Both are git-ignored.

### 2.2 The only two ways to query
```ts
import { withScope, withSystem } from "@/lib/scope";

await withScope({ userId, workspaceId, role }, (tx) => tx.contact.findMany(...));  // a signed-in user
await withSystem((tx) => tx.job.findMany(...));                                    // background jobs, sign-in lookups
```
- Never import `prisma` from `@/lib/db` in a page, route or action. Only `scope.ts`, auth code and scripts may.
- `withScope` opens a transaction and sets, transaction-locally: `app.user_id`, `app.workspace_id`, `app.role`.
- `withSystem` sets `app.bypass = 'on'`. It skips workspace isolation, so use it only where there is no signed-in user, and always filter by `workspaceId` yourself.
- Transaction-local settings (`set_config(..., true)`) are required because the transaction pooler hands out connections per transaction.

### 2.3 Workspace isolation (multi-tenancy)
- Every business table has `workspaceId uuid not null` and an index starting with it.
- Every business table has `ENABLE` **and** `FORCE ROW LEVEL SECURITY` and a policy:
  ```sql
  create policy <table>_isolation on "<Table>" for all to crm_app
    using (app.bypass() or "workspaceId" = app.workspace_id())
    with check (app.bypass() or "workspaceId" = app.workspace_id());
  ```
- Policies live in `scripts/rls.sql` (idempotent; statements separated by a line `--#`). Add a new table's policies there, then run `npm run db:setup` and `npm run db:test`.
- With no scope set, a query sees **zero** rows.

### 2.4 API lock-down
Supabase exposes the `public` schema over REST. `rls.sql` revokes all privileges on `public` tables and sequences from `anon` and `authenticated`, including default privileges for future tables. Helper functions live in schema `app` (not exposed). The browser never queries our tables with a Supabase key; all data goes through server code.

### 2.5 Roles
`crm_app`: login, no superuser, no BYPASSRLS, no inherit. `postgres` (admin) has BYPASSRLS in Supabase, which is why it is for setup only.

### 2.6 Schema changes
Edit `prisma/schema.prisma`, run `npx prisma db push`, then `npm run db:setup`, then `npm run db:test`. Log each change in `docs/schema-changes.md`. Schema edits are additive; destructive changes need a written plan.

## 3. Identity and roles (Phase 1 contract, fixed now)
- Supabase Auth proves **who** someone is (`auth.users.id`). It never decides what they may do.
- `WorkspaceMember` links `userId` (Supabase user id) to a `workspaceId` with a `role` (`ceo_admin | manager | sales_bd | data_researcher`) and `status` (`active | suspended`).
- Per request: verify the Supabase session on the server, load the active `WorkspaceMember`, build a `Scope`, call `withScope`. A suspended member gets no scope.
- Suspension also bans the Supabase user and revokes sessions, so it takes effect immediately.
- Capabilities (`can(scope, "contacts.write")`) come from one matrix in `src/lib/permissions.ts` (Phase 1). UI hiding is a convenience only; the database and API enforce.

## 4. Record visibility (Phase 2 contract, fixed now)
- Each contact/account stores `createdById` (never changes), `ownerId`, and assignees in a link table.
- CEO/Admin and Manager see every row in the workspace; Sales/BD and Data Researcher see rows where they are creator, owner or assignee.
- One SQL function `app.can_see(...)` implements this and is used by RLS, search, dashboards, exports and AI retrieval. No second copy of the rule.

## 5. Background work (Phase 3+ contract)
A `Job` table (Postgres queue, `FOR UPDATE SKIP LOCKED`) and a standalone worker (`npm run worker`). Request handlers enqueue; the worker does the work. Jobs carry `workspaceId` and run under `withSystem` + explicit filters.

## 6. API conventions
- Route handlers and server actions validate input with `zod`, call `withScope`, return JSON `{ error, code }` on failure with the right HTTP status.
- Mutating requests from a foreign `Origin` are refused (middleware, Phase 1).
- Webhooks (`/api/webhooks/*`) and cron-style endpoints do their own secret checks and never rely on cookies.
- Secrets (integration credentials, keys) are encrypted at rest with `APP_ENCRYPTION_KEY` and never sent to the browser.

## 7. UI contracts
- Page files export `metadata = { title: "…" }`. A test enforces it.
- Shell: `src/components/shell/*`. Nav entries come from `nav-items.ts`; role filtering from `nav-access.ts` (Phase 1). Every section has a route.
- `ShellUser` (`shell-context.tsx`) is the only user shape client components receive.
- Design rules: [DESIGN.md](DESIGN.md).

## 8. Tests
- `npm test` (Vitest): unit and structural tests, no network.
- `npm run db:test`: workspace isolation against the real database; creates and removes its own rows.
- `npm run typecheck`, `npm run lint`, `npm run build` must pass before any commit that touches `src/`.
