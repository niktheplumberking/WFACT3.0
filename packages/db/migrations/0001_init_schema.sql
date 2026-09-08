-- WFACT 3.0 — Phase 2: State layer, initial schema
-- Entities, clients, projects, tasks, correction rounds, profiles/roles.
-- Entity law (CLAUDE.md §5): one client per entity. Schema is N-capable — entities is a real table,
-- never hardcoded to 2, even though only 2 are active for this build phase (see memory/context.md).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- entities: the accounting/paperwork boundary. N-capable by design.
-- ---------------------------------------------------------------------------
create table if not exists public.entities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now()
);

comment on table public.entities is
  'The paperwork/accounting boundary. One client per entity (entity law, CLAUDE.md §5). '
  'Never hardcode to a fixed count -- Nick has SaaS plans that will add more later.';

-- ---------------------------------------------------------------------------
-- clients: one per entity, by law.
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  entity_id   uuid not null references public.entities(id),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles: extends auth.users with a role. Owner sees everything, admin sees
-- operational panels (not cost/margin), PM sees only assigned clients
-- (Ecosystem Blueprint §9 permissions design).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'pm')),
  full_name   text,
  created_at  timestamptz not null default now()
);

-- PM-to-client scoping. Owner/admin bypass this entirely (see RLS policies, migration 0003).
create table if not exists public.profile_clients (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  primary key (profile_id, client_id)
);

-- ---------------------------------------------------------------------------
-- projects: belongs to a client. entity_id is denormalized and enforced
-- consistent with the parent client's entity via trigger (migration 0002) --
-- this is the schema-level fix for the cross-entity invoice-numbering class
-- of bug the Blueprint calls out, generalized to every child table, not just
-- invoices.
-- ---------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id),
  entity_id   uuid not null references public.entities(id),
  name        text not null,
  -- the 11-stage pipeline, Playbook §7
  stage       text not null default '0_onboarding' check (stage in (
    '0_onboarding', '1_intake', '2_research_direction', '3_assets',
    '4_homepage_build', '5_direction_lock', '6_full_build_owners_key',
    '7_qa_security', '8_launch', '9_content_bank', '10_post_mortem'
  )),
  status      text not null default 'active' check (status in ('active', 'paused', 'launched', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks: every unit of work is a typed object with an owner, a deadline, and
-- a retry budget (Ecosystem Blueprint §3) -- never a free-form prompt.
-- entity_id denormalized + trigger-enforced same as projects.
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id),
  entity_id     uuid not null references public.entities(id),
  title         text not null,
  status        text not null default 'pending' check (status in ('pending', 'in_progress', 'blocked', 'done', 'failed')),
  owner         text not null,          -- role/agent/human identifier, e.g. 'front_end_agent', 'nick'
  deadline      timestamptz,
  retry_count   int not null default 0,
  retry_budget  int not null default 3, -- bounded retries, exponential backoff owned by the caller, escalate on exhaustion
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- correction_rounds: the actual measured metric this sprint exists to
-- produce (Operator's Manual Phase 4/7) -- every "built -> flagged -> fixed"
-- round, logged honestly, comparable against DreamSign's 40+ batch baseline.
-- ---------------------------------------------------------------------------
create table if not exists public.correction_rounds (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id),
  round_number int not null,
  stage        text not null,
  flagged_by   text not null,   -- which check / evaluator / human caught it
  issue        text not null,
  fixed_by     text,
  created_at   timestamptz not null default now(),
  unique (project_id, round_number)
);

create index if not exists idx_clients_entity on public.clients(entity_id);
create index if not exists idx_projects_client on public.projects(client_id);
create index if not exists idx_projects_entity on public.projects(entity_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_entity on public.tasks(entity_id);
create index if not exists idx_correction_rounds_project on public.correction_rounds(project_id);
