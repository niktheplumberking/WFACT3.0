-- 0023 — Image slots and labelled placeholders (Build-quality Package 3, 2026-10-14). MVP-CUTLINE: no paid image
-- generation; "supplied assets and clearly labelled placeholders". The owner uploads the client's pictures in the Cockpit,
-- one per media slot; every other slot shows an "Image to come" card, and the site does not launch with any left unless
-- the owner ticks "launch with placeholders".
--
-- 1. client-assets bucket: JPEG added and the per-object limit raised to 2 MB (photos). Logos keep their own 512 KB and
--    SVG/PNG/WebP rule (private.valid_logo_record is unchanged). Uploads stay owner/admin-only, in the uploader's own
--    folder, content-addressed; nothing is ever updated or deleted by a browser role.
-- 2. artifacts bucket: image/jpeg added (a supplied photo ships inside the built site).
-- 3. private.valid_image_record: an image record (PNG/WebP/JPEG, <= 2 MB, sane size) pointing at an uploaded object.
-- 4. plan_inputs: keys `asset.image.<slot>` (a valid image record) and `launch.placeholders_ok` (exactly "yes").
--    Everything else in plan_inputs_guard is unchanged from 0021.
-- Attack test: scripts/rls_attack_test_images.sql.

-- ---- 1. client-assets: JPEG, 2 MB ----
update storage.buckets
set file_size_limit = 2097152, allowed_mime_types = array['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']
where id = 'client-assets';

drop policy if exists client_assets_insert on storage.objects;
create policy client_assets_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-assets'
    and private.is_owner_or_admin()
    and name ~ ('^uploads/' || auth.uid()::text || '/[0-9a-f]{64}\.(svg|png|webp|jpg)$')
  );

-- ---- 2. artifacts: JPEG ----
update storage.buckets
set allowed_mime_types = array[
  'text/html', 'application/json', 'text/css', 'text/javascript', 'text/plain',
  'image/svg+xml', 'image/x-icon', 'font/woff2', 'image/png', 'image/webp', 'image/jpeg'
]
where id = 'artifacts';

-- ---- 3. a valid image record pointing at an uploaded object ----
create or replace function private.valid_image_record(v jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ext text;
begin
  if v is null or jsonb_typeof(v) <> 'object' then return false; end if;
  if coalesce(v->>'mime', '') not in ('image/png', 'image/webp', 'image/jpeg') then return false; end if;
  ext := case v->>'mime' when 'image/png' then 'png' when 'image/webp' then 'webp' else 'jpg' end;
  if coalesce(v->>'sha256', '') !~ '^[0-9a-f]{64}$' then return false; end if;
  if coalesce(v->>'path', '') !~ ('^uploads/[0-9a-f-]{36}/' || (v->>'sha256') || '\.' || ext || '$') then return false; end if;
  if jsonb_typeof(v->'bytes') <> 'number' or (v->>'bytes')::numeric not between 1 and 2097152 then return false; end if;
  if jsonb_typeof(v->'width') <> 'number' or (v->>'width')::numeric not between 1 and 12000 then return false; end if;
  if jsonb_typeof(v->'height') <> 'number' or (v->>'height')::numeric not between 1 and 12000 then return false; end if;
  return exists (select 1 from storage.objects o where o.bucket_id = 'client-assets' and o.name = v->>'path');
end;
$$;

revoke all on function private.valid_image_record(jsonb) from public;

-- ---- 4. plan_inputs: asset.image.<slot> and launch.placeholders_ok (body otherwise as 0021) ----
create or replace function private.plan_inputs_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  logo jsonb;
  img jsonb;
begin
  if auth.uid() is not null and new.provided_by is distinct from auth.uid() then
    raise exception 'plan_inputs: provided_by must be the signed-in user' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.plan_approvals where id = new.plan_id and status = 'approved') then
    raise exception 'plan_inputs: plan % is not approved, so it takes no details', new.plan_id using errcode = 'check_violation';
  end if;
  select count(*) into n from public.plan_inputs where plan_id = new.plan_id;
  if n >= 200 then
    raise exception 'plan_inputs: this plan already has 200 entries' using errcode = 'check_violation';
  end if;
  new.label := btrim(new.label);
  if new.value is not null then new.value := btrim(new.value); end if;
  if new.key = 'asset.logo' and not new.waived then
    begin
      logo := new.value::jsonb;
    exception when others then
      raise exception 'plan_inputs(asset.logo): the value must be the uploaded logo record' using errcode = 'check_violation';
    end;
    if new.kind <> 'fact' or not private.valid_logo_record(logo) then
      raise exception 'plan_inputs(asset.logo): the logo record is not valid or the file was not uploaded' using errcode = 'check_violation';
    end if;
  end if;
  -- 0023: an owner-supplied image for one media slot (Build-quality Package 3).
  if new.key like 'asset.image.%' then
    if new.key !~ '^asset\.image\.[a-z][a-z0-9-]{0,39}(\.[a-z0-9-]{1,40}){1,3}$' then
      raise exception 'plan_inputs(asset.image): the key must name a media slot, like asset.image.index.hero' using errcode = 'check_violation';
    end if;
    if not new.waived then
      begin
        img := new.value::jsonb;
      exception when others then
        raise exception 'plan_inputs(asset.image): the value must be the uploaded image record' using errcode = 'check_violation';
      end;
      if new.kind <> 'fact' or not private.valid_image_record(img) then
        raise exception 'plan_inputs(asset.image): the image record is not valid or the file was not uploaded' using errcode = 'check_violation';
      end if;
    end if;
  end if;
  -- 0023: the owner's "launch with placeholders" tick: exactly "yes" (or a skip, which withdraws it).
  if new.key = 'launch.placeholders_ok' and not new.waived and (new.kind <> 'fact' or new.value is distinct from 'yes') then
    raise exception 'plan_inputs(launch.placeholders_ok): the value must be "yes"' using errcode = 'check_violation';
  end if;
  if new.key = 'site_url' and not new.waived and new.value !~* '^https://[^/\s]+/?$' then
    raise exception 'plan_inputs(site_url): the live address must be https://host with no path' using errcode = 'check_violation';
  end if;
  -- The audit row records WHAT was supplied (the key) and how long it is, not the text itself.
  insert into public.audit_log (actor, action, outcome, task_id, payload)
  values (coalesce(auth.uid()::text, 'service'), 'plan.input', 'info', new.plan_id,
          jsonb_build_object('key', new.key, 'kind', new.kind, 'waived', new.waived, 'chars', coalesce(length(new.value), 0)));
  return new;
end;
$$;
