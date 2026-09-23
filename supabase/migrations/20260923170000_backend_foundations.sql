-- Backend foundations for saved addresses, push delivery, and rider tracking.

-- ---------------------------------------------------------------------------
-- Customer addresses
-- ---------------------------------------------------------------------------

create table public.customer_addresses (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  label         text not null default 'home'
                  check (label in ('home', 'work', 'other')),
  nickname      text not null check (length(trim(nickname)) between 1 and 80),
  address_line  text not null check (length(trim(address_line)) between 1 and 300),
  area          text not null check (length(trim(area)) between 1 and 160),
  landmark      text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint customer_addresses_coordinates_pair check (
    (lat is null and lng is null)
    or (
      lat is not null and lng is not null
      and lat between -90 and 90
      and lng between -180 and 180
    )
  )
);

create index customer_addresses_customer_idx
  on public.customer_addresses (customer_id, created_at);

create unique index customer_addresses_one_default
  on public.customer_addresses (customer_id)
  where is_default;

create trigger customer_addresses_touch
  before update on public.customer_addresses
  for each row execute function public.touch_updated_at();

alter table public.customer_addresses enable row level security;

create policy "customer_addresses: owner reads"
  on public.customer_addresses for select to authenticated
  using (customer_id = (select auth.uid()));

create policy "customer_addresses: owner inserts"
  on public.customer_addresses for insert to authenticated
  with check (customer_id = (select auth.uid()));

create policy "customer_addresses: owner updates"
  on public.customer_addresses for update to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

create policy "customer_addresses: owner deletes"
  on public.customer_addresses for delete to authenticated
  using (customer_id = (select auth.uid()));

revoke all on table public.customer_addresses from anon, authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;

comment on table public.customer_addresses is
  'Customer-owned saved delivery addresses. Orders retain an immutable text/coordinate snapshot.';

-- ---------------------------------------------------------------------------
-- Push device tokens
-- ---------------------------------------------------------------------------

create table public.push_device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  token         text not null unique check (length(trim(token)) between 1 and 4096),
  platform      text not null check (platform in ('ios', 'android', 'web')),
  metadata      jsonb not null default '{}'::jsonb
                  check (jsonb_typeof(metadata) = 'object'),
  enabled       boolean not null default true,
  enabled_at    timestamptz,
  disabled_at   timestamptz,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint push_device_tokens_enabled_state check (
    (enabled and enabled_at is not null and disabled_at is null)
    or (not enabled and disabled_at is not null)
  )
);

create index push_device_tokens_user_idx
  on public.push_device_tokens (user_id, enabled);

create or replace function public.sync_push_device_token_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.token := trim(new.token);

  if tg_op = 'INSERT' then
    if new.enabled then
      new.enabled_at := coalesce(new.enabled_at, now());
      new.disabled_at := null;
    else
      new.enabled_at := null;
      new.disabled_at := coalesce(new.disabled_at, now());
    end if;
  elsif new.enabled is distinct from old.enabled then
    if new.enabled then
      new.enabled_at := now();
      new.disabled_at := null;
    else
      new.disabled_at := now();
    end if;
  elsif new.enabled then
    new.enabled_at := coalesce(new.enabled_at, old.enabled_at, now());
    new.disabled_at := null;
  else
    new.disabled_at := coalesce(new.disabled_at, old.disabled_at, now());
  end if;

  return new;
end;
$$;

create trigger push_device_tokens_state
  before insert or update on public.push_device_tokens
  for each row execute function public.sync_push_device_token_state();

create trigger push_device_tokens_touch
  before update on public.push_device_tokens
  for each row execute function public.touch_updated_at();

alter table public.push_device_tokens enable row level security;

create policy "push_device_tokens: owner reads"
  on public.push_device_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy "push_device_tokens: owner inserts"
  on public.push_device_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "push_device_tokens: owner updates"
  on public.push_device_tokens for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "push_device_tokens: owner deletes"
  on public.push_device_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.push_device_tokens from anon, authenticated;
grant select, insert, update, delete on public.push_device_tokens to authenticated;

revoke all on function public.sync_push_device_token_state()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rider duty, claiming, and location updates
-- ---------------------------------------------------------------------------

create or replace function public.rider_set_duty(p_is_online boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function public.rider_set_duty(boolean) from public;
grant execute on function public.rider_set_duty(boolean) to authenticated;

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
begin
  if v_rider is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can claim deliveries.' using errcode = '42501';
  end if;

  -- Lock the rider profile while claiming so an offline transition cannot
  -- race this check.
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

  -- The conditional UPDATE is the claim mutex: under contention, exactly one
  -- transaction can change the NULL rider_id.
  update public.orders
     set rider_id = v_rider
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

revoke all on function public.claim_delivery(uuid) from public;
grant execute on function public.claim_delivery(uuid) to authenticated;

-- Direct location writes previously allowed a rider to attach their pin to
-- any order. Route all writes through the assignment-aware RPC instead.
drop policy if exists "rider_locations: rider writes own" on public.rider_locations;
revoke insert, update, delete on public.rider_locations from authenticated;
revoke all on public.rider_locations from anon;

drop policy if exists "rider_locations: rider reads own" on public.rider_locations;
create policy "rider_locations: rider reads own"
  on public.rider_locations for select to authenticated
  using (
    rider_id = (select auth.uid())
    and private.has_role('rider')
  );

drop policy if exists "rider_locations: customer reads their active delivery"
  on public.rider_locations;
create policy "rider_locations: customer reads their active delivery"
  on public.rider_locations for select to authenticated
  using (
    exists (
      select 1
      from public.orders o
      where o.id = rider_locations.order_id
        and o.rider_id = rider_locations.rider_id
        and o.customer_id = (select auth.uid())
        and o.status in ('preparing', 'ready', 'out_for_delivery')
    )
  );

create or replace function public.rider_update_location(
  p_order_id uuid,
  p_lat      numeric,
  p_lng      numeric
)
returns public.rider_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
  v_row   public.rider_locations;
begin
  if v_rider is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can update delivery location.' using errcode = '42501';
  end if;

  if p_lat is null or p_lat < -90 or p_lat > 90
     or p_lng is null or p_lng < -180 or p_lng > 180 then
    raise exception 'Invalid latitude or longitude.' using errcode = '22023';
  end if;

  -- This lock serializes against delivery/status changes. If delivery wins,
  -- the update is rejected; if this update wins, delivered cleanup runs after.
  perform 1
    from public.orders
   where id = p_order_id
     and rider_id = v_rider
     and customer_id is distinct from v_rider
     and status in ('preparing', 'ready', 'out_for_delivery')
   for update;

  if not found then
    raise exception 'LOCATION_NOT_ALLOWED' using
      message = 'This order is not assigned to you or is no longer active.',
      errcode = 'P0001';
  end if;

  insert into public.rider_locations (rider_id, order_id, lat, lng, updated_at)
  values (v_rider, p_order_id, p_lat, p_lng, now())
  on conflict (rider_id) do update
    set order_id = excluded.order_id,
        lat = excluded.lat,
        lng = excluded.lng,
        updated_at = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.rider_update_location(uuid, numeric, numeric) from public;
grant execute on function public.rider_update_location(uuid, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Order address linkage and server-owned snapshots
-- ---------------------------------------------------------------------------

alter table public.orders
  add column delivery_address_id uuid
    references public.customer_addresses(id) on delete set null;

create index orders_delivery_address_idx
  on public.orders (delivery_address_id)
  where delivery_address_id is not null;

comment on column public.orders.delivery_address_id is
  'Optional source saved address. delivery_address/lat/lng remain immutable snapshots.';

-- The fifth defaulted argument keeps all existing named and positional
-- four-argument calls valid while allowing callers to provide a saved address.
drop function public.place_order(text, text, numeric, numeric);

create function public.place_order(
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

  select is_open
    into v_is_open
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

  v_fee := public.standard_delivery_fee();
  v_total := v_subtotal + v_fee;

  insert into public.orders (
    customer_id,
    restaurant_id,
    status,
    total_amount,
    delivery_fee,
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

-- Saved addresses benefit from multi-device live synchronization. Push tokens
-- are intentionally omitted: they are private delivery credentials, not UI data.
alter table public.customer_addresses replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'customer_addresses'
  ) then
    execute 'alter publication supabase_realtime add table public.customer_addresses';
  end if;
end
$$;
