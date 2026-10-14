-- 0021 — Intake logo and live address, and "continue from a chosen step" (2026-10-14, Huraira's GO on the D4 Tier 2
-- intake slice). Found by the Step 25 rehearsal: intake could not take a logo file, so the builder wrote a text
-- wordmark and the evaluator failed the build on it in 3 of 3 rounds (run 4c35703b, about $1.50 wasted).
--
-- 1. storage bucket `client-assets`: private, 512 KB per object, SVG/PNG/WebP only. An owner/admin uploads into their
--    OWN folder only (uploads/<their user id>/<sha256>.<ext>, content-addressed), reads are owner/admin, nothing is
--    ever updated or deleted by a browser role. The build reads with the service role and re-checks the bytes against
--    the fingerprint in the brief (packages/frontend-loop/src/brandAsset.ts), so a swapped file is refused.
-- 2. artifacts bucket: image/webp added (a WebP logo ships inside the built site). Nothing else changes there.
-- 3. plan_inputs: two keys get a shape check, so a bad value is refused when it is typed, not when a paid build reads
--    it: `asset.logo` (the logo record, pointing at an object that exists in client-assets) and `site_url` (https origin).
-- 4. jobs: intake may carry `siteUrl` and `logo`; a resume may carry `fromStep` (qa | revise | rebuild). Everything
--    else in jobs_validate_request is unchanged from 0018 (including the one-active-build guard).
-- Attack test: scripts/rls_attack_test_brand_assets.sql.

-- ---- 1. client-assets bucket ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-assets', 'client-assets', false, 524288, array['image/svg+xml', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 524288, allowed_mime_types = array['image/svg+xml', 'image/png', 'image/webp'];

drop policy if exists client_assets_insert on storage.objects;
create policy client_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-assets'
    and private.is_owner_or_admin()
    and name ~ ('^uploads/' || auth.uid()::text || '/[0-9a-f]{64}\.(svg|png|webp)$')
  );

drop policy if exists client_assets_select on storage.objects;
create policy client_assets_select on storage.objects
  for select to authenticated
  using (bucket_id = 'client-assets' and private.is_owner_or_admin());

-- ---- 2. artifacts: WebP ----
update storage.buckets
set allowed_mime_types = array[
  'text/html', 'application/json', 'text/css', 'text/javascript', 'text/plain',
  'image/svg+xml', 'image/x-icon', 'font/woff2', 'image/png', 'image/webp'
]
where id = 'artifacts';

-- ---- shared: is this a valid logo record pointing at an uploaded object? ----
create or replace function private.valid_logo_record(v jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ext text;
begin
  if v is null or jsonb_typeof(v) <> 'object' then return false; end if;
  if coalesce(v->>'mime', '') not in ('image/svg+xml', 'image/png', 'image/webp') then return false; end if;
  ext := case v->>'mime' when 'image/svg+xml' then 'svg' when 'image/png' then 'png' else 'webp' end;
  if coalesce(v->>'sha256', '') !~ '^[0-9a-f]{64}$' then return false; end if;
  if coalesce(v->>'path', '') !~ ('^uploads/[0-9a-f-]{36}/' || (v->>'sha256') || '\.' || ext || '$') then return false; end if;
  if jsonb_typeof(v->'bytes') <> 'number' or (v->>'bytes')::numeric not between 1 and 524288 then return false; end if;
  if jsonb_typeof(v->'width') <> 'number' or (v->>'width')::numeric not between 1 and 10000 then return false; end if;
  if jsonb_typeof(v->'height') <> 'number' or (v->>'height')::numeric not between 1 and 10000 then return false; end if;
  return exists (select 1 from storage.objects o where o.bucket_id = 'client-assets' and o.name = v->>'path');
end;
$$;

revoke all on function private.valid_logo_record(jsonb) from public;

-- ---- 3. plan_inputs: asset.logo and site_url shapes (body otherwise as 0018) ----
create or replace function private.plan_inputs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  logo jsonb;
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
  if new.key = 'asset.logo' and not new.waived then
    begin
      logo := new.value::jsonb;
    exception when others then
      raise exception 'plan_inputs(asset.logo): the value must be the uploaded logo record' using errcode = 'check_violation';
    end;
    if new.kind <> 'fact' or not private.valid_logo_record(logo) then
      raise exception 'plan_inputs(asset.logo): the logo record is not valid or the file was not uploaded' using errcode = 'check_violation';
    end if;
  end if;
  if new.key = 'site_url' and not new.waived and new.value !~* '^https://[^/\s]+/?$' then
    raise exception 'plan_inputs(site_url): the live address must be https://host with no path' using errcode = 'check_violation';
  end if;
  -- The audit row records WHAT was supplied (the key) and how long it is, not the text itself.
  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (coalesce(auth.uid()::text, 'service'), 'plan.input', 'info', new.plan_id,
          jsonb_build_object('key', new.key, 'kind', new.kind, 'waived', new.waived, 'chars', coalesce(length(new.value), 0)));
  return new;
end;
$$;

-- ---- 4. jobs: intake siteUrl/logo, resume fromStep (body otherwise as 0018) ----
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
