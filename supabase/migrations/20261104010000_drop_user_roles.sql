-- P0: drop legacy user_roles mirror. profiles.role is the single source of truth.
-- private.grant_role stops writing the mirror before the table is dropped.

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
end;
$$;

revoke execute on function private.grant_role(uuid, public.app_role)
  from public, anon, authenticated;

drop policy if exists "user_roles: read own" on public.user_roles;
drop policy if exists "user_roles: admin reads all" on public.user_roles;

drop table if exists public.user_roles;
