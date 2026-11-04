# Sheraz Action Plan: CodeAutomation CRM

Personal tracker for Sheraz. Tick boxes as work completes (`[ ]` → `[x]`). Detail for each phase lives in [PLAN.md](PLAN.md).

**Status key:** ⬜ not started · 🟦 in progress · ✅ done · ⛔ blocked
**Last updated:** 2026-11-05 (Phase 0 done)

---

## 1. Phase overview

| Phase | Name | Status | Started | Done | Notes |
|---|---|---|---|---|---|
| 0 | Foundation and setup | ✅ | 2026-11-05 | 2026-11-05 | Done. Phase 1 questions: login method, admin email. |
| 1 | Users, roles, permissions, audit | ⬜ | | | |
| 2 | Accounts and contacts | ⬜ | | | |
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
- [ ] Sign in to GitHub as Sheraz-Ilyas when the first push prompts (pick the Sheraz-Ilyas account)
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
- [x] First commit on local branch `phase-0-foundation` (not pushed)
- [x] Exit check: typecheck, lint, 8 tests, build and DB isolation test all pass; shell checked in light, dark and phone width

### Phase 1: Users, roles, permissions, audit
- [ ] User, session, role, team tables
- [ ] Login and session cookies; CSRF origin check
- [ ] Capability matrix for the 4 roles
- [ ] RLS with shared "visible records" rule
- [ ] Admin: create/invite users, change role, suspend, reassign, revoke access
- [ ] Audit log
- [ ] Encrypted integration credential storage
- [ ] Exit check: RLS tests pass for every role

### Phase 2: Accounts and contacts
- [ ] Account and contact schema (creator, owner, assignees, custom fields, suppression)
- [ ] List view with filters, saved views, bulk actions
- [ ] Search that respects visibility
- [ ] Record page with unified timeline, notes, attachments
- [ ] Seed 2M contacts; list and search fast
- [ ] Exit check: scale benchmark documented

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
| 3 | Login method? | Phase 1 | | |
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
