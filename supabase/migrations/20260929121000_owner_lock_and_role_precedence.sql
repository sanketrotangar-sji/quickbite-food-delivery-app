-- C1: lock restaurants.owner_id / id from non-owners.
-- C4: private.grant_role never downgrades role precedence.

create or replace function private.guard_restaurant_owner_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Migrations / service role / SQL editor often have null auth.uid().
  if (select auth.uid()) is null then
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'Restaurant id cannot be changed.' using errcode = '42501';
  end if;

  if new.owner_id is distinct from old.owner_id then
    if (select auth.uid()) is distinct from old.owner_id then
      raise exception 'Only the current restaurant owner can transfer ownership.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists restaurants_guard_owner_id on public.restaurants;
create trigger restaurants_guard_owner_id
  before update on public.restaurants
  for each row execute function private.guard_restaurant_owner_id();

revoke all on function private.guard_restaurant_owner_id() from public, anon, authenticated;

-- Precedence: admin > restaurant_owner > restaurant_manager > rider > customer.
-- grant_role only moves role UP (or equal rewrite); never silently downgrades.
create or replace function private.role_rank(p_role public.app_role)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'admin' then 5
    when 'restaurant_owner' then 4
    when 'restaurant_manager' then 3
    when 'rider' then 2
    when 'customer' then 1
    else 0
  end;
$$;

create or replace function private.grant_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.app_role;
  v_next public.app_role;
begin
  select role into v_current from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Profile not found for role grant.' using errcode = 'P0001';
  end if;

  if private.role_rank(p_role) >= private.role_rank(v_current) then
    v_next := p_role;
  else
    v_next := v_current;
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
     set role = v_next
   where id = p_user_id;

  delete from public.user_roles
   where user_id = p_user_id
     and role is distinct from v_next;

  insert into public.user_roles (user_id, role)
  values (p_user_id, v_next)
  on conflict do nothing;
end;
$$;

revoke execute on function private.grant_role(uuid, public.app_role)
  from public, anon, authenticated;
revoke all on function private.role_rank(public.app_role)
  from public, anon, authenticated;
