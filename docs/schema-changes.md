# Schema changes

Log every change to `prisma/schema.prisma` or `scripts/rls.sql` here (newest first): date, what, why. After any change run `npx prisma db push`, `npm run db:setup`, `npm run db:test`.

## 2026-11-05: initial schema (Phase 0)
- Added enums `Role` (`ceo_admin`, `manager`, `sales_bd`, `data_researcher`) and `MemberStatus` (`active`, `suspended`).
- Added `Workspace` (tenant root) and `WorkspaceMember` (Supabase user id + role + status, unique per workspace and user).
- `scripts/rls.sql`: helper functions in schema `app`, role `crm_app`, forced RLS and isolation policies on both tables, privileges revoked from `anon` and `authenticated`.
- Why: establishes workspace isolation before any business data exists.
