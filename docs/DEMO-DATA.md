# Dashboard demo data

The role dashboards on `/` run on a **generated, fictional organisation**, not on the database. The CRM has no pipeline, target or KPI tables yet and too few real records, so this keeps every screen populated without schema changes.

## What is where
| File | Purpose |
|---|---|
| `src/lib/demo/dataset.ts` | **All demo data.** 23 people, 4 teams, ~1,300 tasks, leads, deals, targets, follow-ups, export requests, integrations. Deterministic (fixed seed; dates are offsets from today). Demo ids start with `de000000-0000-4000-8000-`. |
| `src/lib/dashboard/source.ts` | The one place dashboards fetch data (`getDataset()`). |
| `src/lib/dashboard/access.ts` | Which views a role may open and whose data it sees (RBAC). |
| `src/lib/dashboard/metrics.ts` | Every number, computed from the dataset. No per-dashboard hard-coding. |
| `src/lib/dashboard/range.ts` | Today / This week / This month / This quarter (UTC). |
| `src/components/dashboard/` | Charts, shared parts, the five views. |
| `tests/dashboard.test.ts` | Consistency and access tests. |

## Who sees what
- **CEO / Admin**: Executive, Sales and Administration tabs; the whole organisation.
- **Manager**: "My team" (their direct reports); sales managers also get the Sales tab for their team.
- **Sales / BD**: "Sales" (own deals, targets, follow-ups) and "My work". Team figures appear only as one average, no colleagues' names.
- **Data researcher**: "My work" only.

The view is chosen on the server from the signed-in role; an unauthorised `?view=` falls back to the role's default. Because the demo has its own fictional people, a signed-in user is shown as a demo person **of the same role** (stable per user id). Real identities are not mixed into demo numbers.

## Consistency rules (tested)
- Assigned = Completed + Pending + Overdue, in every range.
- Organisation total = sum of employees = sum of teams. A manager's team total equals the same people in the CEO view.
- Quarter revenue on the Executive tab = quarter achievement on the Sales tab = sum of won deals.
- Overdue uses the same rule as the Assignments screen (`flagsFor`).
- Scores: 40% completion, 30% on time, 30% quality on work already due; sales staff: half task score, half pace to the monthly target.

## Replacing or removing it
- **Switch off**: set `DASHBOARD_DEMO_DATA=off`. Dashboards then show an empty state.
- **Replace**: make `getDataset()` return a `Dataset` (same shape as in `dataset.ts`) built from real tables, and map the signed-in user to their real person in `resolveViewer`. No view or metric code changes. Pipeline stages, targets and KPIs will need their own tables first (schema change, log it in `schema-changes.md`).
- **Delete**: remove `src/lib/demo/` and point `source.ts` at the real loader.

No tables, columns or RLS rules were added for this.
