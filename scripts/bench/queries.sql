-- The list queries the app runs, timed as the restricted app role against the 2M-row throwaway database.
-- docker exec ca-bench psql -U postgres -f /queries.sql
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
set role crm_app;
select set_config('app.workspace_id', '11111111-1111-4111-8111-111111111111', false);

\echo === Manager (sees everything) =============================================
select set_config('app.user_id', '00000000-0000-4000-8000-000000000002', false), set_config('app.role', 'manager', false) \gset x_
\echo -- Q1 newest page (50)
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' order by "createdAt" desc, id desc limit 51;
\echo -- Q2 keyset page deep in the list
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and ("createdAt", id) < (now() - interval '365 days', 'ffffffff-ffff-4fff-8fff-ffffffffffff') order by "createdAt" desc, id desc limit 51;
\echo -- Q5 search "lovelace"
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "searchText" ilike '%lovelace%' order by "createdAt" desc, id desc limit 51;
\echo -- Q5b search two words "grace hopper"
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "searchText" ilike '%grace%' and "searchText" ilike '%hopper%' order by "createdAt" desc, id desc limit 51;
\echo -- Q6 search an email fragment
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "searchText" ilike '%example77.com%' order by "createdAt" desc, id desc limit 51;
\echo -- Q7 filters: tag + status + country
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and tags @> array['hot'] and qualification = 'qualified' and country = 'US' order by "createdAt" desc, id desc limit 51;
\echo -- Q9 sorted by name, keyset
explain (analyze, buffers) select id, "fullName", email from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and ("fullName", id) > ('Ken Smith', '00000000-0000-0000-0000-000000000000') order by "fullName", id limit 51;
\echo -- Q10 capped count with filter
explain (analyze, buffers) select count(*) from (select 1 from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and qualification = 'engaged' limit 10001) t;
\echo -- Q11 contacts of one account
explain (analyze, buffers) select id, "fullName" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "accountId" = (select id from "Account" order by id limit 1) order by "createdAt" desc limit 51;
\echo -- Q13 follow-ups due
explain (analyze, buffers) select id, "fullName", "followUpAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "followUpAt" <= now() order by "followUpAt", id limit 51;

\echo === Sales user (sees only own / assigned) ==================================
select set_config('app.user_id', '00000000-0000-4000-8000-000000000003', false), set_config('app.role', 'sales_bd', false) \gset x_
\echo -- S0 how many can this user see
select count(*) from "Contact";
\echo -- S1 newest page (50)
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' order by "createdAt" desc, id desc limit 51;
\echo -- S2 keyset page deep in the list
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and ("createdAt", id) < (now() - interval '365 days', 'ffffffff-ffff-4fff-8fff-ffffffffffff') order by "createdAt" desc, id desc limit 51;
\echo -- S3 search "hopper"
explain (analyze, buffers) select id, "fullName", email, "createdAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "searchText" ilike '%hopper%' order by "createdAt" desc, id desc limit 51;
\echo -- S4 filter by status, sorted by name
explain (analyze, buffers) select id, "fullName" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and qualification = 'engaged' order by "fullName", id limit 51;
\echo -- S5 follow-ups due
explain (analyze, buffers) select id, "fullName", "followUpAt" from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and "followUpAt" <= now() order by "followUpAt", id limit 51;
\echo -- S6 capped count
explain (analyze, buffers) select count(*) from (select 1 from "Contact" where "workspaceId" = '11111111-1111-4111-8111-111111111111' and qualification = 'engaged' limit 10001) t;
