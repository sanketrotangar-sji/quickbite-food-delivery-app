-- ============================================================
-- 06_rpcs.sql
-- ============================================================

-- ------------------------------------------------------------
-- place_order()  —  cart → order + order_items, cart cleared
-- ------------------------------------------------------------
create or replace function public.place_order(
  p_delivery_address text,
  p_notes            text default null,
  p_delivery_lat     numeric default null,
  p_delivery_lng     numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer      uuid := (select auth.uid());
  v_restaurant    uuid;
  v_restaurant_ct integer;
  v_is_open       boolean;
  v_total         numeric(10,2);
  v_order_id      uuid;
begin
  if v_customer is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'A delivery address is required.' using errcode = '22023';
  end if;

  -- Lock this customer's cart rows for the duration of the transaction so
  -- a double-tap on "Place Order" can't create two orders from one cart.
  perform 1 from public.cart_items
   where customer_id = v_customer
   for update;

  select count(distinct restaurant_id) into v_restaurant_ct
  from public.cart_items where customer_id = v_customer;

  if v_restaurant_ct = 0 then
    raise exception 'CART_EMPTY' using
      message = 'Your cart is empty.', errcode = 'P0001';
  end if;

  if v_restaurant_ct > 1 then
    raise exception 'CART_MIXED' using
      message = 'Cart contains items from more than one restaurant.',
      errcode = 'P0001';
  end if;

  select restaurant_id into v_restaurant
  from public.cart_items where customer_id = v_customer limit 1;

  select is_open into v_is_open
  from public.restaurants where id = v_restaurant;

  if v_is_open is not true then
    raise exception 'RESTAURANT_CLOSED' using
      message = 'This restaurant is closed right now.', errcode = 'P0001';
  end if;

  -- Re-check availability at the moment of ordering. The item may have
  -- been switched off while it sat in the cart.
  if exists (
    select 1
    from public.cart_items c
    join public.menu_items m on m.id = c.menu_item_id
    where c.customer_id = v_customer
      and (m.is_available is not true or m.restaurant_id <> v_restaurant)
  ) then
    raise exception 'ITEM_UNAVAILABLE' using
      message = 'One or more items are no longer available.', errcode = 'P0001';
  end if;

  -- The total is computed from menu_items.price on the server.
  -- The client's idea of the price is never used for anything.
  select sum(c.quantity * m.price) into v_total
  from public.cart_items c
  join public.menu_items m on m.id = c.menu_item_id
  where c.customer_id = v_customer;

  insert into public.orders (
    customer_id, restaurant_id, status, total_amount,
    delivery_address, delivery_lat, delivery_lng, notes
  )
  values (
    v_customer, v_restaurant, 'placed', v_total,
    trim(p_delivery_address), p_delivery_lat, p_delivery_lng, p_notes
  )
  returning id into v_order_id;

  -- Snapshot name and price at this instant.
  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
  select v_order_id, m.id, m.name, c.quantity, m.price
  from public.cart_items c
  join public.menu_items m on m.id = c.menu_item_id
  where c.customer_id = v_customer;

  delete from public.cart_items where customer_id = v_customer;

  return v_order_id;
end;
$$;

-- ------------------------------------------------------------
-- restaurant_set_order_status()  —  placed → preparing → ready
-- ------------------------------------------------------------
create or replace function public.restaurant_set_order_status(
  p_order_id uuid,
  p_status   public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant uuid;
  v_row        public.orders;
begin
  select id into v_restaurant
  from public.restaurants where owner_id = (select auth.uid());

  if v_restaurant is null then
    raise exception 'You do not manage a restaurant.' using errcode = '42501';
  end if;

  if p_status not in ('preparing', 'ready', 'cancelled') then
    raise exception 'A restaurant cannot set status %.', p_status
      using errcode = '22023';
  end if;

  -- The legal-transition rules live in this WHERE clause. If the order is
  -- in the wrong state, zero rows update and we raise below.
  update public.orders
     set status = p_status
   where id            = p_order_id
     and restaurant_id = v_restaurant
     and (
          (p_status = 'preparing' and status = 'placed')
       or (p_status = 'ready'     and status = 'preparing')
       or (p_status = 'cancelled' and status in ('placed', 'preparing'))
     )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVALID_TRANSITION' using
      message = 'That order is not in a state where this change is allowed.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- claim_delivery()  —  the race-safe one
-- ------------------------------------------------------------
create or replace function public.claim_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
begin
  if (select private.current_role()) <> 'rider' then
    raise exception 'Only riders can claim deliveries.' using errcode = '42501';
  end if;

  -- Claiming sets rider_id ONLY. Status stays 'preparing'/'ready'.
  -- The rider is now assigned and waits for the kitchen.
  update public.orders
     set rider_id = (select auth.uid())
   where id       = p_order_id
     and rider_id is null                          -- <<< the race guard
     and status in ('preparing', 'ready')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ALREADY_CLAIMED' using
      message = 'Someone else already picked up this delivery.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- rider_set_order_status()  —  ready → out_for_delivery → delivered
-- ------------------------------------------------------------
create or replace function public.rider_set_order_status(
  p_order_id uuid,
  p_status   public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
begin
  if p_status not in ('out_for_delivery', 'delivered') then
    raise exception 'A rider cannot set status %.', p_status using errcode = '22023';
  end if;

  update public.orders
     set status = p_status
   where id       = p_order_id
     and rider_id = (select auth.uid())          -- must be MY delivery
     and (
          (p_status = 'out_for_delivery' and status = 'ready')
       or (p_status = 'delivered'        and status = 'out_for_delivery')
     )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVALID_TRANSITION' using
      message = 'Not your delivery, or the order is not ready for that step.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- permissions: revoke from everyone, grant only to signed-in users
-- ------------------------------------------------------------
revoke execute on function public.place_order(text, text, numeric, numeric) from public, anon;
revoke execute on function public.restaurant_set_order_status(uuid, public.order_status) from public, anon;
revoke execute on function public.claim_delivery(uuid) from public, anon;
revoke execute on function public.rider_set_order_status(uuid, public.order_status) from public, anon;

grant execute on function public.place_order(text, text, numeric, numeric) to authenticated;
grant execute on function public.restaurant_set_order_status(uuid, public.order_status) to authenticated;
grant execute on function public.claim_delivery(uuid) to authenticated;
grant execute on function public.rider_set_order_status(uuid, public.order_status) to authenticated;