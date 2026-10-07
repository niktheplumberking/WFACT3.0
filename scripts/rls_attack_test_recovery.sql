-- RLS attack test for migration 0018 (public.plan_inputs and the one-active-build jobs guard, Step 4D).
-- Run AFTER 0018 is applied, with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back,
-- so no synthetic user, profile, plan, input, job or audit row persists. Every row of the result must have got == expect.

create or replace function pg_temp.attack_recovery() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  p_ok uuid := gen_random_uuid(); p_pend uuid := gen_random_uuid();
  run1 uuid := gen_random_uuid(); run2 uuid := gen_random_uuid();
  j1 uuid; jx uuid;
  dir_a jsonb := '{"recommendation":{"track":"A","withheldReason":null}}';
  n int; r text; t text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,a,m]) u;
    insert into public.profiles (id, role) values (o,'owner'),(a,'admin'),(m,'pm');
    insert into public.plan_approvals (id, client_slug, entity_slug, plan) values
      (p_ok,   'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a)),
      (p_pend, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a));
    -- approve one plan as the owner (the decision trigger needs a signed-in human)
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    update public.plan_approvals set status='approved', build_track='A' where id=p_ok;
    reset role;

    -- ===== anon =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','phone','Phone','0400',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon adds a detail','expect','42501','got',r);
    reset role;

    -- ===== PM =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','phone','Phone','0400',m); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','PM adds a detail','expect','42501','got',r);
    reset role;

    -- ===== OWNER =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','phone','Phone','0400',a); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds a detail as someone else','expect','42501','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_pend,'fact','phone','Phone','0400',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds a detail to a plan that is not approved','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','Bad Key','Phone','0400',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds a detail with a key that is not a slug','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','phone','Phone',null,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds an empty detail that is not a skip','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, waived, provided_by) values (p_ok,'fact','phone','Phone','0400',true,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner skips a detail but still sends a value','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','phone','Phone',repeat('x',2001),o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds a 2001-character detail','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'secret','phone','Phone','0400',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds a detail of an unknown kind','expect','23514','got',r);

    insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','phone','Business phone','0400 111 222',o);
    insert into public.plan_inputs (plan_id, kind, key, label, value, waived, provided_by) values (p_ok,'fact','hours','Hours',null,true,o);
    select count(*) into n from public.plan_inputs where plan_id = p_ok;
    res := res || jsonb_build_object('t','owner adds a detail and a skip','expect',2,'got',n);
    update public.plan_inputs set value = 'changed' where plan_id = p_ok;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','owner edits a detail (no update policy)','expect',0,'got',n);
    delete from public.plan_inputs where plan_id = p_ok;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','owner removes a detail (no delete policy)','expect',0,'got',n);
    reset role;

    -- ===== service role / worker (no auth.uid) =====
    perform set_config('request.jwt.claims', '', true);
    begin update public.plan_inputs set value = 'changed' where plan_id = p_ok; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','service role edits a detail','expect','42501','got',r);
    begin delete from public.plan_inputs where plan_id = p_ok; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','service role removes a detail','expect','42501','got',r);
    select count(*) into n from public.audit_log where action = 'plan.input' and task_id = p_ok;
    res := res || jsonb_build_object('t','audit rows for the two accepted details','expect',2,'got',n);
    select count(*) into n from public.audit_log where action = 'plan.input' and task_id = p_ok and payload::text like '%0400 111 222%';
    res := res || jsonb_build_object('t','the audit row never carries the text of the detail','expect',0,'got',n);

    -- ===== PM reads =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.plan_inputs; res := res || jsonb_build_object('t','PM reads plan_inputs','expect',0,'got',n);
    reset role;

    -- ===== one active build per plan / run =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    insert into public.jobs (kind, params, created_by) values ('build_plan', jsonb_build_object('planId', p_ok), o) returning id into j1;
    begin insert into public.jobs (kind, params, created_by) values ('build_plan', jsonb_build_object('planId', p_ok), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a second build of a plan that is already queued','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'planId', p_ok, 'reopen', true), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a continue for a plan whose build is already queued','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'planId', 'not-a-uuid'), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a continue with a malformed plan id','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'reopen', 'yes'), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a continue with reopen that is not true/false','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'reason', repeat('x',201)), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a continue with a 201-character reason','expect','23514','got',r);
    reset role;
    -- the first build finishes (the worker); now a continue for the same plan is allowed, and so is one for another run
    perform set_config('request.jwt.claims', '', true);
    update public.jobs set status = 'running' where id = j1;
    update public.jobs set status = 'failed', result = jsonb_build_object('workflowRunId', run1), error = 'x' where id = j1;
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'planId', p_ok, 'reopen', true, 'reason', 'fix and continue'), o) returning id into jx;
    select count(*) into n from public.jobs where id = jx;
    res := res || jsonb_build_object('t','a continue after the first build finished','expect',1,'got',n);
    begin insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a second continue of the same run while the first waits','expect','23514','got',r);
    insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run2), o);
    select count(*) into n from public.jobs where params->>'workflowRunId' = run2::text;
    res := res || jsonb_build_object('t','a continue of a different run is not blocked','expect',1,'got',n);
    reset role;

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_recovery());
