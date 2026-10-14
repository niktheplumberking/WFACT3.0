-- RLS attack test for migration 0021 (client-assets bucket, the asset.logo / site_url plan inputs, intake siteUrl/logo and
-- resume fromStep). Run AFTER 0021 is applied, or in the same transaction right after it, with execute_sql (or psql).
-- Everything happens in a sub-transaction that is ALWAYS rolled back, so no synthetic user, object, plan, input, job or
-- audit row persists. Every row of the result must have got == expect.

create or replace function pg_temp.attack_brand_assets() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  p_ok uuid := gen_random_uuid();
  run1 uuid := gen_random_uuid();
  sha text := repeat('ab', 32);
  good_name text; logo jsonb; missing jsonb;
  dir_a jsonb := '{"recommendation":{"track":"A","withheldReason":null}}';
  n int; r text; b record;
begin
  begin
    good_name := 'uploads/' || o || '/' || sha || '.svg';
    logo := jsonb_build_object('path', good_name, 'mime', 'image/svg+xml', 'sha256', sha, 'bytes', 466, 'width', 240, 'height', 48);
    missing := jsonb_build_object('path', 'uploads/' || o || '/' || repeat('cd', 32) || '.svg', 'mime', 'image/svg+xml', 'sha256', repeat('cd', 32), 'bytes', 466, 'width', 240, 'height', 48);

    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,a,m]) u;
    insert into public.profiles (id, role) values (o,'owner'),(a,'admin'),(m,'pm');
    insert into public.plan_approvals (id, client_slug, entity_slug, plan) values
      (p_ok, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',dir_a));
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    update public.plan_approvals set status='approved', build_track='A' where id=p_ok;
    reset role;

    -- ===== the bucket itself =====
    select public, file_size_limit, allowed_mime_types into b from storage.buckets where id = 'client-assets';
    res := res || jsonb_build_object('t','client-assets is private','expect',false,'got',b.public);
    res := res || jsonb_build_object('t','client-assets limit is 512 KB','expect',524288,'got',b.file_size_limit);
    res := res || jsonb_build_object('t','client-assets takes only svg, png, webp','expect','{image/svg+xml,image/png,image/webp}','got',b.allowed_mime_types::text);

    -- ===== anon and PM cannot upload or read =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', good_name, o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon uploads a logo','expect','42501','got',r);
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || m || '/' || sha || '.svg', m::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','PM uploads a logo into their own folder','expect','42501','got',r);
    reset role;

    -- ===== owner: only their own folder, only a fingerprint name =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || a || '/' || sha || '.svg', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner uploads into another user''s folder','expect','42501','got',r);
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || o || '/logo.svg', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner uploads a file not named by its fingerprint','expect','42501','got',r);
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || o || '/' || sha || '.html', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner uploads an .html file','expect','42501','got',r);
    begin insert into storage.objects (bucket_id, name, owner_id) values ('artifacts', 'clients/attack-client/pages/x.html', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner writes into the artifacts bucket','expect','42501','got',r);
    insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', good_name, o::text);
    select count(*) into n from storage.objects where bucket_id = 'client-assets' and name = good_name;
    res := res || jsonb_build_object('t','owner uploads a logo into their own folder','expect',1,'got',n);
    update storage.objects set name = name || '.x' where bucket_id = 'client-assets' and name = good_name;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','owner renames the uploaded logo (no update policy)','expect',0,'got',n);
    -- Storage itself refuses direct deletes (42501); with no delete policy a delete through the API removes nothing either.
    begin delete from storage.objects where bucket_id = 'client-assets' and name = good_name; get diagnostics n = row_count; r := n::text; exception when others then r := sqlstate; end;
    res := res || jsonb_build_object('t','owner deletes the uploaded logo (refused or no row)','expect','refused','got',case when r in ('0','42501') then 'refused' else r end);
    reset role;

    -- ===== reads =====
    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'client-assets' and name = good_name;
    res := res || jsonb_build_object('t','admin sees the uploaded logo','expect',1,'got',n);
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'client-assets';
    res := res || jsonb_build_object('t','PM sees no uploaded logos','expect',0,'got',n);
    reset role;

    -- ===== plan_inputs: asset.logo and site_url =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.logo','Logo file','{not json',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','logo detail that is not a record','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.logo','Logo file',missing::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','logo detail pointing at a file that was never uploaded','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.logo','Logo file',(logo || jsonb_build_object('path','uploads/'||o||'/../../etc/passwd'))::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','logo detail with a path outside the uploads area','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'answer','asset.logo','Logo file',logo::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','logo given as an answer instead of a fact','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','site_url','Live site address','http://x.com/about',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','live address with http and a path','expect','23514','got',r);
    insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.logo','Logo file',logo::text,o);
    insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','site_url','Live site address','https://bennettandco.com',o);
    insert into public.plan_inputs (plan_id, kind, key, label, value, waived, provided_by) values (p_ok,'fact','asset.logo','Logo file',null,true,o);
    select count(*) into n from public.plan_inputs where plan_id = p_ok;
    res := res || jsonb_build_object('t','a valid logo, a valid address and a logo skip are kept','expect',3,'got',n);

    -- ===== jobs: intake siteUrl / logo, resume fromStep =====
    begin insert into public.jobs (kind, params, created_by) values ('intake', jsonb_build_object('text','A site please','siteUrl','https://x.com/path'), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','intake with a live address that has a path','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('intake', jsonb_build_object('text','A site please','logo',missing), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','intake with a logo that was never uploaded','expect','23514','got',r);
    begin insert into public.jobs (kind, params, created_by) values ('intake', jsonb_build_object('text','A site please','logo','logo.svg'), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','intake with a logo that is not a record','expect','23514','got',r);
    insert into public.jobs (kind, params, created_by) values ('intake', jsonb_build_object('text','A site please, secret words','siteUrl','https://bennettandco.com','logo',logo), o);
    select count(*) into n from public.jobs where kind = 'intake' and created_by = o;
    res := res || jsonb_build_object('t','intake with a valid live address and logo','expect',1,'got',n);
    select count(*) into n from public.audit_log where action = 'job.requested' and actor = o::text and payload::text like '%secret words%';
    res := res || jsonb_build_object('t','the intake audit row never carries the request text','expect',0,'got',n);
    select count(*) into n from public.audit_log where action = 'job.requested' and actor = o::text and (payload->'params'->>'logo')::boolean;
    res := res || jsonb_build_object('t','the intake audit row says a logo came with it','expect',1,'got',n);
    begin insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'fromStep', 'deploy'), o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a continue from an unknown step','expect','23514','got',r);
    insert into public.jobs (kind, params, created_by) values ('resume', jsonb_build_object('workflowRunId', run1, 'reopen', true, 'fromStep', 'revise'), o);
    select count(*) into n from public.jobs where params->>'workflowRunId' = run1::text;
    res := res || jsonb_build_object('t','a continue with fixes (revise)','expect',1,'got',n);
    reset role;

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_brand_assets());
