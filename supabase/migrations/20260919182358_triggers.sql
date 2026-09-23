-- ============================================================
-- 05_triggers.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. updated_at, everywhere
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger restaurants_touch  before update on public.restaurants
  for each row execute function public.touch_updated_at();
create trigger menu_items_touch   before update on public.menu_items
  for each row execute function public.touch_updated_at();
create trigger orders_touch       before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger cart_items_touch   before update on public.cart_items
  for each row execute function public.touch_updated_at();
-- (profiles already gets updated_at set inside guard_profile_update)

-- ------------------------------------------------------------
-- 2. order_status_history — the audit trail
-- ------------------------------------------------------------
create or replace function public.log_order_status()
returns trigger
language plpgsql
security definer          -- so it can insert where users have no policy
set search_path = ''
as $$
begin
  insert into public.order_status_history (order_id, status, changed_by)
  values (new.id, new.status, (select auth.uid()));
  return null;            -- AFTER triggers ignore the return value
end;
$$;

-- Two separate triggers rather than one INSERT OR UPDATE trigger:
-- a WHEN clause cannot reference OLD on an INSERT.
create trigger orders_log_status_on_insert
  after insert on public.orders
  for each row
  execute function public.log_order_status();

create trigger orders_log_status_on_update
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.log_order_status();