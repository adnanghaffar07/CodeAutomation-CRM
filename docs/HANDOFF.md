# Handoff: CodeAutomation CRM

Read this first. It is the summary of where the project stands and how to pick up work. The tracker is [SHERAZ-ACTION-PLAN.md](SHERAZ-ACTION-PLAN.md); the requirements are [SPEC.md](SPEC.md); the rules every module follows are [CONTRACTS.md](CONTRACTS.md) and [DESIGN.md](DESIGN.md).

## Where things stand (end of Phase 4)

| Phase | Status |
|---|---|
| 0 Foundation | Done |
| 1 Users, roles, permissions, audit | Done and checked in the browser |
| 2 Accounts and contacts (incl. attachments) | Done and checked |
| 3 Imports and data quality | Done and signed off by the owner (2026-11-06) |
| 4 Assignments and work verification | Done (code + tests + PR open). Browser walk-through by owner pending |
| 5 Sales pipeline | **Next.** Not started |

## Branches and PRs

- Work flow: feature branch → PR into `dev` → later `dev` into `main`. The owner does the `dev` → `main` step.
- Phase 4 branch: `phase-4-assignments` (pushed). PR open: https://github.com/adnanghaffar07/CodeAutomation-CRM/pull/new/phase-4-assignments targeting `dev`.
- Phase 5 should start from `dev` after the Phase 4 PR is merged.
- Git identity: `sheraz-CA`. Commit trailer: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- Do not push unless the owner asks. There is no `gh` CLI installed; pushes use `git push` via the terminal.

## What Phase 4 delivered

### Assignment batches (`/tasks/new`, `/tasks/batch/[id]`)
- A batch is one piece of work: task type (Outreach, Research, Calling, Follow-up, Cleaning), record type (contacts or companies), deadline, priority, recurrence (daily/weekly/monthly/none), optional target count, instructions and completion criteria.
- Creating a batch picks records and assigns one person per record.
- Batch detail page shows progress, all assignments in a table, and batch details.

### Individual assignments (`/tasks/[id]`)
- Full status lifecycle: **To do → In progress → On hold → Awaiting approval → Completed** (and Rejected / Returned for changes).
- Assignee clicks **Start work** (slim banner, not a large card), adds evidence (notes or links), then clicks **Submit for approval**.
- Submission runs system checks (evidence present, record visible) and moves status to Awaiting approval automatically.
- Manager/CEO can Approve, Return for changes (with comment), or Reject (with confirm dialog).
- Repeating assignments: approving auto-creates the next round; managers can stop the series.
- History tab records every event (assigned, started, held, resumed, evidence added, submitted, approved, etc.).
- Overdue and Missing evidence flags on both list and detail pages.

### Notifications bell (top-right)
- In-app notifications with an unread count.
- Triggers: assigned → assignee; submitted → all managers/CEO; hold/resume → the other party; approve/return/reject → assignee; reassigned → new assignee.
- Bell polls every 20 s. Assignment pages auto-refresh every 20 s and on tab focus (no manual reload needed).

### Assignments list (`/tasks`)
- **Worker view**: three tiles (To do / In progress / Completed), "My work" table with no redundant Assignee column.
- **Manager/CEO view**: four tiles (To do / In progress / Awaiting approval / Overdue), tabbed table (All / Awaiting approval / Overdue / Missing evidence / Assigned to me).
- Back button (breadcrumb) on task detail and batch detail pages.

### Database and security
- Tables: `AssignmentBatch`, `Assignment`, `AssignmentEvidence`, `AssignmentEvent`, `Notification`.
- Forced RLS on all five tables. 93 isolation checks pass (`npm run db:test`).
- Schema changes logged in `docs/schema-changes.md`.

## Deferred from Phase 4 (not blocking; full list in the tracker)

| Item | Revisit |
|---|---|
| Email or push notifications (in-app bell only today) | Phase 7 or 9 |
| AI check of evidence against completion criteria | Phase 12 |
| Evidence as uploaded files (notes/links only today) | Later |
| Assign directly from a record page | Small follow-up |
| Keyset paging on the assignment list (capped at 200 today) | Phase 13 |
| Bulk approve or return | Later |
| Owner's browser walk-through (exit check) | Owner to do before Phase 5 merge |

## Where to look in the code (Phase 4)

- Pure rules (task types, statuses, flags, next-due-date, zod schemas): `src/lib/assignments.ts` (tests: `tests/assignments.test.ts`)
- Notification helpers: `src/lib/notify.ts`
- Server actions (create batch, start, evidence, submit, review, hold, resume, reassign, stop-repeat): `src/app/(app)/tasks/actions.ts`
- Notification actions (unread count, list, mark read): `src/app/(app)/notifications/actions.ts`
- Action cards (client): `src/components/tasks/assignment-actions.tsx`
- Status badge, flag badges, event labels: `src/components/tasks/bits.tsx`
- Auto-refresh component: `src/components/tasks/auto-refresh.tsx`
- Notifications bell: `src/components/shell/notifications.tsx`
- Pages: `src/app/(app)/tasks/page.tsx`, `tasks/[id]/page.tsx`, `tasks/batch/[id]/page.tsx`, `tasks/new/page.tsx`
- Security rules: `scripts/rls.sql` (Phase 4 and notifications sections). Isolation checks: `scripts/test-isolation.ts`

## How to run and check

- Dev server: `npm run dev` (http://localhost:3000). Sign in as an active member (the owner tests in the browser; the assistant cannot sign in).
- Checks, in this order:
  1. `npx tsc --noEmit`
  2. `npx eslint --no-eslintrc -c .eslintrc.json --ext .ts,.tsx src tests scripts` (use this form — the worktree has a conflicting parent `.eslintrc.json`)
  3. `npx vitest run`
  4. `npm run db:test` (about 2 minutes; run in background)
  5. `NEXT_DIST_DIR=.next-build npx next build`
- Environment gotchas:
  - `npx prisma generate` fails with EPERM while the dev server runs. Stop the dev server first.
  - `npm run build` also runs `prisma generate`; use the `next build` command above when the dev server is running.
  - Git Bash mangles long multi-line heredocs; write scripts to files with the Write tool.
  - `.env` and `.env.local` hold secrets. Never print or commit them.

## Rules that matter

- Database access only through `withScope` / `withSystem` (`src/lib/scope.ts`). Never import `prisma` in pages or actions.
- New tables need forced RLS in `scripts/rls.sql` and checks in `scripts/test-isolation.ts`.
- Log every schema change in `docs/schema-changes.md`.
- Keep pure logic in `src/lib/` so vitest can load it. Importing `src/lib/session.ts` breaks vitest.
- A "use server" file may only export async functions — never export constants or types from them.
- Prisma `create` with `select` needs the SELECT policy to pass on the new row; use `createMany` when the writer may not read back.

## Starting Phase 5 (sales pipeline)

Tracker items (see `SHERAZ-ACTION-PLAN.md`):
- Opportunities and configurable stages
- Kanban and table views
- Stage history, lost reasons, stale alerts, conversion reports
- Exit check: drag between stages writes history

Starting checklist:
1. Owner merges Phase 4 PR (`phase-4-assignments → dev`).
2. `git switch dev && git pull`, then `git switch -c phase-5-pipeline`.
3. Read `SPEC.md` Phase 5 section and `CONTRACTS.md` for any pipeline-specific rules.
4. The pipeline ties to contacts and accounts (Phase 2 tables); use `withScope` for all queries.
5. Confirm with the owner: how many pipeline stages, and are they configurable by the CEO/Admin or hardcoded?

## Machine and data state (as of this handoff, 2026-11-07)

- Branch checked out in the worktree: `phase-4-assignments`, clean (all committed and pushed).
- Last 7 commits on the branch: see `git log --oneline phase-4-assignments ^dev`.
- Database: Phase 4 schema pushed (`AssignmentBatch`, `Assignment`, `AssignmentEvidence`, `AssignmentEvent`, `Notification`). Isolation test last passed at 93 checks.
- Dev server: may or may not be running on port 3000. Check before running `prisma generate`.
- No `gh` CLI on this machine; PRs are opened via the GitHub web UI.
