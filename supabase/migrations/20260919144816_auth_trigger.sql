-- ============================================================
-- 02_auth_trigger.sql
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer          -- must bypass RLS: there's no logged-in user yet
set search_path = ''      -- security hardening, explained below
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  resolved_role  public.app_role;
begin
  -- Only accept the three known roles. Anything else (including an
  -- attacker sending role:'admin') silently falls back to customer.
  if requested_role in ('customer', 'restaurant_manager', 'rider') then
    resolved_role := requested_role::public.app_role;
  else
    resolved_role := 'customer';
  end if;

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',   -- our email signup form
      new.raw_user_meta_data ->> 'name',        -- what Google sends
      split_part(new.email, '@', 1)             -- last resort
    ),
    new.raw_user_meta_data ->> 'phone',
    resolved_role
  )
  on conflict (id) do nothing;   -- idempotent: safe if it somehow fires twice

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();