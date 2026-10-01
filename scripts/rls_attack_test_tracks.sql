-- RLS attack test for migration 0011 (plan_approvals.build_track / track_overridden, jobs build gate).
-- Run with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back, so no
-- synthetic user, profile, plan, job or audit row persists. Every row of the result must have got == expect.
-- "Legacy" = a real plan approved before 0011 (approved, no track); the test only tries to build it, rolled back.
-- First run: 2026-10-01 (packages/db/RLS_ATTACK_TEST_RESULTS.md, Run 4).

create or replace function pg_temp.attack_tracks() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  p_rec_a uuid := gen_random_uuid(); p_none uuid := gen_random_uuid(); p_rej uuid := gen_random_uuid();
  p_forge uuid := gen_random_uuid(); p_pm uuid := gen_random_uuid();
  p_legacy uuid := (select id from public.plan_approvals where status = 'approved' and build_track is null order by created_at limit 1);
  dir_a jsonb := '{"recommendation":{"track":"A","withheldReason":null}}';
  n int; r text; t text; ov text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,a,m]) u;
    insert into public.profiles (id, role) values (o,'owner'),(a,'admin'),(m,'pm');
    -- Synthetic pending plans, as the pipeline (service role) writes them.
    insert into public.plan_approvals (id, client_slug, entity_slug, plan) values
      (p_rec_a, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a)),
      (p_none,  'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',null)),
      (p_rej,   'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a)),
      (p_forge, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a)),
      (p_pm,    'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a));

    -- ===== pipeline (no auth.uid) =====
    begin update public.plan_approvals set status='approved', build_track='A' where id=p_pm; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','pipeline approves a plan (with a track)','expect','42501','got',r);
    begin insert into public.plan_approvals (client_slug, entity_slug, plan, build_track) values ('x','bennett-co','{}','A'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','insert a pending plan that already carries a track','expect','23514','got',r);

    -- ===== as PM =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    update public.plan_approvals set status='approved', build_track='A' where id=p_pm;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','PM approves a plan','expect',0,'got',n);
    select count(*) into n from public.plan_approvals; res := res || jsonb_build_object('t','PM reads plan_approvals','expect',0,'got',n);
    reset role;

    -- ===== as OWNER =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin update public.plan_approvals set status='approved' where id=p_rec_a; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner approves WITHOUT a track','expect','23514','got',r);
    begin update public.plan_approvals set status='approved', build_track='C' where id=p_rec_a; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner approves with track C','expect','23514','got',r);
    update public.plan_approvals set status='approved', build_track='B' where id=p_rec_a;
    select build_track, track_overridden::text into t, ov from public.plan_approvals where id=p_rec_a;
    res := res || jsonb_build_object('t','owner overrides recommended A with B: stored','expect','B/true','got',coalesce(t,'null')||'/'||coalesce(ov,'null'));
    -- RLS only lets a PENDING row be updated, so this changes nothing (0 rows), and the track stays B.
    update public.plan_approvals set build_track='A' where id=p_rec_a;
    get diagnostics n = row_count;
    select build_track into t from public.plan_approvals where id=p_rec_a;
    res := res || jsonb_build_object('t','owner changes the track after approving: rows changed / track','expect','0/B','got',n||'/'||coalesce(t,'null'));
    update public.plan_approvals set status='approved', build_track='A', track_overridden=true where id=p_forge;
    select track_overridden::text into ov from public.plan_approvals where id=p_forge;
    res := res || jsonb_build_object('t','browser forges track_overridden=true when choosing the recommended A','expect','false','got',coalesce(ov,'null'));
    update public.plan_approvals set status='approved', build_track='A' where id=p_none;
    select track_overridden::text into ov from public.plan_approvals where id=p_none;
    res := res || jsonb_build_object('t','no recommendation: overridden is null','expect','null','got',coalesce(ov,'null'));
    begin update public.plan_approvals set status='rejected', decision_note='no', build_track='A' where id=p_rej; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner rejects WITH a track','expect','23514','got',r);
    update public.plan_approvals set status='rejected', decision_note='Warmer tone' where id=p_rej;
    select coalesce(build_track,'null') into t from public.plan_approvals where id=p_rej;
    res := res || jsonb_build_object('t','owner rejects without a track: allowed, no track','expect','null','got',t);

    -- build gate (jobs trigger)
    if p_legacy is not null then
      begin insert into public.jobs (kind, params, created_by) values ('build_plan', jsonb_build_object('planId',p_legacy), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
      res := res || jsonb_build_object('t','build_plan on a pre-0011 approved plan with NO track','expect','23514','got',r);
    else
      res := res || jsonb_build_object('t','build_plan on a pre-0011 approved plan with NO track','expect','23514','got','SKIPPED: no legacy row');
    end if;
    begin insert into public.jobs (kind, params, created_by) values ('build_plan', jsonb_build_object('planId',p_rej), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','build_plan on a rejected plan','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('build_plan', jsonb_build_object('planId',p_none), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','build_plan on an approved plan WITH a track','expect','ALLOWED','got',r);
    reset role;

    -- The same change as the pipeline (bypasses RLS): the trigger refuses it because decisions are final.
    begin update public.plan_approvals set build_track='A' where id=p_rec_a; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','pipeline changes the track of an approved plan','expect','42501','got',r);

    -- ===== as ADMIN: may decide; the trigger still requires a track =====
    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    begin update public.plan_approvals set status='approved' where id=p_pm; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin approves WITHOUT a track','expect','23514','got',r);
    reset role;

    -- ===== anon =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    select count(*) into n from public.plan_approvals; res := res || jsonb_build_object('t','anon reads plan_approvals','expect',0,'got',n);
    reset role;

    -- audit rows written by the trigger (as superuser again)
    select (payload->>'buildTrack')||'/'||(payload->>'recommendedTrack')||'/'||(payload->>'trackOverridden') into t
      from public.audit_log where action='plan.decision' and task_id=p_rec_a order by occurred_at desc limit 1;
    res := res || jsonb_build_object('t','audit row for the override','expect','B/A/true','got',coalesce(t,'none'));

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_tracks());
