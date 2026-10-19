-- Attack and behaviour test for migration 0027 (audit_log entity fill, Step 21 D).
-- Run AFTER 0027 is applied, with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back,
-- so no synthetic user, profile, plan, input, job or audit row persists. Every row of the result must have got == expect.
-- SYNTHETIC: every user, plan, client and job below is made up; the entity is the live 'synthetic-test' row.

create or replace function pg_temp.attack_audit_entity() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid();
  p_ok uuid := gen_random_uuid(); p_old uuid := gen_random_uuid();
  j_build uuid; j_intake uuid; j_ask uuid; j_verify uuid;
  j_queued uuid := gen_random_uuid(); j_done uuid := gen_random_uuid(); j_disp uuid := gen_random_uuid();
  dir_a jsonb := '{"recommendation":{"track":"A","withheldReason":null}}';
  r text; t text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      values (o, o||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
    insert into public.profiles (id, role) values (o, 'owner');
    -- p_old is an older plan for the same client under another entity: a verify job must take the NEWEST plan's entity.
    insert into public.plan_approvals (id, client_slug, entity_slug, plan, created_at) values
      (p_old, 'attack-client', 'dreamsign', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a), now() - interval '1 day'),
      (p_ok,  'attack-client', 'synthetic-test', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a), now());
    -- Service-role jobs (no auth.uid): one queued 10 minutes ago, one finished, one to be dispatched.
    insert into public.jobs (id, kind, params, created_by, status, created_at) values
      (j_queued, 'resume', jsonb_build_object('workflowRunId', gen_random_uuid(), 'planId', p_ok), o, 'queued', now() - interval '10 minutes'),
      (j_done,   'resume', jsonb_build_object('workflowRunId', gen_random_uuid(), 'planId', p_ok), o, 'succeeded', now() - interval '20 minutes'),
      (j_disp,   'ask',    '{"question":"attack test"}', o, 'queued', now() - interval '10 minutes');

    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    update public.plan_approvals set status='approved', build_track='A' where id=p_ok;
    insert into public.jobs (kind, params, created_by) values ('build_plan', jsonb_build_object('planId', p_ok), o) returning id into j_build;
    insert into public.jobs (kind, params, created_by) values ('intake', '{"text":"attack test brief"}', o) returning id into j_intake;
    insert into public.jobs (kind, params, created_by) values ('ask', '{"question":"attack test"}', o) returning id into j_ask;
    insert into public.jobs (kind, params, created_by)
      values ('verify', '{"path":"clients/attack-client/pages/home.html","goal":"attack test"}', o) returning id into j_verify;
    insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok, 'fact', 'phone', 'Phone', '0400', o);
    perform public.cancel_job(j_queued, 'attack test');
    perform public.archive_job(j_done, true);
    reset role;

    -- What dispatch-job writes (service role, job id as task, no entity named).
    insert into public.audit_log (actor, action, outcome, task_id, payload) values (o::text, 'job.dispatched', 'info', j_disp, '{}');
    -- A writer that names an entity is never overridden.
    insert into public.audit_log (actor, action, outcome, task_id, entity_slug, payload) values ('attack', 'attack.named', 'info', p_ok, 'dreamsign', '{}');

    select entity_slug into t from public.audit_log where task_id = j_build and action = 'job.requested';
    res := res || jsonb_build_object('t','job.requested for a build names the plan''s entity','expect','synthetic-test','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = p_ok and action = 'plan.input';
    res := res || jsonb_build_object('t','plan.input names the plan''s entity','expect','synthetic-test','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = j_queued and action = 'job.cancelled';
    res := res || jsonb_build_object('t','job.cancelled names the plan''s entity','expect','synthetic-test','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = j_done and action = 'job.archived';
    res := res || jsonb_build_object('t','job.archived names the plan''s entity','expect','synthetic-test','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = j_verify and action = 'job.requested';
    res := res || jsonb_build_object('t','verify job takes the newest plan''s entity for its client','expect','synthetic-test','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = j_disp and action = 'job.dispatched';
    res := res || jsonb_build_object('t','an ask job dispatched has no entity (none is knowable)','expect','NULL','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = j_intake and action = 'job.requested';
    res := res || jsonb_build_object('t','an intake request has no entity (none is knowable)','expect','NULL','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = j_ask and action = 'job.requested';
    res := res || jsonb_build_object('t','an ask request has no entity','expect','NULL','got',coalesce(t,'NULL'));
    select entity_slug into t from public.audit_log where task_id = p_ok and action = 'attack.named';
    res := res || jsonb_build_object('t','a named entity is never overridden','expect','dreamsign','got',coalesce(t,'NULL'));

    -- The fill function is not callable by API roles, and the log stays append-only.
    select case when has_function_privilege('authenticated', 'private.audit_log_fill_entity()', 'execute') then 'ALLOWED' else 'DENIED' end into r;
    res := res || jsonb_build_object('t','authenticated cannot execute the fill function','expect','DENIED','got',r);
    select case when has_function_privilege('anon', 'private.audit_log_fill_entity()', 'execute') then 'ALLOWED' else 'DENIED' end into r;
    res := res || jsonb_build_object('t','anon cannot execute the fill function','expect','DENIED','got',r);
    begin update public.audit_log set entity_slug = 'dreamsign' where task_id = j_build; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','audit_log stays append-only (UPDATE refused)','expect','42501','got',r);

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_audit_entity());
