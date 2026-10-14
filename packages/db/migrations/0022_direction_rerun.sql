-- 0022: Build-quality Package 1 (2026-10-14): a "direction" job re-runs the direction step alone for a PENDING plan whose
-- direction failed (rehearsal log #3/#9, plan 403305ec was built with no track recommendation). The runner writes the same
-- plan with the new direction as a new pending row that supersedes the old one (the pipeline's one allowed move on
-- plan_approvals, 0011), so plan_approvals itself is unchanged. One direction job per plan at a time.
-- jobs_validate_request is 0021's body plus the 'direction' branch; nothing else changes.

alter table public.jobs drop constraint if exists jobs_kind_check;
alter table public.jobs add constraint jobs_kind_check
  check (kind in ('intake', 'replan', 'direction', 'build_plan', 'resume', 'verify', 'ask'));

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
      if p ? 'siteUrl' and (jsonb_typeof(p->'siteUrl') <> 'string' or p->>'siteUrl' !~* '^https://[^/\s]+/?$' or length(p->>'siteUrl') > 200) then
        raise exception 'jobs(intake): params.siteUrl must be the live site''s https:// address with no path' using errcode = 'check_violation';
      end if;
      if p ? 'logo' and not private.valid_logo_record(p->'logo') then
        raise exception 'jobs(intake): params.logo must be an uploaded SVG, PNG or WebP logo record' using errcode = 'check_violation';
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
    when 'direction' then
      -- Re-run the direction step alone, only before the owner decides (the new pending row supersedes this one).
      if coalesce(p->>'planId', '') !~ uuid_re then
        raise exception 'jobs(direction): params.planId must be a UUID' using errcode = 'check_violation';
      end if;
      if not exists (select 1 from public.plan_approvals where id = (p->>'planId')::uuid and status = 'pending') then
        raise exception 'jobs(direction): plan % is not pending — direction is re-run only before the owner decides', p->>'planId'
          using errcode = 'check_violation';
      end if;
      if exists (
        select 1 from public.jobs j
         where j.kind = 'direction' and j.params->>'planId' = p->>'planId'
           and j.created_at > now() - interval '15 minutes'
           and j.status in ('queued', 'dispatched', 'running')
      ) then
        raise exception 'jobs(direction): direction for this plan is already being re-run' using errcode = 'check_violation';
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
      if p ? 'fromStep' and coalesce(p->>'fromStep', '') not in ('qa', 'revise', 'rebuild') then
        raise exception 'jobs(resume): params.fromStep must be qa, revise or rebuild' using errcode = 'check_violation';
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

  -- One active build per plan and per run (as 0018).
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
            then jsonb_build_object('textChars', length(p->>'text'), 'siteUrl', p->'siteUrl', 'logo', p ? 'logo') else p end));
  return new;
end;
$$;
