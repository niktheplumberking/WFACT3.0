-- WFACT 3.0 — MVP M6 (docs/MVP-CUTLINE.md §4, docs/AI-COST-AUDIT.md): cost control and transparency.
--
-- 1. price_basis gains 'estimated': a call priced from a rate the provider does not publish (Agent 37's
--    hermes-agent, priced at Sonnet-class list rates in packages/hermes/config/model-routing.json 1.4.0).
--    It carries a cost (so every cap counts it) but stays distinguishable from a metered bill.
-- 2. Two roll-ups the spend caps and the Cockpit Costs page read: per run (one build, including every retry
--    and reopen, which keep the run id) and per day. Both expose the tokens of UNPRICED rows separately, so
--    the Cockpit can show a labelled estimate for the history recorded before this migration (rows are
--    append-only and are never rewritten).
--
-- Widening checks and adding views only: no data rewrite, model_traces keeps 0008's owner-only RLS, and the
-- views are security_invoker so that rule still applies to them.

alter table public.model_traces drop constraint if exists cost_matches_basis;

do $$
declare
  c record;
begin
  -- 0008 declared the price_basis check inline, so its name is generated; drop whichever check covers it.
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'model_traces'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%price_basis%'
  loop
    execute format('alter table public.model_traces drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.model_traces
  add constraint model_traces_price_basis_check check (price_basis in ('metered', 'estimated', 'unpriced')),
  add constraint cost_matches_basis check ((price_basis <> 'unpriced') = (cost_usd is not null));

-- 0008's roll-up, plus how many of its calls are estimates (new column last, so replace works).
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
  max(occurred_at)                                      as last_call_at,
  count(*) filter (where price_basis = 'estimated')     as estimated_calls
from public.model_traces
group by model, provider, actor;

create or replace view public.model_cost_by_run
with (security_invoker = true) as
select
  run_id,
  max(entity_slug)                                                          as entity_slug,
  count(*)                                                                  as calls,
  count(*) filter (where outcome = 'error')                                 as errors,
  sum(input_tokens)                                                         as input_tokens,
  sum(output_tokens)                                                        as output_tokens,
  coalesce(sum(cost_usd), 0)                                                as priced_usd,
  coalesce(sum(cost_usd) filter (where price_basis = 'estimated'), 0)       as estimated_usd,
  count(*) filter (where price_basis = 'unpriced')                          as unpriced_calls,
  coalesce(sum(input_tokens) filter (where price_basis = 'unpriced'), 0)    as unpriced_input_tokens,
  coalesce(sum(output_tokens) filter (where price_basis = 'unpriced'), 0)   as unpriced_output_tokens,
  min(occurred_at)                                                          as first_call_at,
  max(occurred_at)                                                          as last_call_at
from public.model_traces
where run_id is not null
group by run_id;

comment on view public.model_cost_by_run is
  'MVP M6: spend per run (one build incl. retries and reopens). priced_usd counts metered + estimated rows; '
  'the per-build cap reads it. unpriced_* tokens are history from before Agent 37 had a price.';

create or replace view public.model_cost_by_day
with (security_invoker = true) as
select
  (occurred_at at time zone 'utc')::date                                    as day,
  coalesce(entity_slug, '')                                                 as entity_slug,
  provider,
  model,
  count(*)                                                                  as calls,
  sum(input_tokens)                                                         as input_tokens,
  sum(output_tokens)                                                        as output_tokens,
  coalesce(sum(cost_usd), 0)                                                as priced_usd,
  coalesce(sum(cost_usd) filter (where price_basis = 'estimated'), 0)       as estimated_usd,
  count(*) filter (where price_basis = 'unpriced')                          as unpriced_calls,
  coalesce(sum(input_tokens) filter (where price_basis = 'unpriced'), 0)    as unpriced_input_tokens,
  coalesce(sum(output_tokens) filter (where price_basis = 'unpriced'), 0)   as unpriced_output_tokens
from public.model_traces
group by 1, 2, 3, 4;

comment on view public.model_cost_by_day is
  'MVP M6: spend per UTC day, client, provider and model. The weekly cap sums the last 7 days of priced_usd.';
