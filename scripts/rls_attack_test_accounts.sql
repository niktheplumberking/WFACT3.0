-- RLS attack test for migration 0010 (account_requests + decide_account_request + owner-only profiles).
-- Run with execute_sql (or psql) against the project. Everything happens in a sub-transaction that is
-- ALWAYS rolled back, so no synthetic user, profile, request or audit row persists.
-- Every row of the result must have got == expect. First run: 2026-09-30, all rows matched
-- (see packages/db/RLS_ATTACK_TEST_RESULTS.md, Run 3).

create or replace function pg_temp.attack() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); x uuid := gen_random_uuid(); y uuid := gen_random_uuid(); z uuid := gen_random_uuid();
  n int; r text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,a,m,p,x,y,z]) u;
    insert into public.profiles (id, role) values (o,'owner'),(a,'admin'),(m,'pm');

    -- p, x, y, z have no profile -> the trigger must have made 4 pending requests
    res := res || jsonb_build_object('t','trigger: profile-less auth users become PENDING requests','expect',4,'got',(select count(*) from public.account_requests where user_id in (p,x,y,z) and status='pending')::int);

    -- ===== as pending user P (no profile) =====
    perform set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.account_requests;   res := res || jsonb_build_object('t','P sees only own request','expect',1,'got',n);
    select count(*) into n from public.profiles;           res := res || jsonb_build_object('t','P reads profiles','expect',0,'got',n);
    select count(*) into n from public.audit_log;          res := res || jsonb_build_object('t','P reads audit_log','expect',0,'got',n);
    select count(*) into n from public.jobs;               res := res || jsonb_build_object('t','P reads jobs','expect',0,'got',n);
    select count(*) into n from public.plan_approvals;     res := res || jsonb_build_object('t','P reads plan_approvals','expect',0,'got',n);
    select count(*) into n from public.model_traces;       res := res || jsonb_build_object('t','P reads model_traces','expect',0,'got',n);
    select count(*) into n from public.clients;            res := res || jsonb_build_object('t','P reads clients','expect',0,'got',n);
    begin insert into public.profiles (id, role) values (p,'owner'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','P self-inserts owner profile','expect','42501','got',r);
    begin update public.account_requests set status='approved' where user_id=p; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','P self-approves via UPDATE','expect','42501','got',r);
    begin insert into public.account_requests (user_id,email) values (gen_random_uuid(),'forged@x.test'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','P forges an account_requests row','expect','42501','got',r);
    begin perform public.decide_account_request(p,'approve','owner'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','P calls decide on self','expect','42501','got',r);
    begin perform public.decide_account_request(x,'approve','pm'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','P (no role) decides another','expect','42501','got',r);
    reset role;

    -- ===== as PM M (signed up before getting a profile, so has one own request row) =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    begin perform public.decide_account_request(x,'approve','pm'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','PM decides a request','expect','42501','got',r);
    select count(*) into n from public.account_requests;   res := res || jsonb_build_object('t','PM sees only own request row','expect',1,'got',n);
    reset role;

    -- ===== as ADMIN A =====
    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.account_requests where status='pending';
    res := res || jsonb_build_object('t','admin sees pending requests','expect',true,'got',n>=4);
    begin perform public.decide_account_request(x,'approve','admin'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin approves as admin','expect','42501','got',r);
    begin perform public.decide_account_request(x,'approve','owner'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin approves as owner','expect','42501','got',r);
    begin update public.profiles set role='owner' where id=a; get diagnostics n = row_count; r:='rows='||n; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin promotes self to owner (UPDATE profiles)','expect','rows=0','got',r);
    begin insert into public.profiles (id, role) values (x,'admin'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin inserts a profile directly','expect','42501','got',r);
    begin perform public.decide_account_request(a,'approve','pm'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin decides own request','expect','42501','got',r);
    begin perform public.decide_account_request(x,'approve','pm','ok by admin'); r:='OK'; exception when others then r:=sqlstate||':'||sqlerrm; end;
    res := res || jsonb_build_object('t','admin approves pm (allowed path)','expect','OK','got',r);
    begin perform public.decide_account_request(x,'reject'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin re-decides an already-decided request','expect','22023','got',r);
    begin perform public.decide_account_request(y,'reject',null,'not now'); r:='OK'; exception when others then r:=sqlstate||':'||sqlerrm; end;
    res := res || jsonb_build_object('t','admin rejects (allowed path)','expect','OK','got',r);
    reset role;
    res := res || jsonb_build_object('t','approved user X now has pm profile','expect','pm','got',(select role from public.profiles where id=x));
    res := res || jsonb_build_object('t','rejected user Y has NO profile','expect',0,'got',(select count(*) from public.profiles where id=y)::int);

    -- ===== as OWNER O =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin perform public.decide_account_request(z,'approve','admin'); r:='OK'; exception when others then r:=sqlstate||':'||sqlerrm; end;
    res := res || jsonb_build_object('t','owner approves admin','expect','OK','got',r);
    begin perform public.decide_account_request(p,'approve','superuser'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner approves a bogus role','expect','22023','got',r);
    begin update public.profiles set role='pm' where id=m; get diagnostics n = row_count; r:='rows='||n; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner can still update profiles','expect','rows=1','got',r);
    reset role;

    -- ===== audit trail (read as the migration role) =====
    res := res || jsonb_build_object('t','audit_log has 3 account.* rows by the deciders','expect',3,'got',(select count(*) from public.audit_log where action in ('account.approved','account.rejected') and actor in (o::text,a::text))::int);

    -- ===== anon =====
    set local role anon;
    begin select count(*) into n from public.account_requests; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon reads account_requests','expect','42501','got',r);
    begin perform public.decide_account_request(x,'approve','owner'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon calls decide_account_request','expect','42501','got',r);
    reset role;

    raise exception 'ROLLBACK_ATTACK_TEST';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ATTACK_TEST' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','got', sqlstate||': '||sqlerrm); end if;
  end;
  return res;
end $f$;

-- Show only the failures; an empty list means every check matched.
select coalesce(jsonb_agg(e), '[]'::jsonb) as failures
from jsonb_array_elements(pg_temp.attack()) e
where (e->'expect') is distinct from (e->'got');
