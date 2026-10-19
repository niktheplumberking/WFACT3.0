-- 0028 — Step 21 K (2026-10-19): the entity list lives in public.entities, not in code.
--
-- Intake and Hermes-lite matched the entity a request is for against a hard-coded list (KNOWN_ENTITIES in
-- packages/hermes/src/controller.ts: dreamsign, bennett-co). They now read public.entities instead, so each entity
-- needs the other ways a person writes its name ("Bennett & Co" for bennett-co): a lower-case `aliases` column.
-- The live table had dreamsign and synthetic-test but no bennett-co, so switching would have stopped intake
-- recognising Bennett & Co; Huraira approved adding the row (2026-10-19). Entity law (CLAUDE.md §5): N-capable,
-- never a fixed count. RLS is unchanged (0005): owner/admin read and write; a pm reads only entities behind their
-- assigned clients; anon reads nothing. The new column inherits those policies.

alter table public.entities
  add column if not exists aliases text[] not null default '{}';

alter table public.entities drop constraint if exists entities_aliases_shape;
alter table public.entities add constraint entities_aliases_shape check (
  cardinality(aliases) <= 20
  and aliases::text = lower(aliases::text)
  and array_position(aliases, '') is null
);

comment on column public.entities.aliases is
  'Other ways a person writes this entity''s name (lower case), matched by intake and Hermes-lite (Step 21 K).';

insert into public.entities (slug, name) values ('bennett-co', 'Bennett & Co')
  on conflict (slug) do nothing;

update public.entities set aliases = array['dreamsign'] where slug = 'dreamsign' and aliases = '{}';
update public.entities set aliases = array['bennett', 'bennett & co', 'bennett and co'] where slug = 'bennett-co' and aliases = '{}';
