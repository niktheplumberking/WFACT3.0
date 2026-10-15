-- RLS attack test for migration 0025 (lead_sites, leads, lead_drops, record_lead_drop). Run AFTER 0025 is applied, with
-- execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back, so no synthetic user, client,
-- site, lead or count persists. The result is one row: passed / total, the failures, and every check with expect and got;
-- any got != expect is a failure, stated as such.

create or replace function pg_temp.attack_leads() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); a uuid := gen_random_uuid(); m uuid := gen_random_uuid(); o2 uuid := gen_random_uuid();
  ent uuid := gen_random_uuid(); c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
  l1 uuid := gen_random_uuid(); l2 uuid := gen_random_uuid();
  h text := repeat('ab', 32);
  n int; r text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,a,m,o2]) u;
    insert into public.profiles (id, role) values (o,'owner'),(a,'admin'),(m,'pm');
    -- o2 has an auth user but no profile (a pending sign-up): it must see and change nothing.
    insert into public.entities (id, slug, name) values (ent, 'attack-entity-'||left(ent::text,8), 'Attack entity');
    insert into public.clients (id, entity_id, name) values (c1, ent, 'Attack client one'), (c2, ent, 'Attack client two');
    insert into public.profile_clients (profile_id, client_id) values (m, c1);  -- the PM is assigned client one only
    -- Writers as the service role (the function's path): two sites, one lead each.
    insert into public.lead_sites (id, client_id, client_slug, allowed_origins, is_test) values
      (s1, c1, 'attack-one', array['https://one.example.test'], true),
      (s2, c2, 'attack-two', array['https://two.example.test', 'http://localhost:4173'], true);
    insert into public.leads (id, lead_site_id, client_id, form_variant, page_path, fields, ip_hash, is_test) values
      (l1, s1, c1, 'enquiry', '/contact/', '{"name":"Test Visitor","email":"visitor@example.test","message":"synthetic"}', h, true),
      (l2, s2, c2, 'request', '/', '{"name":"Test Visitor","phone":"000","need":"synthetic"}', h, true);
    -- The function calls record_lead_drop as service_role: prove that grant, not the test's superuser.
    set local role service_role;
    begin perform public.record_lead_drop(s1, 'honeypot'); perform public.record_lead_drop(s1, 'honeypot'); r:='ok'; exception when others then r:=sqlstate; end;
    reset role;
    res := res || jsonb_build_object('t','service_role may call record_lead_drop','expect','ok','got',r);
    select count into n from public.lead_drops where lead_site_id = s1 and reason = 'honeypot';
    res := res || jsonb_build_object('t','two honeypot drops are one row with count 2','expect',2,'got',n);
    -- The status-only trigger holds for every writer, the service role and the table owner included.
    begin update public.leads set fields = '{"name":"changed"}' where id = l1; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','the table owner changes a lead''s fields (trigger)','expect','42501','got',r);
    set local role service_role;
    begin update public.leads set page_path = '/x' where id = l1; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    reset role;
    res := res || jsonb_build_object('t','service_role changes a lead''s page (trigger)','expect','42501','got',r);

    -- ===== shape checks (any writer) =====
    begin insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c1, 'attack-x', array['http://evil.example.test']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead site with a plain-http, non-local origin','expect','23514','got',r);
    begin insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c1, 'attack-x', array['https://x.example.test/path']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead site origin with a path','expect','23514','got',r);
    begin insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c1, 'attack-one', array['https://dup.example.test']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a second active lead site with the same slug','expect','23505','got',r);
    begin insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c1, 'attack-one-b', array['https://dup.example.test']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a second active lead site for the same client under another slug','expect','23505','got',r);
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c2, 'enquiry', '/', '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead whose client is not its site''s client','expect','23514','got',r);
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/', '{}', '1.2.3.4'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead that stores a raw IP instead of a hash','expect','23514','got',r);
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/', jsonb_build_object('message', repeat('x', 13000)), h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead whose fields are over the size cap','expect','23514','got',r);
    -- 0026: the page check works at all (0025's '{0,299}' made every insert fail with 2201B), refuses "//" and > 300 chars.
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '//evil.example.test/x', '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead whose page starts with // (0026)','expect','23514','got',r);
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/'||repeat('a', 300), '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a lead whose page is over 300 characters (0026)','expect','23514','got',r);

    -- ===== anon: no insert, no select, no RPC =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/', '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon inserts a lead','expect','42501','got',r);
    begin select count(*) into n from public.leads; r:=n::text; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon reads leads','expect','42501','got',r);
    begin select count(*) into n from public.lead_sites; r:=n::text; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon reads lead sites','expect','42501','got',r);
    begin insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c1, 'attack-anon', array['https://a.example.test']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon creates a lead site','expect','42501','got',r);
    begin perform public.record_lead_drop(s1, 'honeypot'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon calls record_lead_drop','expect','42501','got',r);
    reset role;

    -- ===== a signed-in user with no profile =====
    perform set_config('request.jwt.claims', json_build_object('sub',o2,'role','authenticated')::text, true);
    set local role authenticated;
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/', '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an unapproved sign-up inserts a lead','expect','42501','got',r);
    select count(*) into n from public.leads;
    res := res || jsonb_build_object('t','an unapproved sign-up reads no leads','expect',0,'got',n);
    select count(*) into n from public.lead_sites;
    res := res || jsonb_build_object('t','an unapproved sign-up reads no lead sites','expect',0,'got',n);
    begin perform public.record_lead_drop(s1, 'honeypot'); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','a signed-in user calls record_lead_drop','expect','42501','got',r);
    reset role;

    -- ===== PM: assigned client only, no writes =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.leads where id = l1;
    res := res || jsonb_build_object('t','PM reads a lead of their assigned client','expect',1,'got',n);
    select count(*) into n from public.leads where id = l2;
    res := res || jsonb_build_object('t','PM reads a lead of another client','expect',0,'got',n);
    select count(*) into n from public.lead_sites;
    res := res || jsonb_build_object('t','PM reads no lead sites (keys and origins are owner/admin)','expect',0,'got',n);
    select count(*) into n from public.lead_drops;
    res := res || jsonb_build_object('t','PM reads no drop counts','expect',0,'got',n);
    update public.leads set status = 'handled' where id = l1;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','PM marks a lead handled','expect',0,'got',n);
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/', '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','PM inserts a lead','expect','42501','got',r);
    reset role;

    -- ===== admin: reads all, status only, no delete, no lead_sites edits =====
    perform set_config('request.jwt.claims', json_build_object('sub',a,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.leads where id in (l1, l2);
    res := res || jsonb_build_object('t','admin reads every lead','expect',2,'got',n);
    begin update public.leads set fields = '{"name":"changed"}' where id = l1; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin changes a lead''s fields','expect','42501','got',r);
    begin update public.leads set client_id = c2 where id = l1; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin moves a lead to another client','expect','42501','got',r);
    begin update public.leads set status = 'spam' where id = l1; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin sets a status that does not exist','expect','23514','got',r);
    begin delete from public.leads where id = l1; get diagnostics n = row_count; r:=n::text; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin deletes a lead (refused or no row)','expect','refused','got',case when r in ('0','42501') then 'refused' else r end);
    update public.leads set status = 'handled' where id = l1;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','admin marks a lead handled','expect',1,'got',n);
    begin insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c1, 'attack-admin', array['https://a.example.test']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin creates a lead site','expect','42501','got',r);
    update public.lead_sites set allowed_origins = array['https://evil.example.test'] where id = s1;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','admin changes a site''s allowed origins','expect',0,'got',n);
    begin delete from public.lead_sites where id = s1; get diagnostics n = row_count; r:=n::text; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','admin deletes a lead site (refused or no row)','expect','refused','got',case when r in ('0','42501') then 'refused' else r end);
    reset role;

    -- ===== owner: reads all, edits lead_sites, still cannot change lead content or delete =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    begin update public.leads set fields = '{"name":"changed"}' where id = l2; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner changes a lead''s fields','expect','42501','got',r);
    begin delete from public.leads where id = l2; get diagnostics n = row_count; r:=n::text; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner deletes a lead (refused or no row)','expect','refused','got',case when r in ('0','42501') then 'refused' else r end);
    begin insert into public.leads (lead_site_id, client_id, form_variant, page_path, fields, ip_hash) values (s1, c1, 'enquiry', '/', '{}', h); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','owner inserts a lead through the API','expect','42501','got',r);
    update public.lead_sites set active = false where id = s2;
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','owner switches a lead site off','expect',1,'got',n);
    insert into public.lead_sites (client_id, client_slug, allowed_origins) values (c2, 'attack-two', array['https://two.example.test']);
    select count(*) into n from public.lead_sites where client_slug = 'attack-two' and active;
    res := res || jsonb_build_object('t','owner adds a new active site for that client','expect',1,'got',n);
    select count(*) into n from public.lead_drops where lead_site_id = s1;
    res := res || jsonb_build_object('t','owner reads drop counts','expect',1,'got',n);
    reset role;

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

with r as materialized (select e from jsonb_array_elements(pg_temp.attack_leads()) e)
select (select count(*) from r where e->'expect' = e->'got') as passed,
       (select count(*) from r) as total,
       (select jsonb_agg(e) from r where e->'expect' <> e->'got') as failures,
       (select jsonb_agg(e) from r) as checks;
