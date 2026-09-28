-- WFACT 3.0 — Continuation Build Plan, Stage 1: append-only audit log.
-- Blueprint §3 ("Auditability: append-only log of every action, every approval, every model
-- decision, tied to the task ID") and §12 ("Audit logs: append-only, tied to task ID, covering agent
-- actions as well as human approvals"). First writers: Hermes-lite's tool calls and the verification
-- loop's pass/fail decisions (packages/audit). Later stages (workflow checkpoints, traces) extend
-- this table rather than inventing a parallel one.
--
-- Append-only is enforced by the schema, not by convention: UPDATE, DELETE and TRUNCATE are refused
-- by trigger for every role, including service_role (which bypasses RLS but not triggers).

create table if not exists public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  -- who acted: an agent/controller/human identifier, e.g. 'hermes-lite', 'verification-loop', a user id
  actor        text not null check (length(actor) between 1 and 200),
  -- what happened, dotted namespace, e.g. 'tool.invoke', 'verification.decision'
  action       text not null check (action ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'),
  outcome      text not null check (outcome in ('success', 'failure', 'rejected', 'info')),
  -- The unit of work this row belongs to (Blueprint §3's typed task). No FK yet: Stage 3's workflow
  -- runs mint task IDs before a public.tasks row necessarily exists. Tighten once they always do.
  task_id      uuid,
  -- Correlates every row written by one process invocation (one CLI run, one workflow run).
  run_id       uuid,
  entity_slug  text,
  payload      jsonb not null default '{}'::jsonb
);

comment on table public.audit_log is
  'Append-only audit trail (Blueprint §3/§12). UPDATE/DELETE/TRUNCATE are refused by trigger for '
  'every role. Written server-side with the service role (packages/audit); readable by owner/admin.';

create index if not exists idx_audit_log_occurred_at on public.audit_log(occurred_at desc);
create index if not exists idx_audit_log_task on public.audit_log(task_id) where task_id is not null;
create index if not exists idx_audit_log_run on public.audit_log(run_id) where run_id is not null;
create index if not exists idx_audit_log_action on public.audit_log(action);

-- ---- append-only enforcement ----
create or replace function private.audit_log_refuse_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_log is append-only: % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update
  before update or delete on public.audit_log
  for each row execute function private.audit_log_refuse_mutation();

drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_refuse_mutation();

-- ---- RLS: owner/admin read; nobody writes through PostgREST except service_role (bypasses RLS) ----
alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log
  for select
  using (private.is_owner_or_admin());

-- Deliberately no insert/update/delete policies for anon/authenticated: the Cockpit can read the
-- trail but never write or forge it. Writers are server-side processes holding the service role.
