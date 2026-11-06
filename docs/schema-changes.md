# Schema changes

Log every change to `prisma/schema.prisma` or `scripts/rls.sql` here (newest first): date, what, why. After any change run `npx prisma db push`, `npm run db:setup`, `npm run db:test`.

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
