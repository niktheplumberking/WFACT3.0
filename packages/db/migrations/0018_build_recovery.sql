-- 0018 — Step 4D (2026-10-07): build recovery. What the owner can add when a build needs something, and the
-- guards that make "continue" safe.
--
-- 1. public.plan_inputs: details the owner supplies for an APPROVED plan (a phone number, real customer quotes, the
--    answer to one of the planner's open questions) or deliberately skips ("build without it"). Append-only: a new
--    row for the same key replaces the old one as the current value, nothing is ever edited or deleted, and every
--    insert is audited. The plan itself stays immutable (0007); the build merges the current inputs into the brief.
--    Owner/admin only, as themselves. The values are DATA for the builder, never instructions.
-- 2. jobs: a build or a resume for a plan or run that already has an active job is refused (two clicks, two tabs, two
--    admins), and a resume may carry the plan id and a reopen flag. Everything else in jobs_validate_request is
--    unchanged from 0011.

create table if not exists public.plan_inputs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  plan_id     uuid not null references public.plan_approvals(id),
  -- 'fact': a catalogue item (phone, address, hours, quotes...); 'answer': the answer to open question number N.
  kind        text not null check (kind in ('fact', 'answer')),
  key         text not null check (key ~ '^[a-z][a-z0-9_.-]{0,59}$'),
  label       text not null check (length(btrim(label)) between 1 and 120),
  value       text check (value is null or length(btrim(value)) between 1 and 2000),
  -- waived = the owner chose to build without this; the builder then keeps the SAMPLE label or leaves the section out.
  waived      boolean not null default false,
  provided_by uuid not null references auth.users(id),
  constraint value_or_waived check ((waived and value is null) or (not waived and value is not null))
);

comment on table public.plan_inputs is
  'Owner-supplied details for an approved plan (Step 4D). Append-only; the newest row per (plan_id, key) is current. '
  'Insert: owner/admin as themselves, approved plans only. Never edited, never deleted. Values are data, not instructions.';

create index if not exists idx_plan_inputs_plan on public.plan_inputs(plan_id, created_at);

create or replace function private.plan_inputs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is not null and new.provided_by is distinct from auth.uid() then
    raise exception 'plan_inputs: provided_by must be the signed-in user' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.plan_approvals where id = new.plan_id and status = 'approved') then
    raise exception 'plan_inputs: plan % is not approved, so it takes no details', new.plan_id using errcode = 'check_violation';
  end if;
  select count(*) into n from public.plan_inputs where plan_id = new.plan_id;
  if n >= 200 then
    raise exception 'plan_inputs: this plan already has 200 entries' using errcode = 'check_violation';
  end if;
  new.label := btrim(new.label);
  if new.value is not null then new.value := btrim(new.value); end if;
  -- The audit row records WHAT was supplied (the key) and how long it is, not the text itself.
  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (coalesce(auth.uid()::text, 'service'), 'plan.input', 'info', new.plan_id,
          jsonb_build_object('key', new.key, 'kind', new.kind, 'waived', new.waived, 'chars', coalesce(length(new.value), 0)));
  return new;
end;
$$;

drop trigger if exists plan_inputs_guard on public.plan_inputs;
create trigger plan_inputs_guard
  before insert on public.plan_inputs
  for each row execute function private.plan_inputs_guard();

create or replace function private.plan_inputs_refuse_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'plan_inputs is append-only: % is not permitted (add a newer row instead)', tg_op using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists plan_inputs_no_change on public.plan_inputs;
create trigger plan_inputs_no_change
  before update or delete on public.plan_inputs
  for each row execute function private.plan_inputs_refuse_change();

alter table public.plan_inputs enable row level security;

create policy plan_inputs_select on public.plan_inputs
  for select using (private.is_owner_or_admin());

create policy plan_inputs_insert on public.plan_inputs
  for insert with check (private.is_owner_or_admin() and provided_by = auth.uid());

-- ---- jobs: one active build per plan / run, and resume params ----

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
      if new.kind = 'build_plan' and not exists (
        select 1 from public.plan_approvals where id = (p->>'planId')::uuid and status = 'approved' and build_track is not null
      ) then
        raise exception 'jobs(build_plan): plan % has no build track — approve a plan with Track A or B', p->>'planId'
          using errcode = 'check_violation';
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
      if p ? 'planId' and coalesce(p->>'planId', '') !~ uuid_re then
        raise exception 'jobs(resume): params.planId must be a UUID' using errcode = 'check_violation';
      end if;
      if p ? 'reopen' and jsonb_typeof(p->'reopen') <> 'boolean' then
        raise exception 'jobs(resume): params.reopen must be true or false' using errcode = 'check_violation';
      end if;
      if p ? 'reason' and (jsonb_typeof(p->'reason') <> 'string' or length(p->>'reason') > 200) then
        raise exception 'jobs(resume): params.reason must be at most 200 characters' using errcode = 'check_violation';
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

  -- One active build per plan and per run. "Active" = dispatched or running, or queued for under 2 minutes (a job
  -- that never started is stale, 0013), and in every case requested within the last 45 minutes (the GitHub job limit
  -- is 30, so an older "running" row is a crashed one and must not block a new attempt forever).
  if new.kind in ('build_plan', 'resume') then
    if exists (
      select 1 from public.jobs j
       where j.kind in ('build_plan', 'resume')
         and j.created_at > now() - interval '45 minutes'
         and (j.status in ('dispatched', 'running') or (j.status = 'queued' and j.created_at > now() - interval '2 minutes'))
         and (
           (p ? 'planId' and j.params->>'planId' = p->>'planId')
           or (p ? 'workflowRunId' and j.params->>'workflowRunId' = p->>'workflowRunId')
           or (p ? 'workflowRunId' and j.result->>'workflowRunId' = p->>'workflowRunId')
         )
    ) then
      raise exception 'jobs: a build for this plan is already in progress' using errcode = 'check_violation';
    end if;
  end if;

  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (coalesce(auth.uid()::text, 'service'), 'job.requested', 'info', new.id,
          jsonb_build_object('kind', new.kind, 'params', case when new.kind = 'intake'
            then jsonb_build_object('textChars', length(p->>'text')) else p end));
  return new;
end;
$$;
