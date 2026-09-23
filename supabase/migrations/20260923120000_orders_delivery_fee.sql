-- Standard delivery fee on orders. Replace the body of
-- public.standard_delivery_fee() later when pricing uses more factors.

alter table public.orders
  add column if not exists delivery_fee numeric(10,2) not null default 0
    check (delivery_fee >= 0);

comment on column public.orders.delivery_fee is
  'Delivery fee charged at place_order. total_amount = item subtotal + delivery_fee.';

-- Single source of truth for the current flat fee (₹40).
create or replace function public.standard_delivery_fee()
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 40.00::numeric(10,2);
$$;

revoke all on function public.standard_delivery_fee() from public;
grant execute on function public.standard_delivery_fee() to anon, authenticated;

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
  v_subtotal      numeric(10,2);
  v_fee           numeric(10,2);
  v_total         numeric(10,2);
  v_order_id      uuid;
begin
  if v_customer is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'A delivery address is required.' using errcode = '22023';
  end if;

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

  if private.manages_restaurant(v_restaurant) then
    raise exception 'SELF_ORDER' using
      message = 'You cannot order from a restaurant you manage.',
      errcode = 'P0001';
  end if;

  select is_open into v_is_open
  from public.restaurants where id = v_restaurant;

  if v_is_open is not true then
    raise exception 'RESTAURANT_CLOSED' using
      message = 'This restaurant is closed right now.', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items c
    join public.menu_items m on m.id = c.menu_item_id
    where c.customer_id = v_customer
      and (m.is_available is not true or m.restaurant_id <> v_restaurant)
  ) then
    raise exception 'ITEM_UNAVAILABLE' using
      message = 'One or more items are no longer available.',
      errcode = 'P0001';
  end if;

  select coalesce(sum(c.quantity * m.price), 0) into v_subtotal
  from public.cart_items c
  join public.menu_items m on m.id = c.menu_item_id
  where c.customer_id = v_customer;

  v_fee := public.standard_delivery_fee();
  v_total := v_subtotal + v_fee;

  insert into public.orders (
    customer_id, restaurant_id, status, total_amount, delivery_fee,
    delivery_address, delivery_lat, delivery_lng, notes
  )
  values (
    v_customer, v_restaurant, 'placed', v_total, v_fee,
    trim(p_delivery_address), p_delivery_lat, p_delivery_lng, p_notes
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
  select v_order_id, m.id, m.name, c.quantity, m.price
  from public.cart_items c
  join public.menu_items m on m.id = c.menu_item_id
  where c.customer_id = v_customer;

  delete from public.cart_items where customer_id = v_customer;

  return v_order_id;
end;
$$;
