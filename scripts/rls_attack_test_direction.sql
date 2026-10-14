-- RLS / trigger attack test for migration 0022 (jobs kind 'direction': re-run the direction step for a PENDING plan).
-- Run with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back, so no synthetic
-- user, profile, plan, job or audit row persists. Every row of the result must have got == expect.

create or replace function pg_temp.attack_direction() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  p_pending uuid := gen_random_uuid(); p_approved uuid := gen_random_uuid(); p_other uuid := gen_random_uuid();
  n int; r text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000' from unnest(array[o,m]) u;
    insert into public.profiles (id, role) values (o,'owner'),(m,'pm');
    insert into public.plan_approvals (id, client_slug, entity_slug, plan) values
      (p_pending,  'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',null)),
      (p_approved, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',null)),
      (p_other,    'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',null));

    -- ===== as owner =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    update public.plan_approvals set status='approved', build_track='A' where id=p_approved;

    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',p_pending), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner re-runs direction on a pending plan','expect','ALLOWED','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',p_pending), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a second direction job for the same plan while one is queued','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',p_approved), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','direction on an already-approved plan','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId','not-a-uuid'), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','direction with a malformed planId','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',gen_random_uuid()), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','direction on a plan that does not exist','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',p_other), m); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner forges created_by as another user','expect','42501','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('redirect', jsonb_build_object('planId',p_other), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an unknown job kind (refused by the trigger before the kind check)','expect','20000','got',r);
    reset role;

    -- ===== as PM (not owner/admin) =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',p_other), m); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','pm requests a direction re-run','expect','42501','got',r);
    select count(*) into n from public.jobs where kind='direction';
    res := res || jsonb_build_object('t','pm reads direction jobs','expect','0','got',n::text);
    reset role;

    -- ===== anon =====
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    begin insert into public.jobs (kind, params, created_by) values ('direction', jsonb_build_object('planId',p_other), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon requests a direction re-run','expect','42501','got',r);
    reset role;

    -- the trigger's audit row for the allowed request (as superuser again)
    select count(*) into n from public.audit_log where action='job.requested' and payload->>'kind'='direction' and payload->'params'->>'planId'=p_pending::text;
    res := res || jsonb_build_object('t','audit row for the allowed request','expect','1','got',n::text);

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_direction());
