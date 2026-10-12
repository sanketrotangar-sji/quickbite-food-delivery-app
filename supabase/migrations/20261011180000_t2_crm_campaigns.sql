-- A3-T2: Custom CRM — segments, campaigns, outreach enrollments, place_order redemption.
-- Rollback: drop RPCs/views/tables/columns added here; restore place_order from 20261008030000.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.crm_campaigns (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(trim(title)) between 1 and 120),
  description      text,
  target_segment   text not null
                   check (target_segment in ('new', 'frequent', 'churned', 'all')),
  discount_percent integer not null check (discount_percent between 1 and 80),
  restaurant_id    uuid references public.restaurants(id) on delete set null,
  status           text not null default 'draft'
                   check (status in ('draft', 'active', 'ended')),
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  launched_at      timestamptz,
  constraint crm_campaigns_window_ok check (ends_at > starts_at)
);

create index if not exists crm_campaigns_status_idx
  on public.crm_campaigns (status, ends_at desc);

comment on table public.crm_campaigns is
  'A3-T2 offer campaigns targeted at CRM segments.';

create table if not exists public.crm_campaign_enrollments (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.crm_campaigns(id) on delete cascade,
  customer_id  uuid not null references public.profiles(id) on delete cascade,
  notified_at  timestamptz not null default now(),
  redeemed_at  timestamptz,
  order_id     uuid references public.orders(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (campaign_id, customer_id)
);

create index if not exists crm_enrollments_customer_open_idx
  on public.crm_campaign_enrollments (customer_id)
  where redeemed_at is null;

create index if not exists crm_enrollments_campaign_idx
  on public.crm_campaign_enrollments (campaign_id);

comment on table public.crm_campaign_enrollments is
  'Outreach enrollment + one-time redemption per customer × campaign.';

alter table public.orders
  add column if not exists campaign_id uuid references public.crm_campaigns(id) on delete set null;

comment on column public.orders.campaign_id is
  'CRM campaign applied at place_order (if any).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.crm_campaigns enable row level security;
alter table public.crm_campaign_enrollments enable row level security;

drop policy if exists "crm_campaigns: admin all" on public.crm_campaigns;
create policy "crm_campaigns: admin all"
  on public.crm_campaigns for all to authenticated
  using ( private.has_role('admin') )
  with check ( private.has_role('admin') );

drop policy if exists "crm_campaigns: customer reads active" on public.crm_campaigns;
create policy "crm_campaigns: customer reads active"
  on public.crm_campaigns for select to authenticated
  using (
    status = 'active'
    and starts_at <= now()
    and ends_at >= now()
  );

drop policy if exists "crm_enrollments: admin all" on public.crm_campaign_enrollments;
create policy "crm_enrollments: admin all"
  on public.crm_campaign_enrollments for all to authenticated
  using ( private.has_role('admin') )
  with check ( private.has_role('admin') );

drop policy if exists "crm_enrollments: customer reads own" on public.crm_campaign_enrollments;
create policy "crm_enrollments: customer reads own"
  on public.crm_campaign_enrollments for select to authenticated
  using ( customer_id = (select auth.uid()) );

grant select on public.crm_campaigns to authenticated;
grant select, insert, update, delete on public.crm_campaigns to authenticated;
grant select on public.crm_campaign_enrollments to authenticated;
grant select, insert, update, delete on public.crm_campaign_enrollments to authenticated;
grant select, insert, update, delete on public.crm_campaigns to service_role;
grant select, insert, update, delete on public.crm_campaign_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- Segment view (mutually exclusive priority: frequent > churned > new > active)
-- ---------------------------------------------------------------------------
create or replace view public.crm_customer_segments
with (security_invoker = true)
as
with stats as (
  select
    p.id as customer_id,
    p.full_name,
    p.email,
    p.phone,
    p.created_at as joined_at,
    count(o.id) filter (where o.status = 'delivered')::integer as delivered_count,
    count(o.id) filter (
      where o.status = 'delivered'
        and o.delivered_at >= now() - interval '60 days'
    )::integer as delivered_60d,
    max(o.delivered_at) filter (where o.status = 'delivered') as last_delivered_at
  from public.profiles p
  left join public.orders o on o.customer_id = p.id
  where p.role = 'customer'
  group by p.id, p.full_name, p.email, p.phone, p.created_at
)
select
  customer_id,
  full_name,
  email,
  phone,
  joined_at,
  delivered_count,
  delivered_60d,
  last_delivered_at,
  case
    when delivered_60d >= 3 then 'frequent'
    when delivered_count >= 1
         and last_delivered_at is not null
         and last_delivered_at < now() - interval '45 days'
      then 'churned'
    when delivered_count <= 1 then 'new'
    else 'active'
  end as segment
from stats;

grant select on public.crm_customer_segments to authenticated;
grant select on public.crm_customer_segments to service_role;

comment on view public.crm_customer_segments is
  'A3-T2 customer segments: frequent (≥3 delivered/60d), churned (idle ≥45d), new (≤1 delivered), else active.';

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create or replace function public.crm_segment_counts()
returns table (
  segment text,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.segment, count(*)::bigint
  from public.crm_customer_segments s
  where private.has_role('admin')
  group by s.segment
  order by s.segment;
$$;

revoke all on function public.crm_segment_counts() from public, anon;
grant execute on function public.crm_segment_counts() to authenticated;

create or replace function public.crm_list_segment_members(
  p_segment text,
  p_limit integer default 100
)
returns setof public.crm_customer_segments
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can list CRM segments.' using errcode = '42501';
  end if;
  if p_segment is null or p_segment not in ('new', 'frequent', 'churned', 'active', 'all') then
    raise exception 'Invalid segment.' using errcode = '22023';
  end if;

  return query
  select s.*
  from public.crm_customer_segments s
  where p_segment = 'all' or s.segment = p_segment
  order by s.last_delivered_at desc nulls last, s.joined_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.crm_list_segment_members(text, integer) from public, anon;
grant execute on function public.crm_list_segment_members(text, integer) to authenticated;

create or replace function public.crm_create_campaign(
  p_title text,
  p_description text,
  p_target_segment text,
  p_discount_percent integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_restaurant_id uuid default null
)
returns public.crm_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.crm_campaigns;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can create campaigns.' using errcode = '42501';
  end if;
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Title is required.' using errcode = '22023';
  end if;
  if p_target_segment not in ('new', 'frequent', 'churned', 'all') then
    raise exception 'Invalid target segment.' using errcode = '22023';
  end if;
  if p_discount_percent is null or p_discount_percent < 1 or p_discount_percent > 80 then
    raise exception 'Discount must be between 1 and 80.' using errcode = '22023';
  end if;
  if p_ends_at is null or p_starts_at is null or p_ends_at <= p_starts_at then
    raise exception 'Campaign window is invalid.' using errcode = '22023';
  end if;

  insert into public.crm_campaigns (
    title, description, target_segment, discount_percent,
    restaurant_id, status, starts_at, ends_at, created_by
  )
  values (
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    p_target_segment,
    p_discount_percent,
    p_restaurant_id,
    'draft',
    p_starts_at,
    p_ends_at,
    (select auth.uid())
  )
  returning * into v_row;

  insert into public.admin_audit_log (actor_id, action, restaurant_id, payload)
  values (
    (select auth.uid()),
    'crm_create_campaign',
    p_restaurant_id,
    jsonb_build_object(
      'campaign_id', v_row.id,
      'target_segment', v_row.target_segment,
      'discount_percent', v_row.discount_percent
    )
  );

  return v_row;
end;
$$;

revoke all on function public.crm_create_campaign(text, text, text, integer, timestamptz, timestamptz, uuid)
  from public, anon;
grant execute on function public.crm_create_campaign(text, text, text, integer, timestamptz, timestamptz, uuid)
  to authenticated;

create or replace function public.crm_launch_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.crm_campaigns;
  v_enrolled integer := 0;
  v_notified integer := 0;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can launch campaigns.' using errcode = '42501';
  end if;

  select * into v_campaign
  from public.crm_campaigns
  where id = p_campaign_id
  for update;

  if v_campaign.id is null then
    raise exception 'Campaign not found.' using errcode = 'P0002';
  end if;
  if v_campaign.status = 'ended' then
    raise exception 'Campaign already ended.' using errcode = '22023';
  end if;
  if v_campaign.ends_at < now() then
    update public.crm_campaigns set status = 'ended' where id = v_campaign.id;
    raise exception 'Campaign window already ended.' using errcode = '22023';
  end if;

  update public.crm_campaigns
     set status = 'active',
         launched_at = coalesce(launched_at, now())
   where id = v_campaign.id;

  with ins as (
    insert into public.crm_campaign_enrollments (campaign_id, customer_id, notified_at)
    select v_campaign.id, s.customer_id, now()
    from public.crm_customer_segments s
    where (
        v_campaign.target_segment = 'all'
        or s.segment = v_campaign.target_segment
      )
    on conflict (campaign_id, customer_id) do nothing
    returning customer_id
  ),
  notes as (
    insert into public.notifications (user_id, title, body)
    select
      ins.customer_id,
      'Offer for you: ' || v_campaign.title,
      format(
        'Enjoy %s%% off%s. Valid until %s.',
        v_campaign.discount_percent,
        case
          when v_campaign.restaurant_id is null then ' on QuickBite'
          else ' at a selected kitchen'
        end,
        to_char(v_campaign.ends_at at time zone 'UTC', 'YYYY-MM-DD')
      )
    from ins
    returning 1
  )
  select
    (select count(*) from ins),
    (select count(*) from notes)
  into v_enrolled, v_notified;

  insert into public.admin_audit_log (actor_id, action, restaurant_id, payload)
  values (
    (select auth.uid()),
    'crm_launch_campaign',
    v_campaign.restaurant_id,
    jsonb_build_object(
      'campaign_id', v_campaign.id,
      'enrolled', v_enrolled,
      'notified', v_notified,
      'target_segment', v_campaign.target_segment
    )
  );

  return jsonb_build_object(
    'campaign_id', v_campaign.id,
    'status', 'active',
    'enrolled', v_enrolled,
    'notified', v_notified
  );
end;
$$;

revoke all on function public.crm_launch_campaign(uuid) from public, anon;
grant execute on function public.crm_launch_campaign(uuid) to authenticated;

create or replace function public.crm_end_campaign(p_campaign_id uuid)
returns public.crm_campaigns
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.crm_campaigns;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can end campaigns.' using errcode = '42501';
  end if;

  update public.crm_campaigns
     set status = 'ended'
   where id = p_campaign_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Campaign not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_id, action, restaurant_id, payload)
  values (
    (select auth.uid()),
    'crm_end_campaign',
    v_row.restaurant_id,
    jsonb_build_object('campaign_id', v_row.id)
  );

  return v_row;
end;
$$;

revoke all on function public.crm_end_campaign(uuid) from public, anon;
grant execute on function public.crm_end_campaign(uuid) to authenticated;

create or replace function public.crm_campaign_stats(p_campaign_id uuid default null)
returns table (
  campaign_id uuid,
  title text,
  target_segment text,
  discount_percent integer,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  enrolled bigint,
  redeemed bigint,
  expired_unredeemed bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can view campaign stats.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.title,
    c.target_segment,
    c.discount_percent,
    c.status,
    c.starts_at,
    c.ends_at,
    count(e.id)::bigint as enrolled,
    count(e.id) filter (where e.redeemed_at is not null)::bigint as redeemed,
    count(e.id) filter (
      where e.redeemed_at is null and c.ends_at < now()
    )::bigint as expired_unredeemed
  from public.crm_campaigns c
  left join public.crm_campaign_enrollments e on e.campaign_id = c.id
  where p_campaign_id is null or c.id = p_campaign_id
  group by c.id
  order by c.created_at desc;
end;
$$;

revoke all on function public.crm_campaign_stats(uuid) from public, anon;
grant execute on function public.crm_campaign_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- place_order: apply best active campaign discount + mark redemption
-- ---------------------------------------------------------------------------
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
  v_kitchen_offer   integer;
  v_offer           integer;
  v_discounted      numeric(10,2);
  v_discount_amt    numeric(10,2);
  v_rest_lat        double precision;
  v_rest_lng        double precision;
  v_drop_km         numeric(6,2);
  v_enroll_id       uuid;
  v_campaign_id     uuid;
  v_campaign_offer  integer;
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
    into v_is_open, v_kitchen_offer, v_rest_lat, v_rest_lng
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

  v_kitchen_offer := greatest(0, least(100, coalesce(v_kitchen_offer, 0)));

  -- Best unused active CRM enrollment (platform-wide or this kitchen).
  select e.id, c.id, c.discount_percent
    into v_enroll_id, v_campaign_id, v_campaign_offer
  from public.crm_campaign_enrollments e
  join public.crm_campaigns c on c.id = e.campaign_id
  where e.customer_id = v_customer
    and e.redeemed_at is null
    and c.status = 'active'
    and c.starts_at <= now()
    and c.ends_at >= now()
    and (c.restaurant_id is null or c.restaurant_id = v_restaurant)
  order by c.discount_percent desc, e.notified_at asc
  limit 1
  for update of e;

  v_offer := greatest(v_kitchen_offer, coalesce(v_campaign_offer, 0));
  if v_campaign_offer is null or v_campaign_offer < v_kitchen_offer then
    v_enroll_id := null;
    v_campaign_id := null;
  end if;

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
