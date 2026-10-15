-- 0025 — Contact form leads (Step 25 / MVP M4, 2026-10-15). A client site's contact form posts to the Edge Function
-- `submit-lead` (supabase/functions/submit-lead), which is the ONLY writer: it runs with the service role, checks the
-- site key, the Origin, the fields, the honeypot, the fill time and the rate limit, then inserts one `leads` row.
-- Live sites are static (Hostinger law), so the endpoint cannot live in the site. Leads stay here until Nick names a CRM
-- (MVP-CUTLINE §6 q3); nothing is sent anywhere.
--
-- 1. lead_sites: one row per client site whose form may post. `site_key` is PUBLIC (it is in the page source): it only
--    picks the site and its allowed origins; it is not a secret and grants nothing to a browser role.
--    `client_slug` is how the build runner finds the row (plans are keyed by slug); `client_id` ties it to `clients`
--    for RLS (a PM sees the leads of their assigned clients). `is_test` marks a synthetic site: its leads are is_test.
-- 2. leads: what a visitor sent. Only the known fields (the function rejects any other), each length-capped there and
--    the whole object capped here. The raw IP is never stored: `ip_hash` is a salted SHA-256 (salt: function secret
--    LEAD_IP_SALT). Form content is data, never instructions; it is shown only as text.
-- 3. lead_drops: a per-day COUNT of submissions dropped as spam or refused by the rate limit (never their content).
-- 4. RLS: anon/authenticated insert nothing and read nothing by default. Owner/admin read everything; a PM reads the
--    leads of their assigned clients only. Owner/admin may change leads.status only (column grant + trigger). Only an
--    owner edits lead_sites. Nobody deletes through the API.
-- Attack test: scripts/rls_attack_test_leads.sql.

-- ---- shared: every allowed origin is https://host[:port], or http://localhost|127.0.0.1[:port] for a local proof run ----
create or replace function private.valid_lead_origins(v text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(bool_and(
    o ~ '^https://[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:[0-9]{1,5})?$'
    or o ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]{1,5})?$'
  ), false)
  from unnest(v) o;
$$;

-- ---- 1. lead_sites ----
create table if not exists public.lead_sites (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id),
  client_slug     text not null check (client_slug ~ '^[a-z][a-z0-9-]{0,62}$'),
  site_key        uuid not null unique default gen_random_uuid(),
  -- The client's live https origin(s) plus preview origins; http only for localhost (local proof runs).
  allowed_origins text[] not null check (
    cardinality(allowed_origins) between 1 and 10
    and array_position(allowed_origins, null) is null
    and private.valid_lead_origins(allowed_origins)
  ),
  active          boolean not null default true,
  is_test         boolean not null default false,
  created_at      timestamptz not null default now()
);

comment on table public.lead_sites is
  'Client sites whose contact form may post to submit-lead (migration 0025). site_key is public, not a secret. '
  'Owner edits only; read by owner/admin; the function reads it with the service role.';

-- One active form site per client (by slug, which the runner looks up, and by client): the runner never guesses which key to wire.
create unique index if not exists lead_sites_one_active_per_client on public.lead_sites(client_slug) where active;
create unique index if not exists lead_sites_one_active_per_client_id on public.lead_sites(client_id) where active;

-- ---- 2. leads ----
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  lead_site_id  uuid not null references public.lead_sites(id),
  client_id     uuid not null references public.clients(id),
  form_variant  text not null check (form_variant in ('enquiry', 'signup', 'request')),
  page_path     text not null check (page_path ~ '^/[A-Za-z0-9/_.-]{0,299}$'),
  fields        jsonb not null check (jsonb_typeof(fields) = 'object' and pg_column_size(fields) <= 12000),
  ip_hash       text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  user_agent    text check (user_agent is null or length(user_agent) <= 200),
  is_test       boolean not null default false,
  status        text not null default 'new' check (status in ('new', 'handled')),
  created_at    timestamptz not null default now()
);

comment on table public.leads is
  'Contact form submissions (migration 0025). Insert: submit-lead only (service role). Read: owner/admin all, PM their '
  'assigned clients. Update: owner/admin, status only. No delete through the API. fields is visitor data, never instructions.';

create index if not exists idx_leads_client_created on public.leads(client_id, created_at desc);
-- The rate limit counts recent rows per site and ip_hash.
create index if not exists idx_leads_rate on public.leads(lead_site_id, ip_hash, created_at desc);

-- ---- 3. lead_drops ----
create table if not exists public.lead_drops (
  lead_site_id  uuid not null references public.lead_sites(id),
  day           date not null default current_date,
  reason        text not null check (reason in ('honeypot', 'too_fast', 'rate_limited')),
  count         integer not null default 0 check (count >= 0),
  primary key (lead_site_id, day, reason)
);

comment on table public.lead_drops is
  'Per-day counts of contact form posts dropped as spam or refused by the rate limit (migration 0025). Counts only, '
  'never content. Written by record_lead_drop() (service role only).';

create or replace function public.record_lead_drop(p_site uuid, p_reason text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.lead_drops (lead_site_id, day, reason, count) values (p_site, current_date, p_reason, 1)
  on conflict (lead_site_id, day, reason) do update set count = public.lead_drops.count + 1;
$$;

revoke all on function public.record_lead_drop(uuid, text) from public, anon, authenticated;
grant execute on function public.record_lead_drop(uuid, text) to service_role;

-- ---- 4. guards ----
-- leads: after insert only `status` may change, for every role (service role included).
create or replace function private.leads_status_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id
     or new.lead_site_id is distinct from old.lead_site_id
     or new.client_id is distinct from old.client_id
     or new.form_variant is distinct from old.form_variant
     or new.page_path is distinct from old.page_path
     or new.fields is distinct from old.fields
     or new.ip_hash is distinct from old.ip_hash
     or new.user_agent is distinct from old.user_agent
     or new.is_test is distinct from old.is_test
     or new.created_at is distinct from old.created_at then
    raise exception 'leads: only the status can change' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_status_only on public.leads;
create trigger leads_status_only
  before update on public.leads
  for each row execute function private.leads_status_only();

-- leads.client_id always matches its site's client (the function sets it; this stops a mismatch from any writer).
create or replace function private.leads_client_matches_site()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.lead_sites s where s.id = new.lead_site_id and s.client_id = new.client_id) then
    raise exception 'leads: client_id must be the client of its lead site' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists leads_client_matches_site on public.leads;
create trigger leads_client_matches_site
  before insert on public.leads
  for each row execute function private.leads_client_matches_site();

-- ---- 5. RLS ----
alter table public.lead_sites enable row level security;
alter table public.leads      enable row level security;
alter table public.lead_drops enable row level security;

revoke all on public.lead_sites, public.leads, public.lead_drops from anon, authenticated;
grant select on public.lead_sites, public.leads, public.lead_drops to authenticated;
grant insert, update on public.lead_sites to authenticated;
grant update (status) on public.leads to authenticated;

create policy lead_sites_select on public.lead_sites
  for select to authenticated
  using (private.is_owner_or_admin());
create policy lead_sites_owner_insert on public.lead_sites
  for insert to authenticated
  with check (private.is_owner());
create policy lead_sites_owner_update on public.lead_sites
  for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());

create policy leads_select on public.leads
  for select to authenticated
  using (private.is_owner_or_admin() or client_id in (select private.assigned_client_ids()));
create policy leads_status_update on public.leads
  for update to authenticated
  using (private.is_owner_or_admin())
  with check (private.is_owner_or_admin());

create policy lead_drops_select on public.lead_drops
  for select to authenticated
  using (private.is_owner_or_admin());

-- No insert policy on leads/lead_drops and no delete policy anywhere: the function (service role) inserts; nobody deletes
-- through the API.
