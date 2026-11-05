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
--#
-- ───────────────────────── Phase 2: accounts, contacts and everything attached to them ─────────────────────────
-- Visibility (SPEC R-1): CEO/Admin and Manager see every record in their workspace; Sales/BD and Data Researcher see
-- only records they created, own or were assigned. "viewerIds" (creator + owner + assignees) is kept up to date by a
-- trigger, so the rule is one indexed array lookup, however many millions of rows there are.
create or replace function app.sees_all() returns boolean language sql stable as $$
  select coalesce(app.role() in ('ceo_admin', 'manager'), false) $$
--#
create or replace function app.set_viewers() returns trigger language plpgsql as $$
begin
  new."viewerIds" := array(
    select distinct u
    from unnest(array[new."createdById", new."ownerId"] || coalesce(new."assigneeIds", '{}'::uuid[])) as u
    where u is not null
  );
  return new;
end $$
--#
-- True when the caller can see the record a timeline entry or attachment belongs to. Runs as the caller, so the
-- parent table's own row-level security decides.
create or replace function app.record_visible(rtype text, rid uuid) returns boolean language sql stable as $$
  select case rtype
    when 'contact' then exists (select 1 from "Contact" c where c.id = rid)
    when 'account' then exists (select 1 from "Account" a where a.id = rid)
    else false end $$
--#
grant execute on all functions in schema app to crm_app
--#
drop trigger if exists account_viewers on "Account"
--#
create trigger account_viewers before insert or update of "createdById", "ownerId", "assigneeIds" on "Account"
  for each row execute function app.set_viewers()
--#
drop trigger if exists contact_viewers on "Contact"
--#
create trigger contact_viewers before insert or update of "createdById", "ownerId", "assigneeIds" on "Contact"
  for each row execute function app.set_viewers()
--#
-- Account and Contact
alter table "Account" enable row level security
--#
alter table "Account" force row level security
--#
drop policy if exists account_select on "Account"
--#
drop policy if exists account_insert on "Account"
--#
drop policy if exists account_update on "Account"
--#
drop policy if exists account_delete on "Account"
--#
create policy account_select on "Account" for select to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or "viewerIds" @> array[app.user_id()])))
--#
create policy account_insert on "Account" for insert to crm_app
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and "createdById" = app.user_id()))
--#
create policy account_update on "Account" for update to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or "viewerIds" @> array[app.user_id()])))
  with check (app.bypass() or "workspaceId" = app.workspace_id())
--#
create policy account_delete on "Account" for delete to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.sees_all()))
--#
alter table "Contact" enable row level security
--#
alter table "Contact" force row level security
--#
drop policy if exists contact_select on "Contact"
--#
drop policy if exists contact_insert on "Contact"
--#
drop policy if exists contact_update on "Contact"
--#
drop policy if exists contact_delete on "Contact"
--#
create policy contact_select on "Contact" for select to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or "viewerIds" @> array[app.user_id()])))
--#
create policy contact_insert on "Contact" for insert to crm_app
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and "createdById" = app.user_id()))
--#
create policy contact_update on "Contact" for update to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or "viewerIds" @> array[app.user_id()])))
  with check (app.bypass() or "workspaceId" = app.workspace_id())
--#
create policy contact_delete on "Contact" for delete to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.sees_all()))
--#
-- Activity (timeline): visible with its record; anyone who can see the record may add an entry as themselves; append-only.
alter table "Activity" enable row level security
--#
alter table "Activity" force row level security
--#
drop policy if exists activity_select on "Activity"
--#
drop policy if exists activity_insert on "Activity"
--#
create policy activity_select on "Activity" for select to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or app.record_visible("recordType"::text, "recordId"))))
--#
create policy activity_insert on "Activity" for insert to crm_app
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and ("actorId" = app.user_id() or "actorId" is null) and app.record_visible("recordType"::text, "recordId")))
--#
revoke update, delete, truncate on "Activity" from crm_app
--#
-- Attachments: visible with the record; uploader or manager can remove.
alter table "Attachment" enable row level security
--#
alter table "Attachment" force row level security
--#
drop policy if exists attachment_select on "Attachment"
--#
drop policy if exists attachment_insert on "Attachment"
--#
drop policy if exists attachment_delete on "Attachment"
--#
create policy attachment_select on "Attachment" for select to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or app.record_visible("recordType"::text, "recordId"))))
--#
create policy attachment_insert on "Attachment" for insert to crm_app
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and "uploadedById" = app.user_id() and app.record_visible("recordType"::text, "recordId")))
--#
create policy attachment_delete on "Attachment" for delete to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and (app.sees_all() or "uploadedById" = app.user_id())))
--#
-- Saved views: your own, plus ones shared in the workspace.
alter table "SavedView" enable row level security
--#
alter table "SavedView" force row level security
--#
drop policy if exists view_select on "SavedView"
--#
drop policy if exists view_write on "SavedView"
--#
create policy view_select on "SavedView" for select to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and ("ownerId" = app.user_id() or shared)))
--#
create policy view_write on "SavedView" for all to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and "ownerId" = app.user_id()))
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and "ownerId" = app.user_id()))
--#
-- Custom field definitions: everyone reads, only CEO/Admin changes.
alter table "CustomFieldDef" enable row level security
--#
alter table "CustomFieldDef" force row level security
--#
drop policy if exists cfd_select on "CustomFieldDef"
--#
drop policy if exists cfd_write on "CustomFieldDef"
--#
create policy cfd_select on "CustomFieldDef" for select to crm_app
  using (app.bypass() or "workspaceId" = app.workspace_id())
--#
create policy cfd_write on "CustomFieldDef" for all to crm_app
  using (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
  with check (app.bypass() or ("workspaceId" = app.workspace_id() and app.role() = 'ceo_admin'))
