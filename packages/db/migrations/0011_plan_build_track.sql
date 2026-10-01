-- WFACT 3.0 — Factory Completion Plan Step 4B M2: the owner chooses a build track per plan.
-- docs/FRONTEND-UPGRADE-DESIGN.md §4: "The owner picks Track A or Track B (pre-selected to the recommendation,
-- changeable). The choice and whether it overrode the recommendation are stored on the plan and written to
-- audit_log. A build cannot start without a chosen track."
--
-- Append-only. Guarantees enforced HERE, not in the UI:
--   * build_track is a decision field: it can only be set by the approving human, in the same update that
--     approves the plan, and an approval without one is refused;
--   * a rejected or superseded plan never carries a track;
--   * track_overridden is computed by the trigger from the recommendation stored in the (immutable) plan,
--     never accepted from the browser; null when there was no recommendation;
--   * the plan.decision audit row records the track, the recommendation and the override;
--   * a build_plan job is refused unless the plan is approved WITH a track.
-- Plans approved before this migration have no track; the "approved needs a track" check is NOT VALID so
-- they stay readable, but the jobs rule means they cannot be built (re-plan or approve a fresh plan).

alter table public.plan_approvals
  add column if not exists build_track text check (build_track in ('A', 'B')),
  add column if not exists track_overridden boolean;

alter table public.plan_approvals
  add constraint plan_approvals_track_only_when_approved check (build_track is null or status = 'approved'),
  add constraint plan_approvals_approved_needs_track check (status <> 'approved' or build_track is not null) not valid;

comment on column public.plan_approvals.build_track is
  'Step 4B: the owner''s build track (A local-business, B motion-rich), set only with the approval.';
comment on column public.plan_approvals.track_overridden is
  'Set by the decision trigger: true if the owner chose against plan.direction.recommendation.track, null if there was none.';

create or replace function private.plan_approval_decision_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recommended text;
begin
  -- The plan itself and its identity never change after insert.
  if new.plan is distinct from old.plan
     or new.client_slug is distinct from old.client_slug
     or new.entity_slug is distinct from old.entity_slug
     or new.revision is distinct from old.revision
     or new.supersedes is distinct from old.supersedes
     or new.created_at is distinct from old.created_at then
    raise exception 'plan_approvals: only the decision fields can change' using errcode = 'insufficient_privilege';
  end if;

  if old.status <> 'pending' then
    raise exception 'plan_approvals: plan % is already %, decisions are final', old.id, old.status
      using errcode = 'insufficient_privilege';
  end if;

  recommended := old.plan #>> '{direction,recommendation,track}';

  if new.status = 'superseded' then
    -- Only the pipeline (no end-user session) may supersede a pending plan with a re-plan.
    if auth.uid() is not null then
      raise exception 'plan_approvals: only the pipeline can supersede a plan' using errcode = 'insufficient_privilege';
    end if;
    if new.build_track is not null then
      raise exception 'plan_approvals: a superseded plan has no build track' using errcode = 'check_violation';
    end if;
    new.decided_by := null;
    new.decided_at := null;
    new.track_overridden := null;
  elsif new.status in ('approved', 'rejected') then
    if auth.uid() is null then
      raise exception 'plan_approvals: a decision needs a signed-in human' using errcode = 'insufficient_privilege';
    end if;
    if new.status = 'rejected' and coalesce(btrim(new.decision_note), '') = '' then
      raise exception 'plan_approvals: a rejection needs a note — the Planner re-plans from it'
        using errcode = 'check_violation';
    end if;
    if new.status = 'approved' then
      if new.build_track is null then
        raise exception 'plan_approvals: an approval must choose a build track (A or B)' using errcode = 'check_violation';
      end if;
      new.track_overridden := case when recommended is null then null else recommended <> new.build_track end;
    else
      if new.build_track is not null then
        raise exception 'plan_approvals: a rejection does not choose a build track' using errcode = 'check_violation';
      end if;
      new.track_overridden := null;
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
  else
    raise exception 'plan_approvals: invalid status transition % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  insert into public.audit_log (actor, action, outcome, task_id, entity_slug, payload)
  values (
    coalesce(auth.uid()::text, 'pipeline'),
    'plan.decision',
    case new.status when 'approved' then 'success' when 'rejected' then 'rejected' else 'info' end,
    new.id,
    new.entity_slug,
    jsonb_build_object(
      'status', new.status, 'revision', new.revision, 'clientSlug', new.client_slug, 'note', new.decision_note,
      'buildTrack', new.build_track, 'recommendedTrack', recommended, 'trackOverridden', new.track_overridden,
      'recommendationWithheld', old.plan #>> '{direction,recommendation,withheldReason}'
    )
  );
  return new;
end;
$$;

-- The jobs gate: a build needs an approved plan WITH a track. Same function as 0009 otherwise.
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
