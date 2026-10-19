-- 0027 — Step 21 D (2026-10-19): audit rows carry the entity whenever it is knowable.
--
-- Rows written by the database itself (job.requested, job.cancelled, job.archived, plan.input) and by the dispatch-job
-- Edge Function (job.dispatched) were inserted with entity_slug null although the job's plan names its entity
-- (live, 30 days to 2026-10-19: 108 of 116 such rows null). One BEFORE INSERT trigger fills a NULL entity_slug from:
--   1. a job (task_id = jobs.id): its params.planId -> plan_approvals.entity_slug; a verify job: the newest plan for the
--      client named in params.path (clients/<slug>/...);
--   2. job.requested, written while the job row is still being inserted: the same rules over the row's payload
--      (payload.kind, payload.params), which jobs_validate_request copies from the request;
--   3. a plan (task_id = plan_approvals.id, e.g. plan.input): that plan's entity.
-- A row that already names an entity is never changed. Where nothing names one (an intake or ask job, an account
-- approval, a run with no plan yet) entity_slug stays null, which is the truth. audit_log stays append-only (0006):
-- this only shapes a row before it exists; old rows are not backfilled (UPDATE is refused by design).

create or replace function private.audit_log_fill_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  p jsonb;
  v text;
begin
  if new.entity_slug is not null or new.task_id is null then
    return new;
  end if;

  select j.kind, j.params into k, p from public.jobs j where j.id = new.task_id;
  if not found and new.action = 'job.requested' then
    k := new.payload->>'kind';
    p := new.payload->'params';
  end if;

  if k is not null then
    if coalesce(p->>'planId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select a.entity_slug into v from public.plan_approvals a where a.id = (p->>'planId')::uuid;
    elsif k = 'verify' and coalesce(p->>'path', '') ~ '^clients/[a-z][a-z0-9-]*/' then
      select a.entity_slug into v from public.plan_approvals a
       where a.client_slug = split_part(p->>'path', '/', 2)
       order by a.created_at desc limit 1;
    end if;
  else
    select a.entity_slug into v from public.plan_approvals a where a.id = new.task_id;
  end if;

  new.entity_slug := v;
  return new;
end;
$$;

revoke all on function private.audit_log_fill_entity() from public, anon, authenticated;

drop trigger if exists audit_log_fill_entity on public.audit_log;
create trigger audit_log_fill_entity
  before insert on public.audit_log
  for each row execute function private.audit_log_fill_entity();
