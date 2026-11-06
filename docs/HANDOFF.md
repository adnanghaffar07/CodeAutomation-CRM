# Handoff: CodeAutomation CRM

Read this first. It is the summary of where the project stands and how to pick up work. The tracker is [SHERAZ-ACTION-PLAN.md](SHERAZ-ACTION-PLAN.md); the requirements are [SPEC.md](SPEC.md); the rules every module follows are [CONTRACTS.md](CONTRACTS.md) and [DESIGN.md](DESIGN.md).

## Where things stand (end of Phase 3)

| Phase | Status |
|---|---|
| 0 Foundation | Done |
| 1 Users, roles, permissions, audit | Done and checked in the browser |
| 2 Accounts and contacts (incl. attachments) | Done and checked |
| 3 Imports and data quality | Done and signed off by the owner (2026-11-06). Two items deferred, see below |
| 4 Assignments and work verification | **Next.** Not started |

## Branches and PRs

- Work flow: feature branch → PR into `dev` → later `dev` into `main`. The owner does the `dev` → `main` step.
- Phase 3 branch: `phase-3-imports` (pushed; contains `dev` merged in, so it should show no conflicts).
- PR into `dev`: https://github.com/adnanghaffar07/CodeAutomation-CRM/compare/dev...phase-3-imports
- Git identity: `sheraz-CA`. Commit trailer used: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
- Do not push unless the owner asks. Pushes go through the Terminal panel tool (`mcp__terminal__run_in_terminal`), because GitHub sign-in is interactive. There is no `gh` CLI.

## What Phase 3 delivered

- **Imports** (`/imports`): CSV and Excel (`.xlsx`, first sheet). Steps: choose file → match columns → **Check for duplicates** → review each matching row (Merge or Skip; Merge all / Skip all) → **Import**. Nothing is saved until the final Import.
  - Rows are checked as: new, already in the CRM (visible to you), hidden (matches a record you cannot see; no details shown), repeat (same key earlier in the file), invalid.
  - Merge fills only empty fields of the matched record. Existing values are never overwritten.
  - Companies named in the file are created as accounts (once per name) and contacts link to them.
  - Limits: **500 rows and 2 MB per file**. Measured: 1,000 generated rows took about 43 s locally; 500 about 20 s. Imports run inside the upload request (no worker).
  - Error report download (CSV) for rejected and duplicate rows.
- **Data quality** (`/data-quality`, reached from the Imports page and by URL; not in the sidebar yet): missing-data counts for records the user can see; **merge two contacts** (by email) or **two companies** (by domain). Managers and CEO/Admin only. Merge fills gaps, combines tags, moves contacts (companies), copies timeline entries and attachments, deletes the removed record, and writes an audit entry.
- **Tables:** `ImportBatch`, `ImportRow` (RLS: uploader or manager/CEO; rows follow their batch). `Job` was added and then removed (unused). See `schema-changes.md`.

## Deferred from Phase 3 (not blocking; full list in the tracker)

- Background processing for imports over 500 rows, and the 500k-row exit check. Needs a host that allows long jobs.
- Undo for an import (HANDLL has it).
- Duplicate prompt for similar company names (only exact domain and email matches).
- Merge copies timeline entries and files rather than moving them (the app cannot update `Activity`; copied files show the merging manager as uploader).
- Review screen for records a manager must check (currently "ask a manager").
- Sidebar entry for Data quality.
- Automated isolation test does not cover merge or import duplicates yet.

## Where to look in the code

- Pure rules (parsing, mapping, row checks, keys): `src/lib/imports.ts` (tests: `tests/imports.test.ts`)
- Import logic, bulk writes per page: `src/lib/imports-run.ts`
- Import actions: `src/app/(app)/imports/actions.ts`, `duplicates-actions.ts` (preview, merge a row)
- Import UI: `src/components/imports/` (wizard, review step, duplicate list)
- Merge and data quality: `src/app/(app)/data-quality/` and `src/components/data-quality/`
- Excel reader: `src/lib/spreadsheet.ts` (loaded only when an `.xlsx` is chosen)
- Security rules: `scripts/rls.sql` (Phase 3 section near the end). Isolation checks: `scripts/test-isolation.ts`
- Schema: `prisma/schema.prisma`

## How to run and check

- Dev server: `npm run dev` (http://localhost:3000). Sign in as an active member (the owner tests in the browser; the assistant cannot sign in).
- Checks, in this order:
  1. `npx tsc --noEmit`
  2. `npm run lint`
  3. `npm test`
  4. `npm run db:test` (about 2 minutes; run it in the background)
  5. `NEXT_DIST_DIR=.next-build npx next build`
- Environment gotchas:
  - `npx prisma generate` fails with EPERM while the dev server runs. Stop the dev server first (check for `next dev` processes in the CRM folder), then generate. After a schema change the dev server must be restarted.
  - `npm run build` also runs `prisma generate`; use the `next build` command above when the dev server is running.
  - Long-running commands: run in the background with output to a file. Do not use long `sleep`.
  - Git Bash mangles long multi-line shell heredocs and quotes containing apostrophes; write scripts to files with the Write tool.
  - `.env` and `.env.local` hold secrets. Never print or commit them.
- Test data: the isolation test creates and removes its own workspaces. Imported test records can be removed with the admin connection (`DIRECT_URL`, as in `scripts/test-isolation.ts`); the app role cannot delete `Activity` rows.

## Rules that matter

- Database access only through `withScope` / `withSystem` (`src/lib/scope.ts`). Never import `prisma` in pages or actions.
- New tables need forced RLS in `scripts/rls.sql` (statements separated by `--#`) and checks in `scripts/test-isolation.ts`.
- Log every schema change in `docs/schema-changes.md`.
- Keep pure logic in `src/lib/` so vitest can load it. Importing `src/lib/session.ts` breaks vitest.
- Vercel: request bodies are limited to about 4.5 MB; long work should not run inside a request. Imports stay under the 500-row cap until background processing is built.
- Keep replies short and plain; the owner is not deeply technical.

## Starting Phase 4 (assignments and work verification)

Tracker items (see `SHERAZ-ACTION-PLAN.md`):
- Assign records and batches; task types
- Deadlines, priorities, targets, recurrence, reminders
- Required evidence; submitted / verified / approved states
- Approve, reject, return with comments
- Assignment history; overdue and missing-evidence flags
- Exit check: full lifecycle works for each role

Starting checklist:
1. Read this file, `CONTRACTS.md`, `DESIGN.md`, and the Phase 4 section of `SPEC.md`.
2. `git switch dev` (after the owner has merged the Phase 3 PR), then `git switch -c phase-4-assignments`.
3. Assignment capabilities already exist in `src/lib/permissions.ts` (`assignments.read`, `assignments.manage`). Reuse them.
4. Check with the owner before any Phase 4 decision that changes the workflow (for example, who approves).
