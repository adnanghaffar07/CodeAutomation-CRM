# CodeAutomation Sales & BD CRM: phased build plan

Source requirements: `CodeAutomation_Sales_BD_CRM_Feature_List.md` (12 areas, plus "must be able to connect Salesforce").
Reference project: `../HANDLL` (UI/UX, layout, design system, stack, security pattern).
Database: Supabase (Postgres). Deployment: **none for now**; everything runs locally, but nothing may block a later deploy.

---

## 1. What we take from HANDLL, and what we leave

### Reuse (copy and adapt)
| Area | HANDLL source | Use in the new CRM |
|---|---|---|
| Stack | Next.js 14.2 App Router, React 18, TypeScript, Tailwind 3 + `tailwindcss-animate`, Radix, `cmdk`, `vaul`, `sonner`, `framer-motion`, `@dnd-kit`, `@tanstack/react-table`, `recharts`, `react-hook-form` + `zod`, `papaparse`, `lucide-react`, `next-themes`, Vitest | Same versions, so ported code works unchanged |
| Design system "Quiet Pro v2" | `src/app/globals.css`, `tailwind.config.ts`, `src/components/ui/*`, `docs/DESIGN.md` | Same tokens, density (comfort/compact), light/dark, radii, shadows, motion, primitives. One accent colour, sentence case, surfaces not boxes |
| App shell | `src/components/shell/*` (side nav, top bar, mobile tab bar, command palette, quick-add, notifications, user menu, shortcuts, G-chords) | Same layout and keyboard model; new nav items |
| Data layer pattern | `lib/db.ts`, `lib/scope.ts` (`withScope` / `withSystem`), `scripts/apply-rls.ts`, forced RLS with per-transaction session variables | Same idea, keyed on `workspaceId` instead of `lineId`: backend + database enforce permissions (requirement #1) |
| Permissions | `lib/permissions.ts` capability matrix | Same shape, 4 roles |
| Cross-cutting | `lib/activity.ts`, `audit.ts`, `notify.ts`, `tasks.ts`, `rate-limit.ts`, `crypto.ts` (encrypted credentials), `errors.ts`, `api.ts`, `api-client.ts` | Port and rename |
| Integrations | `lib/instantly/*` (client, events, sync, reconcile, metrics), `lib/email/suppression.ts`, `lib/google/*`, `lib/calendar/*`, webhook + cron route pattern, `docs/INSTANTLY-INTEGRATION.md` | Instantly, email, calendar start from working code |
| AI | `lib/ai/provider.ts` (model-agnostic, "AI draft" until a human accepts), `classify.ts`, `drafting.ts`, `meeting.ts` | Base of the AI phase |
| Docs/tests habit | `docs/SPEC`, `CONTRACTS`, `DESIGN`, tests that enforce design (`ui-paint-guard`, `cn-tokens`, "every page has a title") | Keep the same discipline |
| Dev setup | `scripts/setup-local.sh`, `seed.ts`, `.env.example` | Rewritten for Supabase |

### Leave out (HANDLL-specific, not in our scope)
Two-company "line" theming and `lineId` on every table, escalation ladder and gates, APB, proposals/pricing/rate cards, e-sign, finance/invoices, engagements/deliverables/tickets, roster, conflicts register, the agents prospecting pipeline. The Vercel-specific bits (`vercel.json` crons, `@vercel/blob`) are replaced (see §2).

---

## 2. Key technical decisions (please confirm; defaults are recommended)

1. **DECIDED (2026-11-05): Supabase Auth + Prisma + PostgreSQL + custom RBAC + workspace-based multi-tenancy.**
   - **Supabase Auth** = authentication only (sign-in, sessions, password reset, SSO later, admin ban for instant suspension).
   - **Prisma** = ORM over PostgreSQL; **PostgreSQL** = the database (Supabase local now).
   - **Custom RBAC** = our own `Role` + capability matrix (CEO/Admin, Manager, Sales/BD, Data Researcher), ported from HANDLL's `permissions.ts`.
   - **Workspace-based isolation** = every business row carries `workspaceId`; users belong to a workspace through `WorkspaceMember` (which also holds their role and status). This replaces HANDLL's `lineId`.
   - **How the pieces connect:** the server verifies the Supabase session, loads the user's `WorkspaceMember`, then every query runs inside a transaction that sets `app.user_id`, `app.workspace_id`, `app.role` as session variables. Forced RLS policies read those variables (the same pattern as HANDLL's `withScope`), so permissions are enforced in the database as well as the backend. The app connects as a non-superuser role (`crm_app`) so RLS cannot be bypassed.
   - Record-level visibility (decision 5) is applied inside each workspace, on top of workspace isolation.
2. **Supabase features we do use:** Postgres, Storage (attachments, import files, export files, call recordings; replaces Vercel Blob), `pg_trgm` + full-text search, `pgvector` (AI retrieval, research cache), development runs against a Supabase cloud project (decided 2026-11-05). A local Docker stack was dropped as unused and can be re-added later if offline work is needed.
3. **Background work without Vercel crons.** A `Job` table (Postgres queue, `FOR UPDATE SKIP LOCKED`) plus a small standalone Node worker (`npm run worker`) for imports, exports, sync, AI. A scheduler inside the worker replaces `vercel.json` crons. Runs locally now, runs on any host later.
4. **Scale to 1–2M contacts from day one:** keyset (cursor) pagination, no `OFFSET` on big lists, indexes designed with RLS policies, trigram indexes for search, partitioned or archived `Activity` table, import via staging table + set-based SQL, never row-by-row.
5. **Record visibility model:** every contact/account has `createdBy` (never changes), `owner` (current), and an `assignees` link table. Policy: CEO/Manager see all; Sales/BD and Researcher see rows where they are creator, owner or assignee. The same predicate feeds search, dashboards, APIs, exports and AI retrieval through one shared function so it cannot drift.
6. **DECIDED: Brand from the supplied logo (`public/codeautomation-logo.svg`).** Logo blue `#0A8FFC`, yellow `#F7E022`, black `#1E1E1E`. Because white text on `#0A8FFC` is only ~3.2:1, button fills use a deepened blue `#096FCE` (~5:1) and blue text uses a slightly darker/lighter variant per theme. Yellow is a small chrome accent only (active-nav edge, active icon tile). Tokens live in `src/app/globals.css` (`--brand*`, `--line-accent*`; the `line-accent` names are kept from HANDLL so ported shell classes work, they now mean "workspace accent").
7. **Salesforce:** built as one more connector on the integration framework (Phase 11), not a special case.

---

## 3. Phases

Each phase ends with: working UI + API + RLS + tests, docs updated, and a demo against seeded data. We finish and sign off a phase before starting the next.

### Phase 0: Foundation and project setup
**Goal:** an empty but correct app that looks like HANDLL and talks to Supabase.
- Scaffold Next.js 14.2 / TS / Tailwind in `CodeAutomation-CRM`; same `package.json` stack as HANDLL; `.gitignore`, `.env.example`, lint/typecheck/test scripts.
- Port design system: `globals.css`, `tailwind.config.ts`, `components/ui/*`, theme + density provider, fonts.
- Port app shell with a placeholder nav (Dashboard, Contacts, Accounts, Pipeline, Tasks, Imports, Exports, Integrations, Reports, Settings), command palette, mobile tab bar.
- Supabase (cloud project): `DATABASE_URL` (pooled) + `DIRECT_URL`, app DB role, Prisma setup, RLS script, workspace seed, and one `npm run setup` command.
- Docs: `SPEC.md` (this feature list turned into numbered requirements), `CONTRACTS.md`, `DESIGN.md` (trimmed copy), `schema-changes.md`.
- **Exit:** `npm run setup && npm run dev` shows the shell in light/dark/compact; CI-style `typecheck + lint + test` pass.

### Phase 1: Users, roles, permissions, audit (feature area 1)
- Tables: `Workspace`, `WorkspaceMember` (user id from Supabase Auth, role, status; already in the Phase 0 schema), `Team`. Roles: CEO/Admin, Manager, Sales/BD, Data Researcher.
- Login through **Supabase Auth** (`@supabase/ssr` cookies, admin-invited users, password reset; Google SSO optional), middleware that refreshes the session, CSRF origin check (port `middleware.ts`).
- Workspace isolation: `workspaceId` on every table, RLS policies on `app.workspace_id`; a second workspace in the seed proves a user in A never sees B.
- Capability matrix; `withScope`/`withSystem`; RLS session variables; shared "visible records" predicate (decision 5).
- Admin: invite/create users, change role, **immediate suspension** (kills sessions), reassign, explicit access revoke.
- Audit log (who/what/when/record) used by every later phase.
- Integration credential storage (encrypted, server-side only, CEO/Admin only).
- **Exit:** RLS tests prove each role sees only what it should, including via raw SQL as the app role; suspended user is locked out at once.

### Phase 2: Accounts and contacts (feature area 3)
- Schema: `Account`, `Contact` (many contacts per account), source, creator/owner/assignees, import batch, verification date, LinkedIn URL, domain, industry, size, location, qualification, service interest, next action, follow-up date, tags, custom fields (JSONB with definitions), suppression/DNC/bounce/unsubscribe status.
- Lists: server-side table (`@tanstack/react-table`), advanced filters, saved views, bulk actions, global search (trigram + FTS) that respects visibility.
- Record page in HANDLL style: summary rail + unified timeline (emails, calls, meetings, notes, tasks, field changes), notes, attachments (Supabase Storage).
- **Scale check:** seed 2M synthetic contacts; list, filter and search stay fast (target: first page under ~300 ms).
- **Exit:** CRUD, ownership/creator split, suppression flags, and scale benchmark pass.

### Phase 3: Imports and data quality (feature area 8)
- Upload CSV/XLSX to Storage, column mapping with preview, validation, format checks.
- Background import job through staging table; duplicate detection (within file and against existing) using domain/email/normalised name keys.
- Controlled update of existing records (choose fields to overwrite), batch ID, uploader, source file, accepted/rejected/duplicate/updated counts, downloadable error report (access-controlled).
- Duplicates reveal **only that a duplicate exists**, never another employee's restricted data (security-definer function returns a flag, not the row).
- Dedupe/merge tool for managers; missing-data report.
- **Exit:** 500k-row import completes in the background without blocking the UI; counts reconcile.

### Phase 4: Assignments and work verification (feature area 4)
- Assign single records or batches; task types: research, cleaning, outreach, calling, follow-up.
- Deadline, priority, target, instructions, completion criteria, recurrence, reminders.
- Required evidence/fields before submit; three completion states (employee-submitted, system-verified, manager-approved); approve/reject/return with comments.
- Assignment and reassignment history with reasons; overdue and missing-evidence flags.
- Employee "My work" view and manager review queue.
- **Exit:** full lifecycle works for each role, and RLS stops anyone seeing others' assignments.

### Phase 5: Sales pipeline (feature area 6)
- Opportunities (many per account); configurable stages (Qualified, Discovery, Proposal, Negotiation, Won, Lost).
- Kanban (`@dnd-kit`) and table views; value, owner, expected close, next action, decision makers, proposal attachments.
- Stage-change history, lost reasons, stale-opportunity alerts, conversion reports.
- **Exit:** drag between stages writes history and activity; reports reconcile with the table.

### Phase 6: Activity tracking, performance, and CEO dashboard (feature areas 5 and 2)
- One append-only `Activity` event model: actor, action, record, time, **source** (manual vs integration-confirmed) so the two are never mixed.
- Daily/weekly summaries; flags for missing follow-ups, incomplete submissions, unusual bulk actions.
- Metrics kept separate: activity volume, work quality, business outcomes. Missing integration data shows as a visibility issue, never as inactivity.
- CEO dashboard: all metrics from the feature list, date and team filters, every number clickable to its underlying records and evidence. Built with pre-aggregated rollup tables (not live counts over millions of rows).
- Manager and employee dashboards on the same components, permission-filtered.
- **Exit:** every dashboard number drills down to records that add up to it. Empty states say "No data yet" (HANDLL rule: no modelled numbers).

### Phase 7: Export approval workflow (feature area 9)
- Request (purpose, fields, record scope), CEO approve/reject, exact approved scope frozen, authorization re-checked at generation time.
- Background generation, expiring authenticated download links, notifications on approve/reject/expiry.
- Full log of requester, approver, record count, generation, download; CEO exports logged too.
- Managers and employees can only request; only CEO exports directly.
- **Exit:** a field or scope tampered after approval is refused; expired links fail.

### Phase 8: Integration framework (feature area 7, common part)
- Connector interface: field ownership map (which system controls which field), idempotency keys / dedupe, initial import + ongoing sync, retries with backoff, **error queue UI**, sync status/timestamps, encrypted credentials, webhook intake (validate, store raw, ack, process async).
- Suppression/unsubscribe applied **before** any further outreach.
- Settings → Integrations page with health, last good sync (feeds the CEO dashboard).
- CSV/Excel connector wired in here (import from Phase 3, export from Phase 7).
- **Exit:** a fake connector passes the contract tests (duplicates, retries, ordering, field ownership).

### Phase 9: Instantly and business email/calendar (feature area 7)
- **Instantly** (port `lib/instantly`): campaigns, leads, sends, replies, bounces, unsubscribes, status changes; attribute to the right employee; reconcile job.
- **Business email:** link individual conversations to contacts/opportunities (port Google/Gmail code; Microsoft 365 to confirm which they use).
- **Calendar/booking:** meetings, cancellations, reschedules, owner; booked/held/cancelled/missed feed the dashboard.
- **Exit:** replayed webhooks create no duplicates; bounce/unsubscribe suppresses the contact immediately.

### Phase 10: RingCentral and LinkedIn (feature area 7)
- **RingCentral:** calls, extension-to-employee mapping, timestamps, duration, outcomes, recordings (stored in Storage, access-controlled).
- **LinkedIn:** profile links, outreach tasks, manual evidence capture now; automatic sync only if access is approved (kept behind a flag).
- **Exit:** call attribution matches extensions; missing-extension calls land in an "unassigned" queue.

### Phase 11: Salesforce connector (extra requirement)
- OAuth connection, field mapping UI, initial import of Accounts/Contacts/Leads/Opportunities, ongoing sync, conflict rules (field ownership from Phase 8), Salesforce IDs stored on our records, API-limit aware.
- **Needs clarification first:** one-way import or two-way sync? Which Salesforce objects? Sandbox access?
- **Exit:** round-trip test against a Salesforce sandbox with no duplicates.

### Phase 12: AI features (feature area 10)
- Base: provider layer from HANDLL, per-user access filter on **every** retrieval, AI usage ledger, budgets per user/feature/month, research cache (pgvector + hash cache).
- Order: reply classification and suggested next action → CEO daily briefing → natural-language questions over permitted data → call/transcript summaries and commitments → assignment-vs-evidence checks → account research with sources → duplicate/missing-data suggestions → draft outreach → coaching suggestions.
- Human approval required before AI sends, exports, deletes, or changes permissions (hard rule in code, tested).
- **Exit:** a Sales user's AI question never returns another user's records (adversarial tests); budget cap stops spend.

### Phase 13: Hardening, scale and pre-deploy readiness
- Load test at 2M contacts / 10M activities; query plan review; index and RLS cost review; partition/archive old activity.
- Security review (RLS, CSRF, rate limits, secrets, file access), backups/restore drill on Supabase, observability (structured logs, job dashboard), accessibility and mobile (375px) pass.
- Deployment doc: environment variables, worker process, scheduler, Supabase production settings. (Actual deploy is out of scope for now.)
- **Exit:** all tests green, benchmarks documented, deploy checklist written.

---

## 4. Suggested order of work and dependencies

`0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13`

- Phases 0–2 are the critical path; nothing else works without roles, RLS, and records.
- Phase 6 (dashboard) is intentionally after pipeline and assignments so there is real data to measure, but its event model (`Activity`) is created in Phase 1/2 so nothing has to be backfilled.
- Phase 8 can start earlier in parallel with 5–7 if a second person is available. Phases 9–11 are independent of each other once 8 is done.
- AI (12) is deliberately late: it depends on permissions, activity, and integrations being solid.

## 5. Open questions (answers needed before the phase shown)

| # | Question | Needed by |
|---|---|---|
| 1 | ~~Auth approach~~ Decided: Supabase Auth + Prisma + custom RBAC + workspace tenancy | done |
| 2 | ~~Brand~~ Decided: colours taken from the supplied logo | done |
| 3 | Login method: email+password, Google Workspace SSO, or both? | Phase 1 |
| 4 | Team size and rough counts (users, expected contacts per month)? | Phase 2 |
| 5 | Business email: Google Workspace or Microsoft 365? Calendar/booking tool name (Google Calendar, Calendly, other)? | Phase 9 |
| 6 | Is RingCentral on a plan with API and recording access? | Phase 10 |
| 7 | Salesforce: one-way or two-way, which objects, sandbox available? | Phase 11 |
| 8 | AI provider/budget (default Anthropic, monthly cap)? | Phase 12 |
| 9 | Do pipeline stages need to be admin-editable from the start? | Phase 5 |
