-- Duty rule B: cannot go offline with an active assigned order.
-- Also set rider_earning on claim when missing (default pay band).

create or replace function public.rider_set_duty(p_is_online boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active int;
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can change duty status.' using errcode = '42501';
  end if;

  if p_is_online is null then
    raise exception 'Duty status is required.' using errcode = '22023';
  end if;

  if p_is_online is false then
    select count(*)::int into v_active
      from public.orders
     where rider_id = (select auth.uid())
       and status in ('preparing', 'ready', 'out_for_delivery');
    if v_active > 0 then
      raise exception 'ACTIVE_DELIVERY' using
        message = 'Finish your active delivery before going off duty.',
        errcode = 'P0001';
    end if;
  end if;

  update public.profiles
     set is_online = p_is_online
   where id = (select auth.uid())
     and role = 'rider';

  if not found then
    raise exception 'Rider profile not found.' using errcode = 'P0001';
  end if;

  return p_is_online;
end;
$$;

-- When claiming, stamp a default rider earning if the kitchen left it null.
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

  update public.orders
     set rider_id = v_rider,
         rider_earning = coalesce(rider_earning, greatest(v_default_pay, round(delivery_fee * 0.6, 2)))
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

-- Auto-assign also stamps rider_earning when the kitchen left it null.
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

