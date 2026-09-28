-- WFACT 3.0 — Cockpit-triggered jobs (every pipeline action from the Cockpit, 2026-09-28).
-- Blueprint §14 "Task queue: Yes" (seeded minimally) + §2 "Cockpit displays and gates, it does not
-- compute the work": the Cockpit only INSERTS a job request; a worker holding the secrets (GitHub
-- Actions, .github/workflows/cockpit-job.yml, via the dispatch-job Edge Function) executes it with the
-- same pipeline code the CLIs use, and writes the result back here.
--
-- Enforced here, not in the UI:
--   * only owner/admin can request a job, only as themselves, only in status 'queued';
--   * params are validated per kind (types, lengths, UUID shapes) BEFORE a worker ever sees them —
--     no free text reaches a shell (the worker receives only the job id);
--   * a build can only be requested for a plan that is already owner-APPROVED;
--   * only the service role (dispatcher / worker) moves status forward; no deletes; every request
--     is audited.

create table if not exists public.jobs (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  created_by    uuid not null references auth.users(id),
  kind          text not null check (kind in ('intake', 'replan', 'build_plan', 'resume', 'verify', 'ask')),
  params        jsonb not null default '{}'::jsonb,
  status        text not null default 'queued' check (status in ('queued', 'dispatched', 'running', 'succeeded', 'failed')),
  dispatched_at timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  result        jsonb,
  error         text,
  gh_run_url    text
);

comment on table public.jobs is
  'Cockpit-requested pipeline jobs. Insert: owner/admin (queued, as themselves, params validated). '
  'Progress: service role only (dispatch-job Edge Function + GitHub Actions runner). No deletes.';

create index if not exists idx_jobs_created on public.jobs(created_at desc);
create index if not exists idx_jobs_status on public.jobs(status) where status in ('queued', 'dispatched', 'running');

-- ---- request validation (insert) ----
create or replace function private.jobs_validate_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  p jsonb := new.params;
begin
  if auth.uid() is not null then
    -- A browser request: always as yourself, always a fresh queued job.
    if new.created_by is distinct from auth.uid() then
      raise exception 'jobs: created_by must be the requesting user' using errcode = 'insufficient_privilege';
    end if;
    if new.status <> 'queued' or new.result is not null or new.started_at is not null or new.gh_run_url is not null then
      raise exception 'jobs: a request can only be created as a fresh queued job' using errcode = 'insufficient_privilege';
    end if;
  end if;

  if jsonb_typeof(p) <> 'object' then
    raise exception 'jobs: params must be an object' using errcode = 'check_violation';
  end if;

  case new.kind
    when 'intake' then
      if jsonb_typeof(p->'text') <> 'string' or length(btrim(p->>'text')) = 0 or length(p->>'text') > 20000 then
        raise exception 'jobs(intake): params.text must be 1-20000 characters' using errcode = 'check_violation';
      end if;
    when 'replan', 'build_plan' then
      if coalesce(p->>'planId', '') !~ uuid_re then
        raise exception 'jobs(%): params.planId must be a UUID', new.kind using errcode = 'check_violation';
      end if;
      if new.kind = 'build_plan' and not exists (
        select 1 from public.plan_approvals where id = (p->>'planId')::uuid and status = 'approved'
      ) then
        raise exception 'jobs(build_plan): plan % is not owner-approved', p->>'planId' using errcode = 'check_violation';
      end if;
      if new.kind = 'replan' and not exists (
        select 1 from public.plan_approvals where id = (p->>'planId')::uuid and status = 'rejected'
      ) then
        raise exception 'jobs(replan): plan % is not rejected', p->>'planId' using errcode = 'check_violation';
      end if;
    when 'resume' then
      if coalesce(p->>'workflowRunId', '') !~ uuid_re then
        raise exception 'jobs(resume): params.workflowRunId must be a UUID' using errcode = 'check_violation';
      end if;
    when 'verify' then
      if coalesce(p->>'path', '') !~ '^clients/[a-z][a-z0-9-]*/pages/[a-z0-9-]+\.html$' then
        raise exception 'jobs(verify): params.path must be clients/<slug>/pages/<name>.html' using errcode = 'check_violation';
      end if;
      if jsonb_typeof(p->'goal') <> 'string' or length(btrim(p->>'goal')) = 0 or length(p->>'goal') > 1000 then
        raise exception 'jobs(verify): params.goal must be 1-1000 characters' using errcode = 'check_violation';
      end if;
      if p ? 'sections' and (jsonb_typeof(p->'sections') <> 'array' or jsonb_array_length(p->'sections') > 30) then
        raise exception 'jobs(verify): params.sections must be an array of at most 30 ids' using errcode = 'check_violation';
      end if;
    when 'ask' then
      if jsonb_typeof(p->'question') <> 'string' or length(btrim(p->>'question')) = 0 or length(p->>'question') > 500 then
        raise exception 'jobs(ask): params.question must be 1-500 characters' using errcode = 'check_violation';
      end if;
  end case;

  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (coalesce(auth.uid()::text, 'service'), 'job.requested', 'info', new.id,
          jsonb_build_object('kind', new.kind, 'params', case when new.kind = 'intake'
            then jsonb_build_object('textChars', length(p->>'text')) else p end));
  return new;
end;
$$;

drop trigger if exists jobs_validate_request on public.jobs;
create trigger jobs_validate_request
  before insert on public.jobs
  for each row execute function private.jobs_validate_request();

-- ---- progress guard (update): forward-only, request fields frozen ----
create or replace function private.jobs_progress_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rank_old int := array_position(array['queued','dispatched','running','succeeded','failed'], old.status);
  rank_new int := array_position(array['queued','dispatched','running','succeeded','failed'], new.status);
begin
  if new.kind is distinct from old.kind or new.params is distinct from old.params
     or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'jobs: the request itself is immutable' using errcode = 'insufficient_privilege';
  end if;
  if old.status in ('succeeded', 'failed') then
    raise exception 'jobs: job % already finished (%)', old.id, old.status using errcode = 'insufficient_privilege';
  end if;
  if rank_new < rank_old then
    raise exception 'jobs: status can only move forward (% -> %)', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_progress_guard on public.jobs;
create trigger jobs_progress_guard
  before update on public.jobs
  for each row execute function private.jobs_progress_guard();

drop trigger if exists jobs_no_delete on public.jobs;
create trigger jobs_no_delete
  before delete on public.jobs
  for each row execute function private.audit_log_refuse_mutation();

-- ---- RLS ----
alter table public.jobs enable row level security;

create policy jobs_select on public.jobs
  for select using (private.is_owner_or_admin());

create policy jobs_request on public.jobs
  for insert
  with check (private.is_owner_or_admin() and created_by = auth.uid() and status = 'queued');

-- No update/delete policy for anon/authenticated: only the service role advances a job.

-- ---- artifact store (Blueprint §14): durable home for built pages, private ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artifacts', 'artifacts', false, 2097152, array['text/html'])
on conflict (id) do nothing;

create policy artifacts_owner_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'artifacts' and private.is_owner_or_admin());
-- No insert/update/delete policy for browser roles: only the worker (service role) writes artifacts.
