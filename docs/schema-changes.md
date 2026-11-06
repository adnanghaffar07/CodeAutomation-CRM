# Schema changes

Log every change to `prisma/schema.prisma` or `scripts/rls.sql` here (newest first): date, what, why. After any change run `npx prisma db push`, `npm run db:setup`, `npm run db:test`.

## 2026-11-06: assignments and work verification (Phase 4)
- Added enums `TaskType`, `Priority`, `Recurrence`, `AssignmentStatus`, `EvidenceKind`.
- Added `AssignmentBatch` (one piece of work: task type, record type, instructions, completion criteria, priority, deadline, repeats, optional target), `Assignment` (one record for one person: status, deadline, submitted and decided times, decision comment), `AssignmentEvidence` (notes and links) and `AssignmentEvent` (append-only history). Foreign keys only from `Assignment` to its batch, and from evidence and history to their assignment; `recordType`/`recordId` point at a Contact or Account without a foreign key, as `Activity` does.
- `scripts/rls.sql` (Phase 4 section): batches are visible to their creator, to managers and the CEO/Admin, and to anyone holding an assignment in them; only managers and the CEO/Admin create them, as themselves. Assignments are visible to managers, the assignee and the assigner; managers create them; the assignee may update their own (the app limits which fields and status moves are allowed, since row-level security cannot check columns). Evidence and history follow their assignment, can be written only as yourself, and are append-only.
- To apply to a database: `npx prisma db push`, then `npm run db:setup`, then `npm run db:test`.
- Why: SPEC R-4.1 to R-4.9, R-1.1, R-5.1.

## 2026-11-06: attachments (Phase 2)
- No table or `rls.sql` changes (the `Attachment` table and its rules already existed). Added the private Storage bucket `attachments` via `scripts/setup-storage.ts` (run by `db:setup`). New isolation checks cover attachment list, insert and delete rules.

## 2026-11-05: Phase 2 (accounts and contacts)
- Enabled the `pg_trgm` extension. Added enums `LeadStatus`, `EmailStatus`, `RecordType`, `ActivityKind`, `ActivitySource`, `CustomFieldType`.
- Added `Account`, `Contact` (both with `viewerIds` kept by a trigger, a `searchText` trigram index, GIN indexes on `viewerIds` and `tags`, and keyset-friendly indexes), `Activity`, `SavedView`, `CustomFieldDef`, `Attachment`.
- `Contact` is unique per workspace and email.
- `scripts/rls.sql`: `app.sees_all()`, `app.set_viewers()` and `app.record_visible()`, triggers on Account and Contact, and policies for all six tables (timeline and attachments follow their record; the timeline is append-only).
- Why: SPEC R-1.1, R-3.1 to R-3.7, R-5.1, R-8.9.
- Scale test (throwaway database, 2,000,000 contacts, scripts in `scripts/bench/`): first pages and follow-up lists in milliseconds; three slow spots recorded in the tracker for Phase 13.

## 2026-11-05: Phase 1 (users, audit, credentials)
- Added `AuditLog` (append-only; indexes on workspace + time and workspace + action) and `IntegrationCredential` (encrypted `ciphertext`, `hint` = last 4 characters; unique per workspace, provider and label).
- `WorkspaceMember` policy split into `member_select` (whole workspace) and insert/update/delete restricted to `ceo_admin`.
- `AuditLog` policies: insert for any member of the workspace, select for `ceo_admin` and `manager`; `UPDATE`, `DELETE`, `TRUNCATE` revoked from `crm_app`.
- `IntegrationCredential` policy: all operations for `ceo_admin` of the same workspace only.
- Why: SPEC R-1.1, R-1.5, R-5.1 and R-7.7.

## 2026-11-05: initial schema (Phase 0)
- Added enums `Role` (`ceo_admin`, `manager`, `sales_bd`, `data_researcher`) and `MemberStatus` (`active`, `suspended`).
- Added `Workspace` (tenant root) and `WorkspaceMember` (Supabase user id + role + status, unique per workspace and user).
- `scripts/rls.sql`: helper functions in schema `app`, role `crm_app`, forced RLS and isolation policies on both tables, privileges revoked from `anon` and `authenticated`.
- Why: establishes workspace isolation before any business data exists.

## Phase 3: imports and background jobs
- Added `ImportBatch` (one uploaded CSV: record type, uploader, column mapping, duplicate mode, status and counts), `ImportRow` (staged rows with their outcome) and `Job` (Postgres work queue, claimed with `FOR UPDATE SKIP LOCKED`).
- `scripts/rls.sql`: batches visible to the uploader and to managers/CEO only, and created only as yourself; staged rows follow their batch; jobs are limited to the workspace (the worker runs as the system).
- Why: SPEC R-8.1 to R-8.7 and CONTRACTS §5 (background work). Additive only.

## Phase 3: remove unused Job table
- Dropped the `Job` table (never used: imports run inside the request now). It was empty.
- `scripts/rls.sql` no longer mentions it; the isolation test no longer checks it.
- Why: keeps the schema to what the code uses; the table can be re-added if background work is ever needed (CONTRACTS section 5).
