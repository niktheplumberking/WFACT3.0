-- Attack test for migration 0028 (public.entities.aliases and the bennett-co row, Step 21 K).
-- Run AFTER 0028 is applied, with execute_sql (or psql). Everything happens in a sub-transaction that is ALWAYS rolled back,
-- so no synthetic user, profile or entity change persists. Every row of the result must have got == expect.

create or replace function pg_temp.attack_entities() returns jsonb language plpgsql as $f$
declare
  res jsonb := '[]'::jsonb;
  o uuid := gen_random_uuid(); m uuid := gen_random_uuid();
  n int; r text; t text;
begin
  begin
    insert into auth.users (id, email, aud, role, instance_id)
      select u, u||'@attack.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'
      from unnest(array[o,m]) u;
    insert into public.profiles (id, role) values (o,'owner'),(m,'pm');   -- m has no assigned clients

    -- ===== anon =====
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
    begin select count(*) into n from public.entities; r:=n::text; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','anon reads no entity','expect','0','got',r);
    reset role;

    -- ===== pm with no assigned client =====
    perform set_config('request.jwt.claims', json_build_object('sub',m,'role','authenticated')::text, true);
    set local role authenticated;
    select count(*) into n from public.entities;
    res := res || jsonb_build_object('t','pm without clients sees no entity','expect',0,'got',n);
    update public.entities set aliases = array['hijack'] where slug = 'bennett-co';
    get diagnostics n = row_count;
    res := res || jsonb_build_object('t','pm cannot change an entity''s aliases','expect',0,'got',n);
    begin insert into public.entities (slug, name, aliases) values ('attack-entity','Attack', array['attack']); r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','pm cannot add an entity','expect','42501','got',r);
    reset role;

    -- ===== owner =====
    perform set_config('request.jwt.claims', json_build_object('sub',o,'role','authenticated')::text, true);
    set local role authenticated;
    select array_to_string(aliases, '|') into t from public.entities where slug = 'bennett-co';
    res := res || jsonb_build_object('t','bennett-co exists with its aliases','expect','bennett|bennett & co|bennett and co','got',coalesce(t,'MISSING'));
    -- dreamsign is a live row (seeded outside migrations); a fresh local database has none.
    select array_to_string(aliases, '|') into t from public.entities where slug = 'dreamsign';
    res := res || jsonb_build_object('t','dreamsign has its alias','expect','dreamsign','got',coalesce(t,'SKIPPED: no dreamsign row'));
    begin update public.entities set aliases = array['Bennett'] where slug = 'bennett-co'; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an upper-case alias is refused','expect','23514','got',r);
    begin update public.entities set aliases = array[''] where slug = 'bennett-co'; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','an empty alias is refused','expect','23514','got',r);
    begin update public.entities set aliases = array(select 'a'||g from generate_series(1,21) g) where slug = 'bennett-co'; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','more than 20 aliases are refused','expect','23514','got',r);
    begin update public.entities set aliases = array['bennett','b&co'] where slug = 'bennett-co'; r:='ALLOWED'; exception when others then r:=sqlstate; end;
    res := res || jsonb_build_object('t','the owner can edit aliases','expect','ALLOWED','got',r);
    reset role;

    raise exception 'rollback';
  exception when others then
    if sqlerrm <> 'rollback' then res := res || jsonb_build_object('t','UNEXPECTED ERROR','expect','none','got',sqlstate||' '||sqlerrm); end if;
  end;
  return res;
end;
$f$;

select jsonb_pretty(pg_temp.attack_entities());
