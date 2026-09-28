-- WFACT 3.0 — Continuation Build Plan, Stage 5: observability seed.
-- Blueprint §3 ("every agent run, tool call, and model call traced with token cost, latency, and
-- outcome") and §16K ("real cost per client measured, not estimated"). A deliberately simple table,
-- per Blueprint §13's own rule: adopt Langfuse (or similar) only once this is shown insufficient.
--
-- One row per MODEL CALL, tied to the agent task that made it (task_id) and the run (run_id), so
-- cost rolls up per call, per task, per run, per client. cost_usd is computed from the provider's
-- REPORTED token counts x the configured per-model price (packages/hermes/config/model-routing.json),
-- never guessed: a model with no price on file is stored with cost_usd NULL and price_basis
-- 'unpriced' (e.g. the Agent 37 free-tier builder), so a sum never silently under-reports.

create table if not exists public.model_traces (
  id               uuid primary key default gen_random_uuid(),
  occurred_at      timestamptz not null default now(),
  run_id           uuid,
  task_id          uuid,
  actor            text not null check (length(actor) between 1 and 200),
  provider         text not null check (provider in ('anthropic', 'agent37')),
  model            text not null check (length(model) between 1 and 100),
  input_tokens     int  not null check (input_tokens >= 0),
  output_tokens    int  not null check (output_tokens >= 0),
  cost_usd         numeric(12, 6) check (cost_usd is null or cost_usd >= 0),
  price_basis      text not null check (price_basis in ('metered', 'unpriced')),
  pricing_version  text,
  latency_ms       int  not null check (latency_ms >= 0),
  outcome          text not null check (outcome in ('success', 'error')),
  error            text,
  entity_slug      text,
  constraint cost_matches_basis check ((price_basis = 'metered') = (cost_usd is not null))
);

comment on table public.model_traces is
  'One row per model call (Stage 5). Append-only. cost_usd = reported tokens x configured price; '
  'NULL + price_basis=unpriced when no price is on file. Owner-only read (cost data, Blueprint §9).';

create index if not exists idx_model_traces_occurred on public.model_traces(occurred_at desc);
create index if not exists idx_model_traces_task on public.model_traces(task_id) where task_id is not null;
create index if not exists idx_model_traces_run on public.model_traces(run_id) where run_id is not null;

-- Append-only, same guarantee and same function as audit_log (migration 0006).
drop trigger if exists model_traces_no_update on public.model_traces;
create trigger model_traces_no_update
  before update or delete on public.model_traces
  for each row execute function private.audit_log_refuse_mutation();
drop trigger if exists model_traces_no_truncate on public.model_traces;
create trigger model_traces_no_truncate
  before truncate on public.model_traces
  for each statement execute function private.audit_log_refuse_mutation();

alter table public.model_traces enable row level security;

-- Owner only: Blueprint §9 — "admins see operational panels, not raw cost/margin figures".
create policy model_traces_owner_select on public.model_traces
  for select using (private.current_role_name() = 'owner');

-- Roll-up for the Cockpit Models room. security_invoker so the owner-only RLS above still applies.
create or replace view public.model_usage_by_actor
with (security_invoker = true) as
select
  model,
  provider,
  actor,
  count(*)                                              as calls,
  count(*) filter (where outcome = 'error')             as errors,
  sum(input_tokens)                                     as input_tokens,
  sum(output_tokens)                                    as output_tokens,
  sum(cost_usd)                                         as cost_usd,
  count(*) filter (where price_basis = 'unpriced')      as unpriced_calls,
  round(avg(latency_ms))                                as avg_latency_ms,
  count(distinct task_id)                               as tasks,
  max(occurred_at)                                      as last_call_at
from public.model_traces
group by model, provider, actor;

comment on view public.model_usage_by_actor is
  'Usage and real cost per model per agent role (Cockpit Models room). unpriced_calls > 0 means '
  'cost_usd is a lower bound for that row — shown, not hidden.';
