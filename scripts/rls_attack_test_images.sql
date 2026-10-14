-- RLS / trigger attack test for migration 0023 (image slots: client-assets JPEG, plan inputs asset.image.<slot> and
-- launch.placeholders_ok). Run with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled
-- back, so no synthetic user, profile, plan, object, input or audit row persists. Every row must have got == expect.

create or replace function pg_temp.attack_images() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  p_ok uuid := gen_random_uuid(); p_pend uuid := gen_random_uuid();
  sha text := repeat('ef', 32);
  jpg text; img jsonb; missing jsonb; big jsonb;
  n int; r text;
begin
  begin
    jpg := 'uploads/' || o || '/' || sha || '.jpg';
    img := jsonb_build_object('path', jpg, 'mime', 'image/jpeg', 'sha256', sha, 'bytes', 180000, 'width', 1600, 'height', 900);
    missing := jsonb_build_object('path', 'uploads/' || o || '/' || repeat('12', 32) || '.jpg', 'mime', 'image/jpeg', 'sha256', repeat('12', 32), 'bytes', 1000, 'width', 10, 'height', 10);
    big := jsonb_set(img, '{bytes}', '3000000');
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000' from unnest(array[o,m]) u;
    insert into public.profiles (id, role) values (o,'owner'),(m,'pm');
    insert into public.plan_approvals (id, client_slug, entity_slug, plan) values
      (p_ok, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',null)),
      (p_pend, 'attack-client', 'bennett-co', jsonb_build_object('plan','{}'::jsonb,'direction',null));

    -- ===== owner =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    update public.plan_approvals set status='approved', build_track='B' where id=p_ok;
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', jpg, o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner uploads a JPEG into their own folder','expect','ALLOWED','got',r);
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || m || '/' || sha || '.jpg', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner uploads into someone else''s folder','expect','42501','got',r);
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || o || '/' || sha || '.gif', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner uploads a file type that is not allowed','expect','42501','got',r);

    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.image.index.hero','Hero image',img::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner adds a valid image for a slot','expect','ALLOWED','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.image.index.hero','Hero image',missing::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an image record whose file was never uploaded','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.image.index.hero','Hero image',big::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an image record over 2 MB','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.image.index.hero','Hero image','not json',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an image value that is not a record','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.image.Bad_Slot','Hero image',img::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an image key that does not name a slot','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_pend,'fact','asset.image.index.hero','Hero image',img::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an image for a plan that is not approved','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, waived, provided_by) values (p_ok,'fact','asset.image.work.work.1','Work image',null,true,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner skips an image slot','expect','ALLOWED','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','launch.placeholders_ok','Launch with placeholders','yes',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner ticks launch with placeholders','expect','ALLOWED','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','launch.placeholders_ok','Launch with placeholders','sure',o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','launch with placeholders set to anything but yes','expect','23514','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','asset.logo','Logo',img::text,o); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a JPEG photo record used as the logo (logos stay SVG/PNG/WebP, 512 KB)','expect','23514','got',r);
    reset role;

    -- ===== PM (not owner/admin) =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', 'uploads/' || m || '/' || repeat('34', 32) || '.jpg', m::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','pm uploads an image','expect','42501','got',r);
    begin insert into public.plan_inputs (plan_id, kind, key, label, value, provided_by) values (p_ok,'fact','launch.placeholders_ok','Launch with placeholders','yes',m); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','pm ticks launch with placeholders','expect','42501','got',r);
    select count(*) into n from storage.objects where bucket_id = 'client-assets' and name = jpg;
    res := res || jsonb_build_object('t','pm reads the owner''s uploaded image','expect','0','got',n::text);
    reset role;

    -- ===== anon =====
    perform set_config('request.jwt.claims', '', true);
    set local role anon;
    begin insert into storage.objects (bucket_id, name, owner_id) values ('client-assets', jpg || 'x', o::text); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon uploads an image','expect','42501','got',r);
    reset role;

    select count(*) into n from public.audit_log where action = 'plan.input' and task_id = p_ok and payload::text like '%' || sha || '%';
    res := res || jsonb_build_object('t','audit rows never carry the image record','expect','0','got',n::text);
    select count(*) into n from storage.buckets where id = 'artifacts' and 'image/jpeg' = any(allowed_mime_types);
    res := res || jsonb_build_object('t','the artifacts bucket accepts a built site''s JPEG','expect','1','got',n::text);

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select e->>'t' as t, e->>'expect' as expect, e->>'got' as got, (e->>'expect') = (e->>'got') as ok from jsonb_array_elements(pg_temp.attack_images()) e;
