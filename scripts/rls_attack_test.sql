-- WFACT 3.0 — Phase 2: RLS / entity-isolation attack test
-- Adapted from 2.0's isolation attack pattern (Playbook §2: "50-point security audit + attack
-- scripts... real RLS attacks, real upload attacks, results printed honestly").
-- Run against a real Postgres/Supabase instance after migrations 0001-0005 are applied.
-- See packages/db/RLS_ATTACK_TEST_RESULTS.md for the last real run's results (sandbox project).
--
-- Exit check this satisfies (Operator's Manual Phase 2): "the RLS attack test fails to cross
-- entity boundaries."

-- ============================================================================
-- 1. Seed: two entities, one client/project/task/correction-round each, one
--    owner user, one PM scoped ONLY to the DreamSign client.
-- ============================================================================
insert into public.entities (id, slug, name) values
  ('11111111-1111-1111-1111-111111111111','dreamsign','DreamSign'),
  ('22222222-2222-2222-2222-222222222222','bennett-co','Bennett & Co');

insert into public.clients (id, entity_id, name) values
  ('a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','DreamSign Client'),
  ('b2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Bennett Client');

insert into public.projects (id, client_id, entity_id, name) values
  ('c1111111-1111-1111-1111-111111111111','a1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','DreamSign Website'),
  ('c2222222-2222-2222-2222-222222222222','b2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Bennett Website');

insert into public.tasks (project_id, entity_id, title, owner) values
  ('c1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Build homepage','front_end_agent'),
  ('c2222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','Build homepage','front_end_agent');

insert into public.correction_rounds (project_id, round_number, stage, flagged_by, issue) values
  ('c1111111-1111-1111-1111-111111111111', 1, '4_homepage_build', 'qa_agent', 'test issue for DreamSign');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999991','authenticated','authenticated','owner-test@wfact.test','x',now(),now(),now(),'{}','{}'),
('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999992','authenticated','authenticated','pm-dreamsign-test@wfact.test','x',now(),now(),now(),'{}','{}');

insert into public.profiles (id, role, full_name) values
('99999999-9999-9999-9999-999999999991','owner','Test Owner'),
('99999999-9999-9999-9999-999999999992','pm','Test PM (DreamSign only)');

insert into public.profile_clients (profile_id, client_id) values
('99999999-9999-9999-9999-999999999992','a1111111-1111-1111-1111-111111111111');

-- ============================================================================
-- 2. Attack: PM scoped to DreamSign attempts to read Bennett & Co's data,
--    both via default listing and via deliberate direct-ID/entity targeting.
--    Expect: only DreamSign rows visible; every Bennett fetch returns 0.
-- ============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999992","role":"authenticated"}';
select
  (select count(*) from public.clients) as pm_clients_visible,               -- expect 1
  (select count(*) from public.projects) as pm_projects_visible,             -- expect 1
  (select count(*) from public.tasks) as pm_tasks_visible,                   -- expect 1
  (select count(*) from public.correction_rounds) as pm_correction_rounds_visible, -- expect 1
  (select count(*) from public.entities) as pm_entities_visible,             -- expect 1
  (select count(*) from public.clients where id = 'b2222222-2222-2222-2222-222222222222') as pm_direct_fetch_bennett_client,  -- expect 0
  (select count(*) from public.projects where id = 'c2222222-2222-2222-2222-222222222222') as pm_direct_fetch_bennett_project, -- expect 0
  (select count(*) from public.tasks where entity_id = '22222222-2222-2222-2222-222222222222') as pm_direct_fetch_bennett_tasks_by_entity; -- expect 0

-- ============================================================================
-- 3. Owner control: must see everything (proves RLS isn't over-restrictive).
-- ============================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999991","role":"authenticated"}';
select
  (select count(*) from public.entities) as owner_entities,                  -- expect 2
  (select count(*) from public.clients) as owner_clients,                    -- expect 2
  (select count(*) from public.projects) as owner_projects,                  -- expect 2
  (select count(*) from public.tasks) as owner_tasks,                        -- expect 2
  (select count(*) from public.correction_rounds) as owner_correction_rounds; -- expect 1

-- ============================================================================
-- 4. Anonymous / unauthenticated: must see nothing.
-- ============================================================================
set local role anon;
select
  (select count(*) from public.entities) as anon_entities,                   -- expect 0
  (select count(*) from public.clients) as anon_clients,                     -- expect 0
  (select count(*) from public.projects) as anon_projects,                   -- expect 0
  (select count(*) from public.tasks) as anon_tasks,                         -- expect 0
  (select count(*) from public.correction_rounds) as anon_correction_rounds, -- expect 0
  (select count(*) from public.profiles) as anon_profiles;                   -- expect 0

-- ============================================================================
-- 5. Entity-consistency trigger: insert a project under DreamSign's client but
--    tagged with Bennett & Co's entity_id -- the exact cross-entity bug class
--    the Blueprint calls out. Expect: REJECTED with an "entity law violation" error.
-- ============================================================================
reset role;
insert into public.projects (client_id, entity_id, name)
values ('a1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Mismatched Entity Attack');
-- expect: ERROR P0001, "entity law violation: project.entity_id (...) does not match client.entity_id (...)"
