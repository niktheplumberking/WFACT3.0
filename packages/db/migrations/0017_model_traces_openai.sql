-- WFACT 3.0 — Factory Completion Plan Step 7: allow 'openai' in model_traces.provider.
-- Step 7 adds a second-vendor QA evaluator (packages/verification OpenAIModelClient, chosen by
-- config/evaluator.json when the builder is Claude, so the evaluator stays another model family).
-- Its calls are traced like every other model call (packages/hermes/src/tracing.ts); 0008's check
-- allowed only 'anthropic' and 'agent37', so a traced OpenAI call would fail its insert.
--
-- Widening a CHECK only: no new table, no RLS change (model_traces keeps 0008's policies), no data
-- rewrite. Append-only; NOT applied to the live database by the Step 7 agent (Huraira applies it).

do $$
declare
  c record;
begin
  -- 0008 declared the check inline, so its name is generated; drop whichever check covers provider.
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'model_traces'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%provider%'
  loop
    execute format('alter table public.model_traces drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.model_traces
  add constraint model_traces_provider_check check (provider in ('anthropic', 'agent37', 'openai'));
