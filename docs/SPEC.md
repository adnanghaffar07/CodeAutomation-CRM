# CodeAutomation CRM: specification

Source: `CodeAutomation_Sales_BD_CRM_Feature_List.md`, plus the requirement to connect Salesforce.
Each requirement has a stable id (cited in code comments, tests and commits as `§R-4.2`). **Where this file and the code disagree, fix one of them in the same change.** Build order is in [PLAN.md](PLAN.md); progress is in [SHERAZ-ACTION-PLAN.md](SHERAZ-ACTION-PLAN.md).

**Purpose.** A centralized CRM for sales and business development that gives the CEO visibility into assignments, verified team activity, prospect data, pipeline progress and results. Designed for 1–2 million contact records within 1–2 years, with controlled infrastructure and AI costs.

**Principles**
- P1. Permissions are enforced in the backend **and** the database, never only in the UI.
- P2. Every number on screen comes from real records and drills down to them. No modelled figures; empty states say "No data yet".
- P3. Activity, work quality and business outcomes are measured separately.
- P4. Missing integration data is a visibility problem, never proof of inactivity.
- P5. Anything destructive or outward-facing by AI needs human approval.

---

## 1. Users, roles and permissions (§R-1)

| Role | Data access | Management | Export |
|---|---|---|---|
| CEO / Admin (`ceo_admin`) | All records and activities in the workspace | Users, assignments, settings, integrations, approvals | Directly |
| Manager (`manager`) | All records and activities | Assign work, review submissions, manage pipeline | Request CEO approval |
| Sales / BD (`sales_bd`) | Records they created or were assigned | Update permitted records, complete assignments | Request CEO approval |
| Data Researcher (`data_researcher`) | Records they created or were assigned | Add, research, clean, update permitted data | Request CEO approval |

- R-1.1 Permissions are enforced in the backend and the database (row-level security).
- R-1.2 Permissions apply to search, dashboards, attachments, APIs, exports and AI responses.
- R-1.3 A record's creator is stored separately from its current owner and assigned users.
- R-1.4 Reassignment, explicit access revocation and **immediate** account suspension are supported.
- R-1.5 Integration credentials and admin settings are restricted to authorized users (CEO/Admin).
- R-1.6 Data is isolated per **workspace** (multi-tenancy); no query can cross workspaces.

## 2. CEO dashboard (§R-2)

- R-2.1 Overall sales and BD performance.
- R-2.2 Employee performance with date and team filters.
- R-2.3 Assigned, completed, overdue, blocked and unverified tasks.
- R-2.4 Leads added, researched, validated, assigned and contacted.
- R-2.5 Emails sent, replies, positive replies, calls, connected calls.
- R-2.6 Meetings booked, held, cancelled, missed.
- R-2.7 Qualified opportunities, proposals, pipeline value, won/lost deals.
- R-2.8 Prospects awaiting follow-up.
- R-2.9 Pending export approvals.
- R-2.10 Integration health and last successful synchronization.
- R-2.11 Every metric is clickable and opens its underlying records and evidence.

## 3. Contacts and accounts (§R-3)

- R-3.1 Separate company/account and contact records; many contacts per account.
- R-3.2 Store contact details, job titles, domains, locations, industries, company sizes, LinkedIn URLs.
- R-3.3 Store source, creator, owner, assigned users, import batch, verification date.
- R-3.4 Tags, custom fields, saved views, advanced filters, bulk actions.
- R-3.5 A unified timeline of emails, calls, meetings, notes, tasks and changes.
- R-3.6 Track qualification, service interest, next action, follow-up date.
- R-3.7 Track unsubscribe, do-not-contact, bounce and suppression status.

## 4. Assignments and work verification (§R-4)

- R-4.1 Assign individual records or batches to employees.
- R-4.2 Task types: research, cleaning, outreach, calling, follow-up.
- R-4.3 Deadlines, priorities, targets, instructions, completion criteria.
- R-4.4 Recurring assignments and reminders.
- R-4.5 Evidence or required fields before submission.
- R-4.6 Three completion states: employee-submitted, system-verified, manager-approved.
- R-4.7 Managers approve, reject or return work with comments.
- R-4.8 Assignment history and reassignment reasons are preserved.
- R-4.9 Overdue work and assignments with missing evidence are flagged.

## 5. Team activity and performance (§R-5)

- R-5.1 Record who performed each action, when, and on which record.
- R-5.2 Track creation, edits, assignments, imports, exports and stage changes.
- R-5.3 Attribute synchronized emails and calls to the correct employee.
- R-5.4 Manually logged activity is kept apart from integration-confirmed activity.
- R-5.5 Daily and weekly activity summaries.
- R-5.6 Activity volume, work quality and business outcomes are measured separately.
- R-5.7 Flag missing follow-ups, incomplete submissions and unusual bulk actions.
- R-5.8 Missing integration data is shown as a visibility issue, not inactivity.

## 6. Sales pipeline (§R-6)

- R-6.1 Configurable stages: Qualified, Discovery, Proposal, Negotiation, Won, Lost.
- R-6.2 Kanban and table views.
- R-6.3 Deal value, responsible salesperson, expected close date, next action.
- R-6.4 Proposal attachments and decision-maker information.
- R-6.5 Stage-change history and lost-deal reasons.
- R-6.6 Stale-opportunity alerts and conversion reports.
- R-6.7 Multiple opportunities against one account.

## 7. Integrations (§R-7)

| Tool | Required |
|---|---|
| Instantly | Sync campaigns, leads, sends, replies, bounces, unsubscribes, supported status changes |
| RingCentral | Sync calls, extensions, timestamps, duration, outcomes, available recordings |
| LinkedIn | Store profile links, assign outreach tasks, record manual evidence; automatic sync only if access is approved |
| Business email | Link relevant individual conversations to contacts and opportunities |
| Calendar / booking | Sync meetings, cancellations, reschedules, meeting ownership |
| CSV / Excel | Import contacts/accounts, export approved datasets |
| Salesforce | Connect and sync (scope to be confirmed: direction, objects, sandbox) |

Applies to every integration:
- R-7.1 Define which system controls each synchronized field.
- R-7.2 Prevent duplicate records and activities.
- R-7.3 Initial import and ongoing synchronization.
- R-7.4 Retry failures; provide an error queue.
- R-7.5 Show sync status, timestamps and errors.
- R-7.6 Apply unsubscribe/suppression updates before further outreach.
- R-7.7 Credentials encrypted and server-side only.

## 8. Imports and data quality (§R-8)

- R-8.1 CSV/XLSX upload with field mapping and preview.
- R-8.2 Validate required fields and formats.
- R-8.3 Detect duplicates within the upload and against existing records.
- R-8.4 Controlled updates to existing records.
- R-8.5 Record uploader, source file, batch id and import results.
- R-8.6 Large imports run in the background.
- R-8.7 Accepted, rejected, duplicate and updated counts.
- R-8.8 Downloadable error reports, subject to access control.
- R-8.9 Duplicate detection must never reveal another employee's restricted data.

## 9. Export approval workflow (§R-9)

- R-9.1 Employees request exports with purpose, selected fields and record scope.
- R-9.2 The CEO approves or rejects.
- R-9.3 The exact approved scope is preserved.
- R-9.4 Authorization is re-checked when the export is generated.
- R-9.5 Exports are generated in the background.
- R-9.6 Expiring, authenticated download links.
- R-9.7 Log requester, approver, record count, generation and download.
- R-9.8 Notify the requester of approval, rejection or expiry.
- R-9.9 CEO exports are logged too.

## 10. AI features (§R-10)

- R-10.1 CEO daily briefing: progress, risks, opportunities, decisions needed.
- R-10.2 Natural-language CRM questions.
- R-10.3 Reply classification and suggested follow-up actions.
- R-10.4 Call/transcript summaries and extracted commitments.
- R-10.5 Assignment checks against completion criteria and evidence.
- R-10.6 Source-linked account research and qualification suggestions.
- R-10.7 Duplicate and missing-data suggestions.
- R-10.8 Draft outreach messages and follow-ups.
- R-10.9 Employee coaching suggestions based on recorded work.
- R-10.10 Human approval before AI sends messages, exports data, deletes records or changes permissions.
- R-10.11 User access rules apply to every AI retrieval and response.
- R-10.12 AI budgets, usage reporting and research caching.

## 11. Non-functional requirements (§R-11)

- R-11.1 **Scale:** 1–2 million contacts within 1–2 years; lists use keyset pagination, never `OFFSET` on large tables.
- R-11.2 Heavy work (imports, exports, sync, AI) runs in background jobs, never in a request.
- R-11.3 Infrastructure and AI costs are controlled (budgets, caching, rollup tables for dashboards).
- R-11.4 Works at 375 px wide (phones); WCAG AA contrast; keyboard shortcuts for search, quick-add, navigation.
- R-11.5 Not deployed yet; nothing may block a later deploy (config via env, no host-specific code).

## 12. Out of scope for now

Deployment, billing, a public API, native mobile apps.
