-- Workspace isolation + lock-down. Idempotent: safe to re-run after every `prisma db push`.
-- Statements are separated by a line containing only `--#` (scripts/db-setup.ts splits on it).
-- The role password placeholder below is filled in by the setup script (only when the role is created).

-- Helper functions live in their own schema so PostgREST (which exposes `public`) never publishes them.
create schema if not exists app
--#
create or replace function app.bypass() returns boolean language sql stable as $$
  select coalesce(current_setting('app.bypass', true), '') = 'on' $$
--#
create or replace function app.workspace_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.workspace_id', true), '')::uuid $$
--#
create or replace function app.user_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.user_id', true), '')::uuid $$
--#
create or replace function app.role() returns text language sql stable as $$
  select nullif(current_setting('app.role', true), '') $$
--#
-- The application connects as crm_app: a plain role (not superuser, no BYPASSRLS), so RLS always applies.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'crm_app') then
    create role crm_app login password '__CRM_APP_PASSWORD__' nosuperuser nobypassrls noinherit;
  end if;
end $$
--#
grant usage on schema public to crm_app
--#
grant usage on schema app to crm_app
--#
grant select, insert, update, delete on all tables in schema public to crm_app
--#
grant usage, select on all sequences in schema public to crm_app
--#
alter default privileges in schema public grant select, insert, update, delete on tables to crm_app
--#
-- Nothing in `public` is reachable through the Supabase REST/GraphQL API with the publishable or anon key.
revoke all on all tables in schema public from anon, authenticated
--#
revoke all on all sequences in schema public from anon, authenticated
--#
alter default privileges in schema public revoke all on tables from anon, authenticated
--#
alter default privileges in schema public revoke all on sequences from anon, authenticated
--#
revoke all on all functions in schema app from public, anon, authenticated
--#
grant execute on all functions in schema app to crm_app
--#
-- Workspace: you can only see and change your own workspace.
alter table "Workspace" enable row level security
--#
alter table "Workspace" force row level security
--#
drop policy if exists workspace_isolation on "Workspace"
--#
create policy workspace_isolation on "Workspace" for all to crm_app
  using (app.bypass() or id = app.workspace_id())
  with check (app.bypass() or id = app.workspace_id())
--#
-- WorkspaceMember: everyone in a workspace can read its member list (names for assignees);
-- only the CEO/Admin can add, change or remove members.
alter table "WorkspaceMember" enable row level security
--#
alter table "WorkspaceMember" force row level security
--#
drop policy if exists member_isolation on "WorkspaceMember"
--#
drop policy if exists member_select on "WorkspaceMember"
--#
drop policy if exists member_insert on "WorkspaceMember"
--#
drop policy if exists member_update on "WorkspaceMember"
--#
drop policy if exists member_delete on "WorkspaceMember"
--#
create policy member_select on "WorkspaceMember" for select to crm_app
  using (app.bypass() or "workspaceId" = app.workspace_id())
--#
create policy member_insert on "WorkspaceMember" for insert to crm_app
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
--#
create policy member_update on "WorkspaceMember" for update to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
--#
create policy member_delete on "WorkspaceMember" for delete to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
--#
-- AuditLog: append-only. Read and insert inside your workspace; the app role can never update or delete.
alter table "AuditLog" enable row level security
--#
alter table "AuditLog" force row level security
--#
drop policy if exists audit_select on "AuditLog"
--#
drop policy if exists audit_insert on "AuditLog"
--#
create policy audit_select on "AuditLog" for select to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() in ('ceo_admin', 'manager')))
--#
create policy audit_insert on "AuditLog" for insert to crm_app
  with check (app.bypass() or "workspaceId" = app.workspace_id())
--#
revoke update, delete, truncate on "AuditLog" from crm_app
--#
-- IntegrationCredential: CEO/Admin only, inside their own workspace.
alter table "IntegrationCredential" enable row level security
--#
alter table "IntegrationCredential" force row level security
--#
drop policy if exists credential_admin on "IntegrationCredential"
--#
create policy credential_admin on "IntegrationCredential" for all to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
