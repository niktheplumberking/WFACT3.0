-- WFACT 3.0 — Phase 2: fixes for real findings from get_advisors(security) run against
-- wfact-3-sandbox after migration 0003. Per CLAUDE.md §1: an independent check found these, not the
-- builder's own claim of "done" -- exactly the discipline this repo is supposed to enforce on itself.
--
-- Finding 1 (function_search_path_mutable, WARN): the two trigger functions had no search_path pinned.
-- Finding 2 (anon/authenticated_security_definer_function_executable, WARN): the three RLS helper
-- functions were SECURITY DEFINER *and* publicly callable via PostgREST RPC (every function in the
-- `public` schema is auto-exposed as /rest/v1/rpc/<name>). Fix: switch them to SECURITY INVOKER --
-- each only ever reads the calling user's own profile/assignment rows, which that user's own RLS
-- policies already permit, so invoker semantics are correct and remove the elevated-privilege risk
-- the lint is warning about.

alter function public.enforce_project_entity_matches_client() set search_path = public, pg_temp;
alter function public.enforce_task_entity_matches_project()   set search_path = public, pg_temp;

create or replace function public.current_role_name()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner_or_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((select role in ('owner', 'admin') from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.assigned_client_ids()
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select client_id from public.profile_clients where profile_id = auth.uid();
$$;
