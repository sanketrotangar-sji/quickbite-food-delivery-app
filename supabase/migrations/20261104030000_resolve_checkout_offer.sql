-- P2: single checkout discount resolver. place_order behavior unchanged.

create or replace function private.resolve_checkout_offer(
  p_customer_id uuid,
  p_restaurant_id uuid
)
returns table (
  offer_percent integer,
  campaign_id uuid,
  enrollment_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kitchen_offer integer;
  v_enroll_id uuid;
  v_campaign_id uuid;
  v_campaign_offer integer;
  v_offer integer;
begin
  select greatest(0, least(100, coalesce(r.offer_percent, 0)))
    into v_kitchen_offer
    from public.restaurants r
   where r.id = p_restaurant_id;

  v_kitchen_offer := coalesce(v_kitchen_offer, 0);

  select e.id, c.id, c.discount_percent
    into v_enroll_id, v_campaign_id, v_campaign_offer
  from public.crm_campaign_enrollments e
  join public.crm_campaigns c on c.id = e.campaign_id
  where e.customer_id = p_customer_id
    and e.redeemed_at is null
    and c.status = 'active'
    and c.starts_at <= now()
    and c.ends_at >= now()
    and (c.restaurant_id is null or c.restaurant_id = p_restaurant_id)
  order by c.discount_percent desc, e.notified_at asc
  limit 1
  for update of e;

  v_offer := greatest(v_kitchen_offer, coalesce(v_campaign_offer, 0));
  if v_campaign_offer is null or v_campaign_offer < v_kitchen_offer then
    v_enroll_id := null;
    v_campaign_id := null;
  end if;

  offer_percent := v_offer;
  campaign_id := v_campaign_id;
  enrollment_id := v_enroll_id;
  return next;
end;
$$;

revoke all on function private.resolve_checkout_offer(uuid, uuid) from public, anon, authenticated;

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
  v_enroll_id       uuid;
  v_campaign_id     uuid;
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

  select is_open, lat::double precision, lng::double precision
    into v_is_open, v_rest_lat, v_rest_lng
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

  select r.offer_percent, r.campaign_id, r.enrollment_id
    into v_offer, v_campaign_id, v_enroll_id
    from private.resolve_checkout_offer(v_customer, v_restaurant) r;

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

  if v_rest_lat is not null and v_rest_lng is not null then
    if v_delivery_lat is null or v_delivery_lng is null then
      raise exception 'DELIVERY_RANGE' using
        message = 'Set a delivery address with a location pin so we can check delivery range.',
        errcode = 'P0001';
    end if;
    if v_drop_km is not null and v_drop_km > 8 then
      raise exception 'DELIVERY_RANGE' using
        message = format(
          'This kitchen is about %s km from your address. We only deliver within 8 km.',
          v_drop_km
        ),
        errcode = 'P0001';
    end if;
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
    notes,
    campaign_id
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
    p_notes,
    v_campaign_id
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

  if v_enroll_id is not null then
    update public.crm_campaign_enrollments
       set redeemed_at = now(),
           order_id = v_order_id
     where id = v_enroll_id
       and redeemed_at is null;
  end if;

  delete from public.cart_items
   where customer_id = v_customer;

  return v_order_id;
end;
$$;

revoke all on function public.place_order(text, text, numeric, numeric, uuid) from public;
grant execute on function public.place_order(text, text, numeric, numeric, uuid) to authenticated;
