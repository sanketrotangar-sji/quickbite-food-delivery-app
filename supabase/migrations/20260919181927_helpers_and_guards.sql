-- ============================================================
-- 03_helpers_and_guards.sql
-- ============================================================

create schema if not exists private;

-- Nobody reaches into this schema over the API.
revoke all on schema private from anon, authenticated;
grant usage on schema private to authenticated;

-- ---------- helper: what role am I? ----------
create or replace function private.current_role()
returns public.app_role
language sql
stable                    -- same answer within one statement → cacheable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- ---------- helper: which restaurant do I own? ----------
-- Returns null if the caller isn't a manager, which makes every
-- "restaurant_id = my_restaurant_id()" comparison safely false.
create or replace function private.my_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.restaurants where owner_id = (select auth.uid());
$$;

-- ---------- helper: am I involved in an order with this person? ----------
-- Lets a customer see their rider's name, a rider see the customer's phone,
-- and a manager see the customer's name — without opening profiles to all.
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
            o.customer_id = auth.uid()
         or o.rider_id    = auth.uid()
         or o.restaurant_id = (
              select r.id from public.restaurants r where r.owner_id = auth.uid()
            )
      )
  );
$$;

grant execute on function private.current_role()          to authenticated;
grant execute on function private.my_restaurant_id()      to authenticated;
grant execute on function private.shares_order_with(uuid) to authenticated;

-- ============================================================
-- Blocking role escalation — two independent layers
-- ============================================================

-- Layer 1: column-level privileges.
-- Supabase grants broad table privileges to `authenticated` by default.
-- Take UPDATE away entirely, then hand back only the two safe columns.
revoke update on public.profiles from authenticated;
grant  update (full_name, phone) on public.profiles to authenticated;

-- Layer 2: a trigger, in case a future migration re-grants the column.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() is null when called with the secret key (server-side /
  -- Edge Function), so admin code can still change roles deliberately.
  if (select auth.uid()) is not null then
    if new.role is distinct from old.role then
      raise exception 'You cannot change your own role.' using errcode = '42501';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Email is managed by Supabase Auth.' using errcode = '42501';
    end if;
  end if;

  new.id         := old.id;      -- id is immutable, full stop
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;

create trigger profiles_guard_update
  before update on public.profiles
  for each row
  execute function public.guard_profile_update();