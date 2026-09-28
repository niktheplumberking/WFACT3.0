-- WFACT 3.0 — Continuation Build Plan, Stage 4: the owner-approval gate on Planner output.
-- Blueprint §5 Planning: "Owner approves the plan (2.0's existing gate)"; "re-plan once on rejection,
-- escalate on second rejection". The Cockpit's Approvals room reads and decides these rows.
--
-- Guarantees enforced HERE, not in the UI:
--   * only the service role inserts plans (the Planner pipeline); nobody can forge one from the browser;
--   * a decision can only move pending -> approved | rejected, exactly once, by an owner/admin,
--     stamped with auth.uid() — the plan body itself can never be edited through a decision;
--   * every decision writes an audit_log row (Blueprint §12: audit covers human approvals too).

create table if not exists public.plan_approvals (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  client_slug    text not null check (client_slug ~ '^[a-z][a-z0-9-]*$'),
  entity_slug    text not null,
  plan           jsonb not null,
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  revision       int  not null default 1 check (revision between 1 and 2),
  supersedes     uuid references public.plan_approvals(id),
  intake_run_id  uuid,
  decided_by     uuid references auth.users(id),
  decided_at     timestamptz,
  decision_note  text,
  constraint decision_fields_consistent check (
    (status in ('pending', 'superseded')) = (decided_at is null and decided_by is null)
  )
);

comment on table public.plan_approvals is
  'Planner output awaiting / holding an owner decision (Blueprint §5). Insert: service role only. '
  'Decide: owner/admin via RLS, one time, pending -> approved|rejected, audited by trigger.';

create index if not exists idx_plan_approvals_status on public.plan_approvals(status, created_at desc);

-- ---- decision guard + audit (runs for every role, service_role included) ----
create or replace function private.plan_approval_decision_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  if new.status = 'superseded' then
    -- Only the pipeline (no end-user session) may supersede a pending plan with a re-plan.
    if auth.uid() is not null then
      raise exception 'plan_approvals: only the pipeline can supersede a plan' using errcode = 'insufficient_privilege';
    end if;
    new.decided_by := null;
    new.decided_at := null;
  elsif new.status in ('approved', 'rejected') then
    if auth.uid() is null then
      raise exception 'plan_approvals: a decision needs a signed-in human' using errcode = 'insufficient_privilege';
    end if;
    if new.status = 'rejected' and coalesce(btrim(new.decision_note), '') = '' then
      raise exception 'plan_approvals: a rejection needs a note — the Planner re-plans from it'
        using errcode = 'check_violation';
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
    jsonb_build_object('status', new.status, 'revision', new.revision, 'clientSlug', new.client_slug, 'note', new.decision_note)
  );
  return new;
end;
$$;

drop trigger if exists plan_approvals_decision_guard on public.plan_approvals;
create trigger plan_approvals_decision_guard
  before update on public.plan_approvals
  for each row execute function private.plan_approval_decision_guard();

create or replace function private.plan_approvals_no_delete()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'plan_approvals rows are a decision record and cannot be deleted' using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists plan_approvals_no_delete on public.plan_approvals;
create trigger plan_approvals_no_delete
  before delete on public.plan_approvals
  for each row execute function private.plan_approvals_no_delete();

-- ---- RLS ----
alter table public.plan_approvals enable row level security;

create policy plan_approvals_select on public.plan_approvals
  for select using (private.is_owner_or_admin());

create policy plan_approvals_decide on public.plan_approvals
  for update
  using (private.is_owner_or_admin() and status = 'pending')
  with check (private.is_owner_or_admin() and status in ('approved', 'rejected'));

-- No insert/delete policy for anon/authenticated: plans are created by the pipeline (service role).
