-- RLS attack test for migration 0013 (jobs.cancelled + public.cancel_job, Step 4C decision D7).
-- Run with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back, so no
-- synthetic user, profile, job or audit row persists. Every row of the result must have got == expect.
-- First run: 2026-10-01 (packages/db/RLS_ATTACK_TEST_RESULTS.md, Run 5).

create or replace function pg_temp.attack_cancel() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); m uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  j_old uuid := gen_random_uuid(); j_old2 uuid := gen_random_uuid(); j_new uuid := gen_random_uuid();
  j_run uuid := gen_random_uuid(); j_done uuid := gen_random_uuid();
  q jsonb := '{"question":"attack test"}';
  n int; r text; t text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,a,m,x]) u;
    insert into public.profiles (id, role) values (o,'owner'),(a,'admin'),(m,'pm');   -- x has no profile (pending sign-up)
    -- Synthetic jobs, written the way the service role would (no auth.uid, so status/created_at may be set).
    insert into public.jobs (id, kind, params, created_by, status, created_at) values
      (j_old,  'ask', q, o, 'queued',    now() - interval '10 minutes'),
      (j_old2, 'ask', q, o, 'queued',    now() - interval '10 minutes'),
      (j_new,  'ask', q, o, 'queued',    now()),
      (j_run,  'ask', q, o, 'running',   now() - interval '10 minutes'),
      (j_done, 'ask', q, o, 'succeeded', now() - interval '10 minutes');

    -- ===== anon =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin perform public.cancel_job(j_old, 'attack'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon calls cancel_job','expect','42501','got',r);
    reset role;

    -- ===== signed in, no profile (pending account) =====
    perform set_config('request.jwt.claims', json_build_object('sub',x,'role','authenticated')::text, true);
    set local role authenticated;
    begin perform public.cancel_job(j_old, 'attack'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','account without a profile cancels','expect','42501','got',r);
    reset role;

    -- ===== PM =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    begin perform public.cancel_job(j_old, 'attack'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','PM cancels','expect','42501','got',r);
    select count(*) into n from public.jobs; res := res || jsonb_build_object('t','PM reads jobs','expect',0,'got',n);
    reset role;

    -- ===== OWNER =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin perform public.cancel_job(j_old, '  '); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner cancels with a blank reason','expect','22023','got',r);
    begin perform public.cancel_job(j_run, 'stop it'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner cancels a RUNNING job','expect','23514','got',r);
    begin perform public.cancel_job(j_done, 'stop it'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner cancels a finished job','expect','23514','got',r);
    begin perform public.cancel_job(j_new, 'stop it'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner cancels a job queued under 2 minutes ago','expect','23514','got',r);
    begin perform public.cancel_job(gen_random_uuid(), 'stop it'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner cancels a job that does not exist','expect','P0002','got',r);
    update public.jobs set status = 'cancelled' where id = j_old2;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','owner UPDATEs jobs directly (no update policy)','expect',0,'got',n);
    perform public.cancel_job(j_old, 'Never reached GitHub');
    select status || '/' || (finished_at is not null)::text || '/' || error into t from public.jobs where id = j_old;
    res := res || jsonb_build_object('t','owner cancels an old queued job: status/finished/error','expect','cancelled/true/Cancelled by owner: Never reached GitHub','got',coalesce(t,'null'));
    begin perform public.cancel_job(j_old, 'again'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner cancels the same job twice','expect','23514','got',r);
    reset role;

    -- ===== ADMIN =====
    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    perform public.cancel_job(j_old2, 'Duplicate request');
    select status into t from public.jobs where id = j_old2;
    res := res || jsonb_build_object('t','admin cancels an old queued job','expect','cancelled','got',coalesce(t,'null'));
    reset role;

    -- ===== service role / worker (no auth.uid) =====
    perform set_config('request.jwt.claims', '', true);
    begin update public.jobs set status = 'running' where id = j_old; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','worker revives a cancelled job','expect','42501','got',r);
    begin update public.jobs set status = 'cancelled' where id = j_run; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','worker cancels a running job directly','expect','23514','got',r);

    -- audit trail
    select count(*) into n from public.audit_log where action = 'job.cancelled' and task_id in (j_old, j_old2);
    res := res || jsonb_build_object('t','audit rows for the two cancellations','expect',2,'got',n);
    select payload->>'role' into t from public.audit_log where action = 'job.cancelled' and task_id = j_old2;
    res := res || jsonb_build_object('t','audit row records the admin role','expect','admin','got',coalesce(t,'none'));

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_cancel());
