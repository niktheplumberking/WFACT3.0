-- WFACT 3.0 — Phase 2: Row Level Security.
-- Three roles (Ecosystem Blueprint §9): owner sees everything; admin sees operational data (this
-- migration does not yet build cost/margin tables, so admin == owner for now at the row level --
-- revisit column-level restriction once a cost table exists); pm sees only clients assigned to them
-- via profile_clients, cascading down to projects/tasks/correction_rounds under those clients.
-- Isolation here is the exact thing the RLS attack test (scripts/rls_attack_test.sql) verifies.

alter table public.entities          enable row level security;
alter table public.profiles          enable row level security;
alter table public.profile_clients   enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.tasks             enable row level security;
alter table public.correction_rounds enable row level security;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role in ('owner', 'admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.assigned_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profile_clients where profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- profiles: everyone can read their own row; owner/admin can read all.
-- ---------------------------------------------------------------------------
create policy profiles_select_own_or_privileged on public.profiles
  for select
  using (id = auth.uid() or public.is_owner_or_admin());

create policy profiles_owner_manage on public.profiles
  for all
  using (public.is_owner_or_admin())
  with check (public.is_owner_or_admin());

-- ---------------------------------------------------------------------------
-- entities: owner/admin full visibility; pm sees only entities behind their assigned clients.
-- ---------------------------------------------------------------------------
create policy entities_select on public.entities
  for select
  using (
    public.is_owner_or_admin()
    or id in (select entity_id from public.clients where id in (select public.assigned_client_ids()))
  );

create policy entities_owner_write on public.entities
  for insert with check (public.is_owner_or_admin());
create policy entities_owner_update on public.entities
  for update using (public.is_owner_or_admin());
create policy entities_owner_delete on public.entities
  for delete using (public.is_owner_or_admin());

-- ---------------------------------------------------------------------------
-- clients: owner/admin full visibility; pm only their assigned clients. This is the core boundary
-- the attack test targets -- a pm scoped to client A must never read client B's row.
-- ---------------------------------------------------------------------------
create policy clients_select on public.clients
  for select
  using (public.is_owner_or_admin() or id in (select public.assigned_client_ids()));

create policy clients_owner_write on public.clients
  for insert with check (public.is_owner_or_admin());
create policy clients_owner_update on public.clients
  for update using (public.is_owner_or_admin());
create policy clients_owner_delete on public.clients
  for delete using (public.is_owner_or_admin());

-- ---------------------------------------------------------------------------
-- profile_clients: owner/admin manage assignments; a pm can read their own assignment rows.
-- ---------------------------------------------------------------------------
create policy profile_clients_select on public.profile_clients
  for select
  using (public.is_owner_or_admin() or profile_id = auth.uid());

create policy profile_clients_owner_write on public.profile_clients
  for insert with check (public.is_owner_or_admin());
create policy profile_clients_owner_update on public.profile_clients
  for update using (public.is_owner_or_admin());
create policy profile_clients_owner_delete on public.profile_clients
  for delete using (public.is_owner_or_admin());

-- ---------------------------------------------------------------------------
-- projects: cascades from clients.
-- ---------------------------------------------------------------------------
create policy projects_select on public.projects
  for select
  using (public.is_owner_or_admin() or client_id in (select public.assigned_client_ids()));

create policy projects_owner_write on public.projects
  for insert with check (public.is_owner_or_admin());
create policy projects_owner_update on public.projects
  for update using (public.is_owner_or_admin());
create policy projects_owner_delete on public.projects
  for delete using (public.is_owner_or_admin());

-- ---------------------------------------------------------------------------
-- tasks: cascades from projects -> clients.
-- ---------------------------------------------------------------------------
create policy tasks_select on public.tasks
  for select
  using (
    public.is_owner_or_admin()
    or project_id in (
      select id from public.projects where client_id in (select public.assigned_client_ids())
    )
  );

create policy tasks_owner_write on public.tasks
  for insert with check (public.is_owner_or_admin());
create policy tasks_owner_update on public.tasks
  for update using (public.is_owner_or_admin());
create policy tasks_owner_delete on public.tasks
  for delete using (public.is_owner_or_admin());

-- ---------------------------------------------------------------------------
-- correction_rounds: cascades from projects -> clients. Read-mostly; written by the verification
-- loop (service role), not by end users, so no pm insert/update/delete policy is defined.
-- ---------------------------------------------------------------------------
create policy correction_rounds_select on public.correction_rounds
  for select
  using (
    public.is_owner_or_admin()
    or project_id in (
      select id from public.projects where client_id in (select public.assigned_client_ids())
    )
  );

create policy correction_rounds_owner_write on public.correction_rounds
  for insert with check (public.is_owner_or_admin());
