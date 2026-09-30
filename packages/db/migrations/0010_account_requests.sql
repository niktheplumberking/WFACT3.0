-- WFACT 3.0 — account requests: sign-up with email + password, approved by an owner/admin.
-- Huraira's decision (2026-09-30): anyone may create an account, but it has NO access until an
-- owner (any role) or an admin (pm role only) approves it. Only an owner can grant admin or owner.
--
-- Design: a new sign-up creates an auth.users row and, by trigger, a PENDING account_requests row.
-- It gets NO profiles row, so every existing RLS policy (which keys off profiles) grants it nothing.
-- Approval goes through one audited SECURITY DEFINER function that creates the profile.
--
-- Also fixes a pre-existing hole found while reading 0005: policy profiles_owner_manage let an
-- ADMIN write any profiles row, i.e. an admin could promote themselves to owner. Profile writes are
-- now owner-only; admins can only create pm profiles through decide_account_request().

-- ---- helper: owner-only check (private schema, same pattern as 0005) ----
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false);
$$;

-- ---- account_requests ----
create table if not exists public.account_requests (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  email         text not null check (length(email) between 3 and 320),
  full_name     text check (full_name is null or length(full_name) <= 200),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at  timestamptz not null default now(),
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  decided_role  text check (decided_role in ('owner', 'admin', 'pm')),
  decision_note text check (decision_note is null or length(decision_note) <= 1000)
);

comment on table public.account_requests is
  'Sign-up requests (migration 0010). Rows are created only by the auth.users trigger and changed only '
  'by decide_account_request(); no role can insert/update/delete through PostgREST.';

create index if not exists idx_account_requests_status on public.account_requests(status, requested_at desc);

alter table public.account_requests enable row level security;

-- A requester sees their own row (to show "waiting for approval"); owner/admin see all.
create policy account_requests_select on public.account_requests
  for select
  using (user_id = auth.uid() or private.is_owner_or_admin());

-- No insert/update/delete policies: writers are the trigger and decide_account_request() only.
revoke all on public.account_requests from anon, authenticated;
grant select on public.account_requests to authenticated;

-- ---- trigger: every new auth user becomes a pending request (never a profile) ----
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.account_requests (user_id, email, full_name)
    values (
      new.id,
      coalesce(new.email, ''),
      nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 200), '')
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_request on auth.users;
create trigger on_auth_user_created_request
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Backfill: any existing auth user with no profile becomes a pending request (none today).
insert into public.account_requests (user_id, email)
select u.id, coalesce(u.email, '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (user_id) do nothing;

-- ---- decision function (the only way a profile is created for a new account) ----
create or replace function public.decide_account_request(
  p_user_id uuid,
  p_decision text,
  p_role text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  req public.account_requests%rowtype;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'only an owner or admin can decide account requests' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'decision must be approve or reject' using errcode = 'invalid_parameter_value';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'you cannot decide your own account request' using errcode = 'insufficient_privilege';
  end if;

  select * into req from public.account_requests where user_id = p_user_id for update;
  if not found then
    raise exception 'no such account request' using errcode = 'no_data_found';
  end if;
  if req.status <> 'pending' then
    raise exception 'request is already %', req.status using errcode = 'invalid_parameter_value';
  end if;

  if p_decision = 'approve' then
    if p_role is null or p_role not in ('owner', 'admin', 'pm') then
      raise exception 'approve needs a role: owner, admin or pm' using errcode = 'invalid_parameter_value';
    end if;
    if caller_role = 'admin' and p_role <> 'pm' then
      raise exception 'an admin can only approve pm accounts' using errcode = 'insufficient_privilege';
    end if;
    insert into public.profiles (id, role, full_name) values (req.user_id, p_role, req.full_name);
    update public.account_requests
       set status = 'approved', decided_by = auth.uid(), decided_at = now(),
           decided_role = p_role, decision_note = left(p_note, 1000)
     where user_id = p_user_id;
  else
    update public.account_requests
       set status = 'rejected', decided_by = auth.uid(), decided_at = now(),
           decision_note = left(p_note, 1000)
     where user_id = p_user_id;
  end if;

  insert into public.audit_log (actor, action, outcome, payload)
  values (
    auth.uid()::text,
    case when p_decision = 'approve' then 'account.approved' else 'account.rejected' end,
    'success',
    jsonb_build_object('user_id', req.user_id, 'email', req.email, 'role', p_role, 'decider_role', caller_role)
  );
end;
$$;

revoke all on function public.decide_account_request(uuid, text, text, text) from public, anon;
grant execute on function public.decide_account_request(uuid, text, text, text) to authenticated;

-- ---- close the admin-can-write-profiles hole (see header) ----
drop policy if exists profiles_owner_manage on public.profiles;

create policy profiles_owner_insert on public.profiles
  for insert with check (private.is_owner());
create policy profiles_owner_update on public.profiles
  for update using (private.is_owner()) with check (private.is_owner());
create policy profiles_owner_delete on public.profiles
  for delete using (private.is_owner());
