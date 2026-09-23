-- ------------------------------------------------------------
-- 3. cart rules: derive restaurant_id, enforce one restaurant
-- ------------------------------------------------------------
create or replace function public.enforce_cart_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant uuid;
  v_available  boolean;
begin
  -- Derive restaurant_id from the item itself. Never trust the client
  -- to tell us which restaurant an item belongs to.
  select mi.restaurant_id, mi.is_available
    into v_restaurant, v_available
  from public.menu_items mi
  where mi.id = new.menu_item_id;

  if v_restaurant is null then
    raise exception 'That menu item does not exist.' using errcode = '23503';
  end if;

  if v_available is not true then
    raise exception 'ITEM_UNAVAILABLE' using
      message = 'That item is currently unavailable.', errcode = 'P0001';
  end if;

  new.restaurant_id := v_restaurant;

  -- Single-restaurant cart.
  if exists (
    select 1 from public.cart_items c
    where c.customer_id   = new.customer_id
      and c.restaurant_id <> new.restaurant_id
      and c.id            is distinct from new.id
  ) then
    raise exception 'CART_OTHER_RESTAURANT' using
      message = 'Your cart already has items from a different restaurant.',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger cart_items_rules
  before insert or update on public.cart_items
  for each row
  execute function public.enforce_cart_rules();