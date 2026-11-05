# Sheraz Action Plan: CodeAutomation CRM

Personal tracker for Sheraz. Tick boxes as work completes (`[ ]` → `[x]`). Detail for each phase lives in [PLAN.md](PLAN.md).

**Project location:** `C:\Users\DELL\Documents\codeautomation\CRM` (from 2026-11-06). Git identity for this repo: `sheraz-CA` / `sheraz@codeautomation.dev`. The older `CodeAutomation-CRM` folder is no longer used.

**Status key:** ⬜ not started · 🟦 in progress · ✅ done · ⛔ blocked
**Last updated:** 2026-11-05 (Phases 0 to 2 done)

---

## 1. Phase overview

| Phase | Name | Status | Started | Done | Notes |
|---|---|---|---|---|---|
| 0 | Foundation and setup | ✅ | 2026-11-05 | 2026-11-05 | Done. Phase 1 questions: login method, admin email. |
| 1 | Users, roles, permissions, audit | ✅ | 2026-11-05 | 2026-11-05 | Done and checked in the browser. Leftovers listed below the Phase 1 checklist. |
| 2 | Accounts and contacts | ✅ | 2026-11-05 | 2026-11-05 | Done and checked. File attachments are the one open item (see Phase 2 leftovers). |
| 3 | Imports and data quality | ⬜ | | | |
| 4 | Assignments and work verification | ⬜ | | | |
| 5 | Sales pipeline | ⬜ | | | |
| 6 | Activity tracking and CEO dashboard | ⬜ | | | |
| 7 | Export approval workflow | ⬜ | | | |
| 8 | Integration framework | ⬜ | | | |
| 9 | Instantly, business email, calendar | ⬜ | | | |
| 10 | RingCentral and LinkedIn | ⬜ | | | |
| 11 | Salesforce connector | ⬜ | | | |
| 12 | AI features | ⬜ | | | |
| 13 | Hardening and pre-deploy readiness | ⬜ | | | |

---

## 2. Before we start (your tasks)

- [x] Git identity set for this repo (Sheraz-Ilyas / maan101011@gmail.com)
- [x] GitHub sign-in worked for the earlier repo (Sheraz-Ilyas). The CRM folder now uses the sheraz-CA identity; sign in with that account on the first push from it
- [x] Confirm Node 20.12+ is installed (Node 22.17)
- [x] Docker: not needed. Using the Supabase cloud project instead (optional later)
- [x] Supabase CLI (installed per project as a dev dependency; run with `npx supabase`)
- [x] Decide auth: **Supabase Auth + Prisma + PostgreSQL + custom RBAC + workspace tenancy**
- [x] Brand: logo supplied; colours taken from it (blue #0A8FFC, yellow #F7E022, black #1E1E1E)
- [ ] Decide login method (email+password, Google SSO, or both)

---

## 3. Phase checklists

### Phase 0: Foundation and setup
- [x] Scaffold Next.js 14.2 / TypeScript / Tailwind project
- [x] Port design system (`globals.css`, `tailwind.config.ts`, `components/ui`) and rebrand to the CodeAutomation logo colours
- [x] Port app shell (side nav, top bar, mobile tab bar, command palette, quick-add, shortcuts)
- [x] Placeholder routes for every section (Dashboard, Contacts, Accounts, Pipeline, Assignments, Imports, Exports, Integrations, Reports, Settings)
- [x] Prisma schema (Workspace, WorkspaceMember), `.env.example`, one-command `npm run setup`
- [x] Typecheck and production build pass
- [x] Database: using the Supabase **cloud** project (Docker is optional; not needed for now)
- [x] `prisma db push`, `crm_app` role, forced RLS, API lock-down and workspace seed (`npm run db:setup`)
- [x] Workspace isolation proven against the real DB (`npm run db:test`: 10 checks pass)
- [x] Docs: SPEC, CONTRACTS, DESIGN, schema-changes
- [x] Removed unused HANDLL files, the local Supabase config and the dev launch file
- [x] Committed and pushed to GitHub on branch `phase-0-foundation` (no default branch on GitHub yet)
- [x] Exit check: typecheck, lint, 8 tests, build and DB isolation test all pass; shell checked in light, dark and phone width

### Phase 1: Users, roles, permissions, audit
- [x] Decisions: email + password sign-in; first admin sheraz@codeautomation.dev; public sign-up switched off in Supabase (2026-11-05)
- [x] Supabase Auth wiring (browser, server and admin clients), session refresh middleware, CSRF origin check
- [x] Sign-in page, sign-out, one-time access links (invite and password reset), set-password page
- [x] Membership checked against the database on every request, so suspension is immediate
- [x] Permission matrix for the 4 roles; role-based sidebar; sections guarded by URL
- [x] Settings: Users (invite, change role, suspend/reinstate, access link), Audit log, Integration credentials
- [x] Audit log is append-only (the app role cannot edit or delete entries)
- [x] Integration credentials encrypted with AES-256-GCM, CEO/Admin only, never sent back to the browser
- [x] Database tests: 25 checks (workspace isolation, roles, audit, credentials); 22 unit tests
- [x] **You:** paste the Supabase **Secret key** into `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (Supabase → Project Settings → API Keys)
- [x] Create your admin (signed in, password set): `npm run admin:link -- sheraz@codeautomation.dev "Sheraz" ceo_admin`, open `.invite-links/sheraz@codeautomation.dev.txt`, follow the link, choose a password
- [x] Checked in the browser (2026-11-05): sign in, credentials, invite, role change, suspend/reinstate, audit log, sign out and in
- [x] Committed and pushed

**Deferred from Phase 1 (leftovers, not blocking)**
| Item | Why deferred | Revisit |
|---|---|---|
| Google sign-in (SSO) | Decided: email + password first | Before go-live, or when a team asks |
| Teams (grouping people for team filters) | Needed by dashboard filters, not by sign-in | Phase 6 |
| Emailed invites and reset emails | No email service yet; admins pass one-time links by hand | When SMTP/Resend is chosen (Phase 9) |
| Self-service "forgot password" page | Needs the email service above | Same as above |
| Two-factor authentication | Not in the feature list | Before go-live decision |
| Sign-in lockout / rate-limit beyond Supabase's own | Supabase already rate-limits sign-in | Phase 13 hardening |
| Failed sign-in attempts in the audit log | Supabase does not tell us who tried | Phase 13 |
| Per-record visibility (creator / owner / assignee) | Needs contact and account tables | Phase 2 |
| Real-time session revoke on suspend | Membership check already blocks the next request; Supabase ban stops new sign-ins | Optional |

### Phase 2: Accounts and contacts
- [x] Database: accounts, contacts, timeline, saved views, custom fields, attachment records; search indexes; visibility trigger (applied to Supabase)
- [x] Visibility rule in the database: CEO/Admin and Manager see everything; Sales/BD and Researcher see records they created, own or were assigned
- [x] Lists for contacts and accounts: search, filters (status, email status, owner, follow-up, industry), sort, keyset paging, capped counts
- [x] Create and edit forms, tags, verified flag, custom fields, owner (managers can reassign)
- [x] Record pages with a timeline: notes, creation, and field-by-field change history
- [x] Bulk actions: set status, assign owner (managers), add tag, delete (managers)
- [x] Saved views (private or shared by managers)
- [x] Settings: custom fields (CEO/Admin)
- [x] Duplicate emails refused without revealing whose record holds them
- [x] Small sample data (24 companies, 80 contacts), removable: `npm run seed:sample -- clear`
- [x] Tests: 47 database checks, 36 unit tests, lint, build
- [x] Checked in the browser by you (7-step checklist, 2026-11-05): all worked
- [x] Committed and pushed (branch `phase-2-contacts-accounts`)

**Deferred from Phase 2 (leftovers, not blocking)**
| Item | Why deferred | Revisit |
|---|---|---|
| File attachments on records | Needs a private Supabase Storage bucket plus signed downloads; the table and rules exist | Next, as part of Phase 2b or with Imports (Phase 3) |
| Editing "assigned users" on a record | Owner reassignment works; multi-person assignment belongs with Assignments | Phase 4 |
| Searchable account picker | The account dropdown lists the first 300 companies by name | When an account list nears 300 |
| Import, duplicate detection and merge | Phase 3 | Phase 3 |
| Deep paging and name-sort speed at millions of rows | A 2M-row test showed 3 slow spots (very deep pages, Sales-user name sort with filters, Sales-user counts); irrelevant at current size | Phase 13 load test |
| Showing the timeline's emails, calls and meetings | Filled by integrations | Phases 9 and 10 |

### Phase 3: Imports and data quality
- [ ] Upload, column mapping, preview, validation
- [ ] Background import via staging table
- [ ] Duplicate detection (in file and existing) without leaking restricted data
- [ ] Controlled updates; batch results and error report
- [ ] Merge tool and missing-data report
- [ ] Exit check: 500k-row import completes in the background

### Phase 4: Assignments and work verification
- [ ] Assign records and batches; task types
- [ ] Deadlines, priorities, targets, recurrence, reminders
- [ ] Required evidence; submitted / verified / approved states
- [ ] Approve, reject, return with comments
- [ ] Assignment history; overdue and missing-evidence flags
- [ ] Exit check: full lifecycle works for each role

### Phase 5: Sales pipeline
- [ ] Opportunities and configurable stages
- [ ] Kanban and table views
- [ ] Stage history, lost reasons, stale alerts, conversion reports
- [ ] Exit check: drag between stages writes history

### Phase 6: Activity tracking and CEO dashboard
- [ ] Append-only activity events (manual vs integration-confirmed)
- [ ] Daily and weekly summaries; flags
- [ ] CEO dashboard with drill-down on every metric
- [ ] Manager and employee dashboards
- [ ] Exit check: every number reconciles with its records

### Phase 7: Export approval workflow
- [ ] Request, approve/reject, frozen scope
- [ ] Re-check authorization at generation; background generation
- [ ] Expiring download links; notifications; full log
- [ ] Exit check: tampered scope refused, expired links fail

### Phase 8: Integration framework
- [ ] Connector interface, field ownership, dedupe, retries
- [ ] Error queue UI and sync status page
- [ ] Webhook intake; suppression applied before outreach
- [ ] CSV/Excel connector wired in
- [ ] Exit check: fake connector passes contract tests

### Phase 9: Instantly, business email, calendar
- [ ] Instantly sync (campaigns, leads, sends, replies, bounces, unsubscribes)
- [ ] Business email linking
- [ ] Calendar and booking sync
- [ ] Exit check: replayed webhooks create no duplicates

### Phase 10: RingCentral and LinkedIn
- [ ] RingCentral calls, extensions, recordings
- [ ] LinkedIn links, tasks, manual evidence
- [ ] Exit check: call attribution matches extensions

### Phase 11: Salesforce connector
- [ ] Answer scope questions (one-way or two-way, objects, sandbox)
- [ ] OAuth connection and field mapping
- [ ] Initial import and ongoing sync
- [ ] Exit check: sandbox round trip with no duplicates

### Phase 12: AI features
- [ ] Access-filtered retrieval; usage ledger and budgets; research cache
- [ ] Reply classification, daily briefing, natural-language questions
- [ ] Transcript summaries, assignment checks, research, drafts, coaching
- [ ] Approval required for send / export / delete / permission changes
- [ ] Exit check: adversarial access tests pass

### Phase 13: Hardening and pre-deploy readiness
- [ ] Load test at 2M contacts / 10M activities
- [ ] Security review; backup and restore drill
- [ ] Mobile and accessibility pass
- [ ] Deployment checklist written

---

## 4. Open questions and decisions

| # | Question | Needed by | Answer | Date |
|---|---|---|---|---|
| 1 | Prisma + own auth vs Supabase Auth? | Phase 0 | Supabase Auth + Prisma + custom RBAC + workspace tenancy | 2026-11-05 |
| 2 | Brand colour and logo? | Phase 0 | Logo supplied; colours from it | 2026-11-05 |
| 3 | Login method? | Phase 1 | Email + password; Google later | 2026-11-05 |
| 4 | Team size and expected contact volume? | Phase 2 | | |
| 5 | Google Workspace or Microsoft 365? Calendar/booking tool? | Phase 9 | | |
| 6 | RingCentral plan has API and recording access? | Phase 10 | | |
| 7 | Salesforce: one-way or two-way, objects, sandbox? | Phase 11 | | |
| 8 | AI provider and monthly budget? | Phase 12 | | |
| 9 | Admin-editable pipeline stages from the start? | Phase 5 | | |

---

## 5. Blockers

| Date | Blocker | Phase | Who can unblock | Resolved |
|---|---|---|---|---|
| | | | | |

---

## 6. Work log

| Date | What was done | Phase | Time spent | Next step |
|---|---|---|---|---|
| | | | | |
