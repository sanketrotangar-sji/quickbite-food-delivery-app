-- Truth layer A2–A3: order discount snapshot + drop_km on place; pickup_km on claim/auto-assign.
-- Rollback: drop columns discount_amount, offer_percent from orders; restore prior RPCs from git.

alter table public.orders
  add column if not exists discount_amount numeric(10,2) not null default 0
    check (discount_amount >= 0),
  add column if not exists offer_percent integer
    check (offer_percent is null or offer_percent between 0 and 100);

comment on column public.orders.discount_amount is
  'Snapshot of kitchen offer discount applied at place_order (subtotal - discounted).';
comment on column public.orders.offer_percent is
  'Snapshot of restaurants.offer_percent at place_order.';

create or replace function public.place_order(
  p_delivery_address    text default null,
  p_notes               text default null,
  p_delivery_lat        numeric default null,
  p_delivery_lng        numeric default null,
  p_delivery_address_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer        uuid := (select auth.uid());
  v_restaurant      uuid;
  v_restaurant_ct   integer;
  v_is_open         boolean;
  v_subtotal        numeric(10,2);
  v_fee             numeric(10,2);
  v_total           numeric(10,2);
  v_order_id        uuid;
  v_address_text    text;
  v_delivery_lat    numeric(9,6);
  v_delivery_lng    numeric(9,6);
  v_offer           integer;
  v_discounted      numeric(10,2);
  v_discount_amt    numeric(10,2);
  v_rest_lat        double precision;
  v_rest_lng        double precision;
  v_drop_km         numeric(6,2);
begin
  if v_customer is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if p_delivery_address_id is not null then
    select concat_ws(
             ', ',
             trim(a.address_line),
             trim(a.area),
             case
               when nullif(trim(a.landmark), '') is not null
                 then 'Landmark: ' || trim(a.landmark)
             end
           ),
           a.lat,
           a.lng
      into v_address_text, v_delivery_lat, v_delivery_lng
      from public.customer_addresses a
     where a.id = p_delivery_address_id
       and a.customer_id = v_customer;

    if v_address_text is null then
      raise exception 'ADDRESS_NOT_FOUND' using
        message = 'That saved address does not belong to you.',
        errcode = 'P0001';
    end if;
  else
    if coalesce(trim(p_delivery_address), '') = '' then
      raise exception 'A delivery address is required.' using errcode = '22023';
    end if;

    if (p_delivery_lat is null) <> (p_delivery_lng is null)
       or (p_delivery_lat is not null and (p_delivery_lat < -90 or p_delivery_lat > 90))
       or (p_delivery_lng is not null and (p_delivery_lng < -180 or p_delivery_lng > 180)) then
      raise exception 'Invalid latitude or longitude.' using errcode = '22023';
    end if;

    v_address_text := trim(p_delivery_address);
    v_delivery_lat := p_delivery_lat;
    v_delivery_lng := p_delivery_lng;
  end if;

  perform 1
    from public.cart_items
   where customer_id = v_customer
   for update;

  select count(distinct restaurant_id)
    into v_restaurant_ct
    from public.cart_items
   where customer_id = v_customer;

  if v_restaurant_ct = 0 then
    raise exception 'CART_EMPTY' using
      message = 'Your cart is empty.',
      errcode = 'P0001';
  end if;

  if v_restaurant_ct > 1 then
    raise exception 'CART_MIXED' using
      message = 'Cart contains items from more than one restaurant.',
      errcode = 'P0001';
  end if;

  select restaurant_id
    into v_restaurant
    from public.cart_items
   where customer_id = v_customer
   limit 1;

  if private.manages_restaurant(v_restaurant) then
    raise exception 'SELF_ORDER' using
      message = 'You cannot order from a restaurant you manage.',
      errcode = 'P0001';
  end if;

  select is_open, offer_percent, lat::double precision, lng::double precision
    into v_is_open, v_offer, v_rest_lat, v_rest_lng
    from public.restaurants
   where id = v_restaurant;

  if v_is_open is not true then
    raise exception 'RESTAURANT_CLOSED' using
      message = 'This restaurant is closed right now.',
      errcode = 'P0001';
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

  select coalesce(sum(c.quantity * m.price), 0)
    into v_subtotal
    from public.cart_items c
    join public.menu_items m on m.id = c.menu_item_id
   where c.customer_id = v_customer;

  v_offer := greatest(0, least(100, coalesce(v_offer, 0)));
  v_discounted := round(v_subtotal * (100 - v_offer) / 100.0, 2);
  v_discount_amt := greatest(0, round(v_subtotal - v_discounted, 2));
  v_fee := public.standard_delivery_fee();
  v_total := v_discounted + v_fee;

  if v_rest_lat is not null
     and v_rest_lng is not null
     and v_delivery_lat is not null
     and v_delivery_lng is not null then
    v_drop_km := round(
      private.haversine_km(
        v_rest_lat,
        v_rest_lng,
        v_delivery_lat::double precision,
        v_delivery_lng::double precision
      )::numeric,
      2
    );
  end if;

  insert into public.orders (
    customer_id,
    restaurant_id,
    status,
    total_amount,
    delivery_fee,
    discount_amount,
    offer_percent,
    drop_km,
    delivery_address_id,
    delivery_address,
    delivery_lat,
    delivery_lng,
    notes
  )
  values (
    v_customer,
    v_restaurant,
    'placed',
    v_total,
    v_fee,
    v_discount_amt,
    nullif(v_offer, 0),
    v_drop_km,
    p_delivery_address_id,
    v_address_text,
    v_delivery_lat,
    v_delivery_lng,
    p_notes
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    menu_item_id,
    item_name,
    quantity,
    unit_price
  )
  select v_order_id, m.id, m.name, c.quantity, m.price
    from public.cart_items c
    join public.menu_items m on m.id = c.menu_item_id
   where c.customer_id = v_customer;

  delete from public.cart_items
   where customer_id = v_customer;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, numeric, numeric, uuid) from public;
grant execute on function public.place_order(text, text, numeric, numeric, uuid) to authenticated;

create or replace function public.claim_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider    uuid := (select auth.uid());
  v_online   boolean;
  v_customer uuid;
  v_row      public.orders;
  v_default_pay numeric(10,2) := 45.00;
  v_rest_lat double precision;
  v_rest_lng double precision;
  v_rider_lat double precision;
  v_rider_lng double precision;
  v_pickup   numeric(6,2);
begin
  if v_rider is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can claim deliveries.' using errcode = '42501';
  end if;

  select is_online
    into v_online
    from public.profiles
   where id = v_rider
     and role = 'rider'
   for share;

  if v_online is not true then
    raise exception 'RIDER_OFFLINE' using
      message = 'Go online before claiming a delivery.',
      errcode = 'P0001';
  end if;

  select customer_id
    into v_customer
    from public.orders
   where id = p_order_id;

  if v_customer is null then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if v_customer = v_rider then
    raise exception 'SELF_DELIVERY' using
      message = 'You cannot deliver an order you placed.',
      errcode = 'P0001';
  end if;

  select r.lat::double precision, r.lng::double precision
    into v_rest_lat, v_rest_lng
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
   where o.id = p_order_id;

  select rl.lat::double precision, rl.lng::double precision
    into v_rider_lat, v_rider_lng
    from public.rider_locations rl
   where rl.rider_id = v_rider;

  if v_rest_lat is not null and v_rest_lng is not null
     and v_rider_lat is not null and v_rider_lng is not null then
    v_pickup := round(
      private.haversine_km(v_rider_lat, v_rider_lng, v_rest_lat, v_rest_lng)::numeric,
      2
    );
  end if;

  update public.orders
     set rider_id = v_rider,
         rider_earning = coalesce(rider_earning, greatest(v_default_pay, round(delivery_fee * 0.6, 2))),
         pickup_km = coalesce(v_pickup, pickup_km)
   where id = p_order_id
     and rider_id is null
     and status in ('preparing', 'ready')
     and customer_id is distinct from v_rider
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ALREADY_CLAIMED' using
      message = 'This delivery is no longer available.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

create or replace function private.auto_assign_rider()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_rider uuid;
  v_dist double precision;
  v_restaurant uuid;
  v_default_pay numeric(10,2) := 45.00;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.status is distinct from 'ready' then
    return new;
  end if;
  if old.status is not distinct from 'ready' then
    return new;
  end if;
  if new.rider_id is not null then
    return new;
  end if;

  v_restaurant := new.restaurant_id;
  select r.lat::double precision, r.lng::double precision
    into v_lat, v_lng
  from public.restaurants r
  where r.id = v_restaurant;

  if v_lat is null or v_lng is null then
    insert into public.automation_events (kind, order_id, restaurant_id, payload)
    values (
      'rider_assign_skipped',
      new.id,
      v_restaurant,
      jsonb_build_object('reason', 'restaurant_missing_coordinates')
    );
    return new;
  end if;

  select cand.rider_id, cand.dist
    into v_rider, v_dist
  from (
    select
      p.id as rider_id,
      private.haversine_km(v_lat, v_lng, rl.lat::double precision, rl.lng::double precision) as dist,
      (
        select count(*)::int
        from public.orders o2
        where o2.rider_id = p.id
          and o2.status in ('preparing', 'ready', 'out_for_delivery')
      ) as open_load
    from public.profiles p
    join public.rider_locations rl on rl.rider_id = p.id
    where p.role = 'rider'
      and p.is_online = true
      and not exists (
        select 1
        from public.orders o3
        where o3.rider_id = p.id
          and o3.status in ('preparing', 'ready', 'out_for_delivery')
      )
  ) cand
  where cand.dist is not null
  order by cand.dist asc, cand.open_load asc
  limit 1;

  if v_rider is null then
    insert into public.automation_events (kind, order_id, restaurant_id, payload)
    values (
      'rider_assign_skipped',
      new.id,
      v_restaurant,
      jsonb_build_object('reason', 'no_available_rider')
    );
    return new;
  end if;

  new.rider_id := v_rider;
  new.rider_earning := coalesce(
    new.rider_earning,
    greatest(v_default_pay, round(coalesce(new.delivery_fee, 0) * 0.6, 2))
  );
  if v_dist is not null then
    new.pickup_km := coalesce(new.pickup_km, round(v_dist::numeric, 2));
  end if;

  insert into public.notifications (user_id, title, body)
  values (
    v_rider,
    'New delivery assigned',
    format('Order %s is ready for pickup. QuickBite auto-assigned you as the nearest available rider.', left(new.id::text, 8))
  );

  insert into public.notifications (user_id, title, body)
  values (
    new.customer_id,
    'Rider assigned',
    'A rider is heading to the kitchen for your order.'
  );

  insert into public.automation_events (kind, order_id, restaurant_id, payload)
  values (
    'rider_assigned',
    new.id,
    v_restaurant,
    jsonb_build_object(
      'rider_id', v_rider,
      'distance_km', round(v_dist::numeric, 3)
    )
  );

  return new;
end;
$$;
