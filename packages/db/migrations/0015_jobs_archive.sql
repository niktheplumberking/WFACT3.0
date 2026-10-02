-- 0015 — Cockpit cleanup (Huraira, 2026-10-02): archive finished runs so Activity shows what matters.
--
-- jobs is deliberately undeletable (0009, jobs_no_delete): a run is part of the audit trail. Cleaning up the
-- Cockpit therefore HIDES a run, it never erases one. This adds archived_at/archived_by and ONE way to set
-- them: public.archive_job(), which
--   * only an owner or admin may call (checked from profiles, like cancel_job in 0013);
--   * only for a finished job (succeeded, failed or cancelled), so a run in flight can't be hidden;
--   * can also un-archive (p_archived = false), and writes an audit_log row either way.
-- Browser roles still have no UPDATE policy on jobs: the function is the only path. The progress guard
-- keeps every finished job frozen except for these two columns.

alter table public.jobs
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users (id);

-- Progress guard: same rules as 0013, plus an update that changes only archived_at/archived_by is allowed
-- on a finished job (and only there).
create or replace function private.jobs_progress_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rank_old int := array_position(array['queued','dispatched','running','succeeded','failed'], old.status);
  rank_new int := array_position(array['queued','dispatched','running','succeeded','failed'], new.status);
begin
  if (to_jsonb(new) - 'archived_at' - 'archived_by') = (to_jsonb(old) - 'archived_at' - 'archived_by') then
    if old.status not in ('succeeded', 'failed', 'cancelled') then
      raise exception 'jobs: only a finished job can be archived (job % is %)', old.id, old.status using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.archived_at is distinct from old.archived_at or new.archived_by is distinct from old.archived_by then
    raise exception 'jobs: archiving cannot be combined with another change' using errcode = 'check_violation';
  end if;
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

create or replace function public.archive_job(p_job_id uuid, p_archived boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  j public.jobs%rowtype;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'only an owner or admin can archive a run' using errcode = 'insufficient_privilege';
  end if;

  select * into j from public.jobs where id = p_job_id for update;
  if not found then
    raise exception 'no such run' using errcode = 'no_data_found';
  end if;
  if j.status not in ('succeeded', 'failed', 'cancelled') then
    raise exception 'only a finished run can be archived (this one is %)', j.status using errcode = 'check_violation';
  end if;
  if (j.archived_at is not null) = coalesce(p_archived, true) then
    return; -- already in the requested state
  end if;

  update public.jobs
     set archived_at = case when coalesce(p_archived, true) then now() end,
         archived_by = case when coalesce(p_archived, true) then auth.uid() end
   where id = p_job_id;

  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (auth.uid()::text, case when coalesce(p_archived, true) then 'job.archived' else 'job.unarchived' end, 'info', p_job_id,
          jsonb_build_object('kind', j.kind, 'status', j.status, 'role', caller_role));
end;
$$;

revoke all on function public.archive_job(uuid, boolean) from public, anon;
grant execute on function public.archive_job(uuid, boolean) to authenticated;
