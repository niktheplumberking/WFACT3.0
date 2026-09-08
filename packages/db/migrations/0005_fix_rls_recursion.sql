-- WFACT 3.0 — Phase 2: fix real recursion bug caught by the RLS attack test itself
-- (scripts/rls_attack_test.sql), not by review. "stack depth limit exceeded" on the very first
-- attack query: SECURITY INVOKER `is_owner_or_admin()` reads `profiles`, whose own RLS policy
-- calls `is_owner_or_admin()` again -- Postgres does not guarantee left-to-right short-circuit
-- evaluation of a policy's OR expression, so the planner can recurse into it indefinitely.
--
-- Fix: move the three helper functions to a `private` schema (never exposed by PostgREST -- the
-- project's default exposed-schema list is just `public`), owned by the migration role. Keep them
-- SECURITY DEFINER: because the function owner also owns `profiles`/`profile_clients`, and Postgres
-- exempts a table's owner from its own RLS policies unless FORCE ROW LEVEL SECURITY is set, the
-- internal read inside the function does not re-trigger the calling policy -- no recursion, and the
-- function is no longer reachable as a public RPC endpoint either, which is the fix the original
-- advisor finding (0004) was asking for in the first place.

create schema if not exists private;

-- ---- drop every policy that references the three functions, so they can be dropped/recreated ----
drop policy if exists profiles_select_own_or_privileged on public.profiles;
drop policy if exists profiles_owner_manage             on public.profiles;
drop policy if exists entities_select                    on public.entities;
drop policy if exists entities_owner_write               on public.entities;
drop policy if exists entities_owner_update              on public.entities;
drop policy if exists entities_owner_delete              on public.entities;
drop policy if exists clients_select                     on public.clients;
drop policy if exists clients_owner_write                on public.clients;
drop policy if exists clients_owner_update               on public.clients;
drop policy if exists clients_owner_delete               on public.clients;
drop policy if exists profile_clients_select             on public.profile_clients;
drop policy if exists profile_clients_owner_write        on public.profile_clients;
drop policy if exists profile_clients_owner_update       on public.profile_clients;
drop policy if exists profile_clients_owner_delete       on public.profile_clients;
drop policy if exists projects_select                    on public.projects;
drop policy if exists projects_owner_write               on public.projects;
drop policy if exists projects_owner_update              on public.projects;
drop policy if exists projects_owner_delete              on public.projects;
drop policy if exists tasks_select                       on public.tasks;
drop policy if exists tasks_owner_write                  on public.tasks;
drop policy if exists tasks_owner_update                 on public.tasks;
drop policy if exists tasks_owner_delete                 on public.tasks;
drop policy if exists correction_rounds_select            on public.correction_rounds;
drop policy if exists correction_rounds_owner_write        on public.correction_rounds;

drop function if exists public.current_role_name();
drop function if exists public.is_owner_or_admin();
drop function if exists public.assigned_client_ids();

create function private.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function private.is_owner_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('owner', 'admin') from public.profiles where id = auth.uid()), false);
$$;

create function private.assigned_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profile_clients where profile_id = auth.uid();
$$;

-- No grants to anon/authenticated needed: PostgREST never routes to `private` (not an exposed
-- schema), and policy evaluation calls functions using the table owner's resolution, not a grant
-- check against the connecting role, for functions in a schema the role has USAGE on by default
-- (public grants on schema private are intentionally not given -- only used from within policies).
grant usage on schema private to authenticated, anon;

-- ---- recreate every policy against the private.* functions ----
create policy profiles_select_own_or_privileged on public.profiles
  for select
  using (id = auth.uid() or private.is_owner_or_admin());

create policy profiles_owner_manage on public.profiles
  for all
  using (private.is_owner_or_admin())
  with check (private.is_owner_or_admin());

create policy entities_select on public.entities
  for select
  using (
    private.is_owner_or_admin()
    or id in (select entity_id from public.clients where id in (select private.assigned_client_ids()))
  );
create policy entities_owner_write  on public.entities for insert with check (private.is_owner_or_admin());
create policy entities_owner_update on public.entities for update using (private.is_owner_or_admin());
create policy entities_owner_delete on public.entities for delete using (private.is_owner_or_admin());

create policy clients_select on public.clients
  for select
  using (private.is_owner_or_admin() or id in (select private.assigned_client_ids()));
create policy clients_owner_write  on public.clients for insert with check (private.is_owner_or_admin());
create policy clients_owner_update on public.clients for update using (private.is_owner_or_admin());
create policy clients_owner_delete on public.clients for delete using (private.is_owner_or_admin());

create policy profile_clients_select on public.profile_clients
  for select
  using (private.is_owner_or_admin() or profile_id = auth.uid());
create policy profile_clients_owner_write  on public.profile_clients for insert with check (private.is_owner_or_admin());
create policy profile_clients_owner_update on public.profile_clients for update using (private.is_owner_or_admin());
create policy profile_clients_owner_delete on public.profile_clients for delete using (private.is_owner_or_admin());

create policy projects_select on public.projects
  for select
  using (private.is_owner_or_admin() or client_id in (select private.assigned_client_ids()));
create policy projects_owner_write  on public.projects for insert with check (private.is_owner_or_admin());
create policy projects_owner_update on public.projects for update using (private.is_owner_or_admin());
create policy projects_owner_delete on public.projects for delete using (private.is_owner_or_admin());

create policy tasks_select on public.tasks
  for select
  using (
    private.is_owner_or_admin()
    or project_id in (select id from public.projects where client_id in (select private.assigned_client_ids()))
  );
create policy tasks_owner_write  on public.tasks for insert with check (private.is_owner_or_admin());
create policy tasks_owner_update on public.tasks for update using (private.is_owner_or_admin());
create policy tasks_owner_delete on public.tasks for delete using (private.is_owner_or_admin());

create policy correction_rounds_select on public.correction_rounds
  for select
  using (
    private.is_owner_or_admin()
    or project_id in (select id from public.projects where client_id in (select private.assigned_client_ids()))
  );
create policy correction_rounds_owner_write on public.correction_rounds for insert with check (private.is_owner_or_admin());
