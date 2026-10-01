-- 0013 — Step 4C (decision D7, 2026-10-01): close a job that never started, from the Cockpit.
--
-- A job can be stranded in `queued` when its dispatch never reached the dispatch-job function (two such
-- rows exist from 2026-09-28). Until now only SQL could close them. This adds a terminal `cancelled`
-- status and ONE way to reach it: public.cancel_job(), which
--   * only an owner or admin may call (checked from profiles, like decide_account_request);
--   * only for a job still `queued` and older than 2 minutes, so it can never race a dispatch in flight
--     (dispatch-job flips queued -> dispatched within seconds) or stop work already on GitHub;
--   * requires a short reason, stamps who cancelled and when, and writes an audit_log row.
-- Browser roles still have no UPDATE policy on jobs: the function is the only path. The worker and
-- dispatch-job already refuse any job that is not queued/dispatched, so a cancelled job never runs.

alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('queued', 'dispatched', 'running', 'succeeded', 'failed', 'cancelled'));

-- Progress guard: same rules as 0009, plus `cancelled` is terminal and reachable only from `queued`.
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
  if old.status in ('succeeded', 'failed', 'cancelled') then
    raise exception 'jobs: job % already finished (%)', old.id, old.status using errcode = 'insufficient_privilege';
  end if;
  if new.status = 'cancelled' then
    if old.status <> 'queued' then
      raise exception 'jobs: only a queued job can be cancelled (it is %)', old.status using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if rank_new < rank_old then
    raise exception 'jobs: status can only move forward (% -> %)', old.status, new.status using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.cancel_job(p_job_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  j public.jobs%rowtype;
  reason text := btrim(coalesce(p_reason, ''));
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'only an owner or admin can cancel a job' using errcode = 'insufficient_privilege';
  end if;
  if length(reason) < 3 or length(reason) > 300 then
    raise exception 'give a reason of 3 to 300 characters' using errcode = 'invalid_parameter_value';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'no such job' using errcode = 'no_data_found';
  end if;
  if j.status <> 'queued' then
    raise exception 'only a job that never started can be cancelled (this one is %)', j.status using errcode = 'check_violation';
  end if;
  if j.created_at > now() - interval '2 minutes' then
    raise exception 'this job was requested less than 2 minutes ago and may still be starting' using errcode = 'check_violation';
  end if;

  update public.jobs
     set status = 'cancelled',
         finished_at = now(),
         error = format('Cancelled by %s: %s', caller_role, reason)
   where id = p_job_id;

  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (auth.uid()::text, 'job.cancelled', 'info', p_job_id,
          jsonb_build_object('kind', j.kind, 'reason', reason, 'role', caller_role));
end;
$$;

revoke all on function public.cancel_job(uuid, text) from public, anon;
grant execute on function public.cancel_job(uuid, text) to authenticated;
