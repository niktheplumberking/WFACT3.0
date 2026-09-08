-- WFACT 3.0 — Phase 2: entity law as a schema constraint, not just convention.
-- This is the direct, generalized fix for the cross-entity invoice-numbering class of bug
-- (Ecosystem Blueprint §4, Phase 1: "correcting the cross-entity invoice numbering class of bug
-- at the schema level (constraint, not just a caught test)"). Applied to every child of `clients`,
-- not only invoices -- a project or task can never silently point at the wrong entity again.

create or replace function public.enforce_project_entity_matches_client()
returns trigger
language plpgsql
as $$
declare
  client_entity_id uuid;
begin
  select entity_id into client_entity_id from public.clients where id = new.client_id;
  if client_entity_id is null then
    raise exception 'project.client_id % does not reference an existing client', new.client_id;
  end if;
  if new.entity_id <> client_entity_id then
    raise exception
      'entity law violation: project.entity_id (%) does not match client.entity_id (%) for client %',
      new.entity_id, client_entity_id, new.client_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_project_entity_consistency on public.projects;
create trigger trg_project_entity_consistency
  before insert or update on public.projects
  for each row execute function public.enforce_project_entity_matches_client();

create or replace function public.enforce_task_entity_matches_project()
returns trigger
language plpgsql
as $$
declare
  project_entity_id uuid;
begin
  select entity_id into project_entity_id from public.projects where id = new.project_id;
  if project_entity_id is null then
    raise exception 'task.project_id % does not reference an existing project', new.project_id;
  end if;
  if new.entity_id <> project_entity_id then
    raise exception
      'entity law violation: task.entity_id (%) does not match project.entity_id (%) for project %',
      new.entity_id, project_entity_id, new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_task_entity_consistency on public.tasks;
create trigger trg_task_entity_consistency
  before insert or update on public.tasks
  for each row execute function public.enforce_task_entity_matches_project();

-- correction_rounds inherits its entity scope from the project; no direct entity_id column to
-- keep it minimal (Operator's Manual Phase 2 scope), so no trigger needed here.
