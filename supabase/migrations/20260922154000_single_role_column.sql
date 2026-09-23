-- profiles.role is the only authorization source.
-- Precedence when a person currently has several user_roles rows:
-- admin, restaurant_owner, restaurant_manager, rider, otherwise customer.
-- user_roles is rewritten to a single mirror row and is not read by RLS or RPCs.

update public.profiles p
set role = coalesce(
  (
    select ur.role
    from public.user_roles ur
    where ur.user_id = p.id
    order by case ur.role
      when 'admin' then 1
      when 'restaurant_owner' then 2
      when 'restaurant_manager' then 3
      when 'rider' then 4
      when 'customer' then 5
      else 6
    end
    limit 1
  ),
  'customer'::public.app_role
);

delete from public.user_roles ur
using public.profiles p
where ur.user_id = p.id
  and ur.role is distinct from p.role;

insert into public.user_roles (user_id, role)
select id, role
from public.profiles
on conflict do nothing;

create or replace function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = p_role
  );
$$;

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid());
$$;

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null for the database owner (migrations, SQL editor).
  -- grant_role sets app.allow_role_change for the rest of this transaction.
  -- Clients still have no UPDATE privilege on profiles.role.
  if (select auth.uid()) is not null then
    if new.role is distinct from old.role
       and coalesce(current_setting('app.allow_role_change', true), '') is distinct from 'on' then
      raise exception 'You cannot change your own role.' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is managed by Supabase Auth.' using errcode = '42501';
    end if;
  end if;

  new.id         := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.grant_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
     set role = p_role
   where id = p_user_id;

  delete from public.user_roles
   where user_id = p_user_id
     and role is distinct from p_role;

  insert into public.user_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict do nothing;
end;
$$;

create or replace function private.revoke_manager_role_if_unused(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.restaurant_members
    where user_id = p_user_id
      and status = 'active'
  ) then
    return;
  end if;

  if (select role from public.profiles where id = p_user_id) = 'restaurant_manager' then
    perform private.grant_role(p_user_id, 'customer');
  end if;
end;
$$;

revoke execute on function private.grant_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function private.revoke_manager_role_if_unused(uuid) from public, anon, authenticated;
