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
await withSystem((tx) => tx.importBatch.findMany(...));                            // background work, sign-in lookups
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
Edit `prisma/schema.prisma`, then run `npm run setup` (push, security rules, isolation test). Log each change in `docs/schema-changes.md`. Schema edits are additive; destructive changes need a written plan.

## 3. Identity and roles (built in Phase 1)
- Supabase Auth proves **who** someone is (`auth.users.id`). It never decides what they may do. Public sign-up is off; accounts are created by an admin.
- `WorkspaceMember` links `userId` (Supabase user id) to a `workspaceId` with a `role` (`ceo_admin | manager | sales_bd | data_researcher`) and `status` (`active | suspended`).
- `currentUser()` (`src/lib/session.ts`) verifies the Supabase session, then loads the active `WorkspaceMember` **from the database on every request** and returns a `Scope`. A suspended or unknown member gets `null`, so suspension is immediate even while their cookie is still valid. Pages call `requireUser()`; route handlers and server actions call `currentUser()`.
- Capabilities come from one matrix in `src/lib/permissions.ts` (`can(role, cap)`, `requireCapability`). Server actions check it first; the database enforces the same rules with RLS. UI hiding (`nav-access.ts`) is a convenience only. The shell layout also blocks a section by URL when the role cannot see it in the menu.
- Member rows: everyone in a workspace can read the member list; only `ceo_admin` can insert, update or delete members (RLS policies `member_*`). The app prevents suspending yourself, changing your own role, or removing the last active CEO/Admin.
- **One-time links:** an admin creates a person with `supabase.auth.admin.generateLink` and passes the link on (`/auth/confirm?token_hash=...&type=invite|recovery`). Opening it verifies the token, signs the person in and sends them to `/set-password`. Links are single-use and expire in about an hour. `npm run admin:link` does the same for the first admin and writes the link to `.invite-links/` (git-ignored) instead of printing it.
- **Audit log** (`AuditLog`): append-only. `crm_app` has `INSERT` and `SELECT` only; `UPDATE`, `DELETE` and `TRUNCATE` are revoked. Any role can insert (via `audit(tx, scope, entry)`, written in the same transaction as the change); only `ceo_admin` and `manager` can read. Never put secrets in `meta`.
- **Integration credentials** (`IntegrationCredential`): AES-256-GCM with `APP_ENCRYPTION_KEY` (`src/lib/crypto.ts`). RLS allows only `ceo_admin` in the same workspace. The `ciphertext` column is never selected into a page and never returned to the browser; the UI shows only provider, label and the last 4 characters (`hint`).
- The secret key (`SUPABASE_SERVICE_ROLE_KEY`) is used only in `src/lib/supabase/admin.ts` and scripts, and must never be imported by client code.

## 4. Record visibility (built in Phase 2)
- `Account` and `Contact` each store `createdById` (never changes), `ownerId` and `assigneeIds`. A database trigger (`app.set_viewers`) keeps `viewerIds` = creator + owner + assignees, so the rule is one indexed array lookup, however large the table.
- CEO/Admin and Manager (`app.sees_all()`) see every row in the workspace. Sales/BD and Data Researcher see rows where `viewerIds` contains their id. Insert requires `createdById = app.user_id()` (no records in someone else's name). Only CEO/Admin and Manager can delete.
- `Activity` (timeline) and `Attachment` follow their record through `app.record_visible()`, which runs as the caller, so the parent's own rules decide. The timeline is append-only and an entry can only be written as yourself.
- `SavedView`: your own plus ones shared in the workspace. `CustomFieldDef`: everyone reads, only CEO/Admin writes.
- **Lists** (`src/lib/records/list.ts`) use raw SQL inside `withScope`: filters, a lower-case `searchText` column with a trigram index, and **keyset paging** (`(sortValue, id)` cursor; never `OFFSET`). Counts stop at 10,000. Row-level security applies to every statement, so no list code decides who may see what.
- **Duplicates:** `@@unique([workspaceId, email])`. A violation is reported only as "a contact with that email already exists", never whose record it is (SPEC R-8.9).
- **Actions** (`src/app/(app)/contacts|accounts|views/actions.ts`): capability check, caller's scope, a timeline entry for every change. Only managers and the CEO/Admin may change owners or delete. Pure validation lives in `src/lib/records/schemas.ts` so tests can load it.
- Sample data (`npm run seed:sample`) is marked `source = "sample-data"` and tagged `sample`; `-- clear` removes exactly those rows.

## 5. Background work
None yet. Imports run inside the upload request and are capped at 500 rows per file (see `src/lib/imports.ts`), so no worker is needed. The `Job` table was removed in Phase 3 (see `schema-changes.md`). When background processing is built (large imports, exports, sync), re-add a queue table with `FOR UPDATE SKIP LOCKED`, run jobs under `withSystem` with explicit `workspaceId` filters, and document it here.

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
