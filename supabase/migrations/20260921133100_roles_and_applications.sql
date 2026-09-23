-- ============================================================
-- Multi-role identities, partner applications, branches, invites,
-- and same-account self-dealing guards.
-- ============================================================

-- ---------- restaurants: many branches per owner ----------
alter table public.restaurants
  drop constraint if exists restaurants_one_per_owner;

alter table public.restaurants
  add column if not exists branch_name text;

-- ---------- extra roles (customer stays on profiles.role) ----------
create table if not exists public.user_roles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------- applications (admin-reviewed) ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'application_kind') then
    create type public.application_kind as enum ('rider', 'restaurant_owner');
  end if;
  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type public.member_status as enum ('active', 'revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'revoked');
  end if;
end
$$;

create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  applicant_id  uuid not null references public.profiles(id) on delete cascade,
  kind          public.application_kind not null,
  status        public.application_status not null default 'pending',
  payload       jsonb not null default '{}'::jsonb,
  review_note   text,
  reviewed_by   uuid references public.profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists applications_one_pending
  on public.applications (applicant_id, kind)
  where status = 'pending';

create index if not exists applications_status_idx
  on public.applications (status, created_at desc);

-- ---------- hired managers per branch ----------
create table if not exists public.restaurant_members (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  status        public.member_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index if not exists restaurant_members_user_idx
  on public.restaurant_members (user_id)
  where status = 'active';

-- ---------- owner invites a manager by email ----------
create table if not exists public.manager_invites (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email         text not null,
  invited_by    uuid not null references public.profiles(id) on delete cascade,
  status        public.invite_status not null default 'pending',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint manager_invites_email_lower check (email = lower(trim(email)))
);

create unique index if not exists manager_invites_one_pending
  on public.manager_invites (restaurant_id, email)
  where status = 'pending';

-- ---------- backfill ----------
insert into public.user_roles (user_id, role)
select id, 'customer'::public.app_role
from public.profiles
on conflict do nothing;

insert into public.user_roles (user_id, role)
select p.id, 'restaurant_owner'::public.app_role
from public.profiles p
where p.role = 'restaurant_manager'
   or exists (select 1 from public.restaurants r where r.owner_id = p.id)
on conflict do nothing;

insert into public.user_roles (user_id, role)
select id, 'rider'::public.app_role
from public.profiles
where role = 'rider'
on conflict do nothing;

-- Identity column stays customer; extra capabilities live in user_roles.
update public.profiles
set role = 'customer'
where role is distinct from 'customer';

-- ---------- updated_at ----------
drop trigger if exists applications_touch on public.applications;
create trigger applications_touch
  before update on public.applications
  for each row execute function public.touch_updated_at();

drop trigger if exists restaurant_members_touch on public.restaurant_members;
create trigger restaurant_members_touch
  before update on public.restaurant_members
  for each row execute function public.touch_updated_at();

-- ---------- helpers ----------
create or replace function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = p_role
  );
$$;

create or replace function private.owns_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurants
    where id = p_restaurant_id
      and owner_id = (select auth.uid())
  );
$$;

create or replace function private.manages_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.owns_restaurant(p_restaurant_id)
    or exists (
      select 1
      from public.restaurant_members m
      where m.restaurant_id = p_restaurant_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    );
$$;

-- Kept for older storage/RLS callers; prefer manages_restaurant().
create or replace function private.my_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.id
  from public.restaurants r
  where r.owner_id = (select auth.uid())
  union
  select m.restaurant_id
  from public.restaurant_members m
  where m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1;
$$;

create or replace function private.shares_order_with(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where (o.customer_id = target_id or o.rider_id = target_id)
      and (
           o.customer_id = (select auth.uid())
        or o.rider_id    = (select auth.uid())
        or private.manages_restaurant(o.restaurant_id)
      )
  );
$$;

create or replace function private.grant_role(p_user_id uuid, p_role public.app_role)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict do nothing;
$$;

create or replace function private.revoke_manager_role_if_unused(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.restaurant_members
    where user_id = p_user_id
      and status = 'active'
  ) then
    delete from public.user_roles
    where user_id = p_user_id
      and role = 'restaurant_manager';
  end if;
end;
$$;

grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.owns_restaurant(uuid) to authenticated;
grant execute on function private.manages_restaurant(uuid) to authenticated;
grant execute on function private.my_restaurant_id() to authenticated;
grant execute on function private.shares_order_with(uuid) to authenticated;

revoke execute on function private.grant_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function private.revoke_manager_role_if_unused(uuid) from public, anon, authenticated;

-- ---------- auth trigger: always customer ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'phone',
    'customer'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;

-- ---------- grants ----------
grant select on public.user_roles to authenticated;
grant select on public.applications to authenticated;
grant select on public.restaurant_members to authenticated;
grant select on public.manager_invites to authenticated;

alter table public.user_roles           enable row level security;
alter table public.applications         enable row level security;
alter table public.restaurant_members   enable row level security;
alter table public.manager_invites      enable row level security;
