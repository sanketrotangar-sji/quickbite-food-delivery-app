-- Columns and rows the screens already show, plus live updates.
-- Restaurant open/closed and dish availability were already published
-- (20260922021000_kitchen_realtime.sql). This adds the new tables to
-- that same feed. Screens are not wired to these columns yet.
--
-- Images live in apps/client/assets/images and are already named after
-- the dishes. SQL cannot upload file bytes. Upload them into the public
-- menu-images bucket, then this migration points image_url at that path.
--
-- From the repo root, with the Supabase CLI logged in and linked
-- (storage uploads use the project owner and ignore the manager folder rule):
--
--   for f in \
--     bharli_vangi_and_bhakri chicken_biryani chicken_tikka \
--     ghee_roast_dosa idli_sambar kothimbir_vadi \
--     masala_dosa misal_pav zunka_bhakri
--   do
--     supabase storage cp --experimental \
--       "apps/client/assets/images/${f}.png" \
--       "ss:///menu-images/catalog/${f}.png"
--   done
--
-- Public URL shape (project ref is the one in apps/client/.env):
--   https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/catalog/<file>.png
--
-- Logo, loader, and the rider hero stay bundled files. Do not upload those.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists lat numeric(9,6),
  add column if not exists lng numeric(9,6),
  add column if not exists offer_percent integer,
  add column if not exists prep_minutes integer;

alter table public.restaurants
  drop constraint if exists restaurants_offer_percent_range;
alter table public.restaurants
  add constraint restaurants_offer_percent_range
  check (offer_percent is null or offer_percent between 0 and 100);

alter table public.restaurants
  drop constraint if exists restaurants_prep_minutes_range;
alter table public.restaurants
  add constraint restaurants_prep_minutes_range
  check (prep_minutes is null or prep_minutes between 0 and 180);

alter table public.orders
  add column if not exists rider_earning numeric(10,2),
  add column if not exists tip_amount numeric(10,2) not null default 0,
  add column if not exists bonus_amount numeric(10,2) not null default 0,
  add column if not exists pickup_km numeric(6,2),
  add column if not exists drop_km numeric(6,2),
  add column if not exists eta_minutes integer;

alter table public.orders
  drop constraint if exists orders_rider_pay_nonneg;
alter table public.orders
  add constraint orders_rider_pay_nonneg
  check (
    (rider_earning is null or rider_earning >= 0)
    and tip_amount >= 0
    and bonus_amount >= 0
    and (pickup_km is null or pickup_km >= 0)
    and (drop_km is null or drop_km >= 0)
    and (eta_minutes is null or eta_minutes >= 0)
  );

alter table public.profiles
  add column if not exists is_online boolean not null default false,
  add column if not exists vehicle_label text,
  add column if not exists plate text;

-- Customer browse can read geo and offer fields. Owner and phone stay off this view.
-- REPLACE cannot rename or insert columns mid-list, so drop first.
drop view if exists public.restaurant_browse;
create view public.restaurant_browse
with (security_invoker = false, security_barrier = true) as
select
  id,
  name,
  description,
  cuisine,
  address,
  image_url,
  is_open,
  branch_name,
  lat,
  lng,
  offer_percent,
  prep_minutes,
  created_at,
  updated_at
from public.restaurants;

grant select on public.restaurant_browse to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (length(trim(title)) > 0),
  body        text not null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "notifications: mark own read" on public.notifications;
create policy "notifications: mark own read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, update on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: open/closed, dish availability, orders, rider online, notices
-- ---------------------------------------------------------------------------

alter table public.restaurants replica identity full;
alter table public.menu_items replica identity full;
alter table public.orders replica identity full;
alter table public.profiles replica identity full;
alter table public.notifications replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['restaurants', 'menu_items', 'orders', 'profiles', 'notifications']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Seed. Skips when the accounts it needs are not signed up yet.
-- Re-run the block below from the SQL editor after an owner, a customer,
-- and a rider exist. It will not insert a second Spice Villa trip.
-- ---------------------------------------------------------------------------

do $$
declare
  v_base constant text := 'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/catalog/';
  v_owner uuid;
  v_customer uuid;
  v_rider uuid;
  v_spice uuid;
  v_tandoor uuid;
  v_dosa uuid;
  v_burger uuid;
  v_today date;
  v_week_start date;
  v_month_start date;
  v_span integer;
  v_each integer;
  v_rem integer;
  v_day date;
  i integer;
  v_order uuid;
begin
  select id into v_owner
  from public.profiles
  where role = 'restaurant_owner'
  order by created_at
  limit 1;

  if v_owner is null then
    raise notice 'Catalog seed skipped: sign up a restaurant owner first, then re-run this seed block.';
    return;
  end if;

  select id into v_customer
  from public.profiles
  where role = 'customer' and id <> v_owner
  order by created_at
  limit 1;

  select id into v_rider
  from public.profiles
  where role = 'rider' and id <> v_owner and id is distinct from v_customer
  order by created_at
  limit 1;

  -- Kitchens. One owner, four branches. Image files match the rider cards.
  insert into public.restaurants (
    owner_id, name, description, cuisine, address, image_url, is_open,
    branch_name, lat, lng, offer_percent, prep_minutes
  )
  select v_owner, name, description, cuisine, address, v_base || file, true,
         'Goa', lat, lng, offer_percent, prep_minutes
  from (values
    ('Spice Villa', 'North Indian · Pure Veg', 'North Indian', '12 Green Park Rd, Sector 14', 'kothimbir_vadi.png', 15.273400, 73.958100, 20, 25),
    ('The Tandoori Kitchen', 'North Indian · Non-Veg', 'North Indian', 'Campal, Panaji', 'chicken_tikka.png', 15.495200, 73.820400, 15, 20),
    ('Dosa Plaza', 'South Indian · Pure Veg', 'South Indian', 'Margao market', 'masala_dosa.png', 15.283200, 73.986500, 10, 15),
    ('Burger Hub', 'Burgers · Fast Food', 'Fast Food', 'Panaji', 'misal_pav.png', 15.490900, 73.827800, 25, 18)
  ) as k(name, description, cuisine, address, file, lat, lng, offer_percent, prep_minutes)
  where not exists (
    select 1 from public.restaurants r where r.name = k.name
  );

  update public.restaurants r
  set
    image_url = v_base || k.file,
    lat = k.lat,
    lng = k.lng,
    offer_percent = k.offer_percent,
    prep_minutes = k.prep_minutes,
    cuisine = k.cuisine,
    address = k.address,
    description = k.description,
    is_open = true
  from (values
    ('Spice Villa', 'North Indian · Pure Veg', 'North Indian', '12 Green Park Rd, Sector 14', 'kothimbir_vadi.png', 15.273400, 73.958100, 20, 25),
    ('The Tandoori Kitchen', 'North Indian · Non-Veg', 'North Indian', 'Campal, Panaji', 'chicken_tikka.png', 15.495200, 73.820400, 15, 20),
    ('Dosa Plaza', 'South Indian · Pure Veg', 'South Indian', 'Margao market', 'masala_dosa.png', 15.283200, 73.986500, 10, 15),
    ('Burger Hub', 'Burgers · Fast Food', 'Fast Food', 'Panaji', 'misal_pav.png', 15.490900, 73.827800, 25, 18)
  ) as k(name, description, cuisine, address, file, lat, lng, offer_percent, prep_minutes)
  where r.name = k.name;

  select id into v_spice from public.restaurants where name = 'Spice Villa' limit 1;
  select id into v_tandoor from public.restaurants where name = 'The Tandoori Kitchen' limit 1;
  select id into v_dosa from public.restaurants where name = 'Dosa Plaza' limit 1;
  select id into v_burger from public.restaurants where name = 'Burger Hub' limit 1;

  insert into public.menu_items (
    restaurant_id, name, description, price, image_url, is_available, is_veg, category
  )
  select restaurant_id, name, description, price, v_base || file, is_available, is_veg, category
  from (values
    (v_spice, 'Kothimbir Vadi', 'Coriander fritters', 120.00, 'kothimbir_vadi.png', true, true, 'Starters'),
    (v_spice, 'Zunka Bhakri', 'Besan mash with bhakri', 140.00, 'zunka_bhakri.png', true, true, 'Mains'),
    (v_spice, 'Bharli Vangi', 'Stuffed brinjal', 160.00, 'bharli_vangi_and_bhakri.png', true, true, 'Mains'),
    (v_tandoor, 'Chicken Tikka', 'Tandoor chicken', 240.00, 'chicken_tikka.png', true, false, 'Starters'),
    (v_tandoor, 'Chicken Biryani', 'Dum biryani', 280.00, 'chicken_biryani.png', true, false, 'Mains'),
    (v_dosa, 'Masala Dosa', 'Crisp dosa, potato masala', 90.00, 'masala_dosa.png', true, true, 'Mains'),
    (v_dosa, 'Ghee Roast Dosa', 'Ghee roast', 110.00, 'ghee_roast_dosa.png', true, true, 'Mains'),
    (v_dosa, 'Idli Sambar', 'Steamed idli', 70.00, 'idli_sambar.png', true, true, 'Breakfast'),
    (v_burger, 'Misal Pav', 'Spiced moth beans, pav', 130.00, 'misal_pav.png', true, true, 'Mains')
  ) as d(restaurant_id, name, description, price, file, is_available, is_veg, category)
  where not exists (
    select 1
    from public.menu_items m
    where m.restaurant_id = d.restaurant_id and m.name = d.name
  );

  update public.menu_items m
  set image_url = v_base || d.file, is_available = d.is_available, is_veg = d.is_veg
  from (values
    (v_spice, 'Kothimbir Vadi', 'kothimbir_vadi.png', true, true),
    (v_spice, 'Zunka Bhakri', 'zunka_bhakri.png', true, true),
    (v_spice, 'Bharli Vangi', 'bharli_vangi_and_bhakri.png', true, true),
    (v_tandoor, 'Chicken Tikka', 'chicken_tikka.png', true, false),
    (v_tandoor, 'Chicken Biryani', 'chicken_biryani.png', true, false),
    (v_dosa, 'Masala Dosa', 'masala_dosa.png', true, true),
    (v_dosa, 'Ghee Roast Dosa', 'ghee_roast_dosa.png', true, true),
    (v_dosa, 'Idli Sambar', 'idli_sambar.png', true, true),
    (v_burger, 'Misal Pav', 'misal_pav.png', true, true)
  ) as d(restaurant_id, name, file, is_available, is_veg)
  where m.restaurant_id = d.restaurant_id and m.name = d.name;

  if v_customer is null or v_rider is null then
    raise notice 'Kitchens seeded. Orders and notices skipped until both a customer and a rider exist.';
    return;
  end if;

  update public.profiles
  set
    is_online = true,
    vehicle_label = coalesce(vehicle_label, 'Bike'),
    plate = coalesce(plate, 'GA 01 AB 2148')
  where id = v_rider;

  v_today := (timezone('Asia/Kolkata', now()))::date;

  if exists (select 1 from public.orders where notes = 'QB7842') then
    raise notice 'Rider orders already seeded. Notices are still filled in if missing.';
  else

  -- Current trip. Counts toward today's ₹1,248 (pay 86 + bonus 40).
  insert into public.orders (
    customer_id, restaurant_id, rider_id, status, total_amount,
    delivery_address, delivery_lat, delivery_lng, notes,
    placed_at, rider_earning, tip_amount, bonus_amount, pickup_km, drop_km, eta_minutes
  ) values (
    v_customer, v_spice, v_rider, 'ready', 420.00,
    '45 Lake View Apartments', 15.286100, 73.962200, 'QB7842',
    (v_today + time '14:00') at time zone 'Asia/Kolkata',
    86.00, 0, 40.00, 2.10, 4.80, 12
  ) returning id into v_order;

  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
  select v_order, m.id, m.name, 1, m.price
  from public.menu_items m
  where m.restaurant_id = v_spice
    and m.name in ('Kothimbir Vadi', 'Zunka Bhakri', 'Bharli Vangi');

  -- Delivered today: Tandoori ₹78, Dosa ₹92 + ₹20 tip.
  insert into public.orders (
    customer_id, restaurant_id, rider_id, status, total_amount,
    delivery_address, notes, placed_at, delivered_at,
    rider_earning, tip_amount, bonus_amount, pickup_km, drop_km, eta_minutes
  ) values
  (
    v_customer, v_tandoor, v_rider, 'delivered', 240.00,
    'Miramar', 'QB7710',
    (v_today + time '13:10') at time zone 'Asia/Kolkata',
    (v_today + time '13:40') at time zone 'Asia/Kolkata',
    78.00, 0, 0, 1.40, 4.60, 18
  ),
  (
    v_customer, v_dosa, v_rider, 'delivered', 180.00,
    'Fatorda', 'QB7688',
    (v_today + time '12:05') at time zone 'Asia/Kolkata',
    (v_today + time '12:35') at time zone 'Asia/Kolkata',
    92.00, 20.00, 0, 2.80, 7.90, 22
  ),
  -- Rest of today: pay 400+200+124=724, bonus 80+40+20=140, tip 40+20+8=68.
  -- Together with 86+78+92 pay, 40 bonus, and 20 tip this is ₹1,248.
  (
    v_customer, v_spice, v_rider, 'delivered', 280.00,
    'Margao', 'today-fill-1',
    (v_today + time '11:00') at time zone 'Asia/Kolkata',
    (v_today + time '11:30') at time zone 'Asia/Kolkata',
    400.00, 40.00, 80.00, 2.00, 3.00, 15
  ),
  (
    v_customer, v_dosa, v_rider, 'delivered', 160.00,
    'Colva', 'today-fill-2',
    (v_today + time '10:00') at time zone 'Asia/Kolkata',
    (v_today + time '10:25') at time zone 'Asia/Kolkata',
    200.00, 20.00, 40.00, 3.00, 4.00, 20
  ),
  (
    v_customer, v_tandoor, v_rider, 'delivered', 200.00,
    'Panaji', 'today-fill-3',
    (v_today + time '09:10') at time zone 'Asia/Kolkata',
    (v_today + time '09:40') at time zone 'Asia/Kolkata',
    124.00, 8.00, 20.00, 2.50, 3.50, 16
  );

  -- Nearby, still unclaimed. Earnings match the rider home cards.
  insert into public.orders (
    customer_id, restaurant_id, rider_id, status, total_amount,
    delivery_address, notes, placed_at,
    rider_earning, tip_amount, bonus_amount, pickup_km, drop_km, eta_minutes
  ) values
  (
    v_customer, v_tandoor, null, 'ready', 240.00,
    '3.2 km drop', 'nearby-tandoori',
    now(),
    78.00, 0, 0, 1.40, 3.20, 14
  ),
  (
    v_customer, v_dosa, null, 'ready', 180.00,
    '5.1 km drop', 'nearby-dosa',
    now(),
    92.00, 0, 0, 2.80, 5.10, 20
  ),
  (
    v_customer, v_burger, null, 'ready', 130.00,
    '6.4 km drop', 'nearby-burger',
    now(),
    66.00, 0, 0, 3.60, 6.40, 24
  );

  -- Yesterday's completed card, plus the rest of the week so pay+bonus+tip = ₹6,420
  -- once today's ₹1,248 is included (5172 across the previous six days).
  insert into public.orders (
    customer_id, restaurant_id, rider_id, status, total_amount,
    delivery_address, notes, placed_at, delivered_at,
    rider_earning, tip_amount, bonus_amount, pickup_km, drop_km, eta_minutes
  ) values (
    v_customer, v_burger, v_rider, 'delivered', 220.00,
    'Taleigao', 'QB7602',
    ((v_today - 1) + time '20:40') at time zone 'Asia/Kolkata',
    ((v_today - 1) + time '21:10') at time zone 'Asia/Kolkata',
    66.00, 0, 0, 3.60, 10.00, 25
  );

  insert into public.orders (
    customer_id, restaurant_id, rider_id, status, total_amount,
    delivery_address, notes, placed_at, delivered_at,
    rider_earning, tip_amount, bonus_amount, pickup_km, drop_km
  ) values (
    v_customer, v_spice, v_rider, 'delivered', 300.00,
    'Margao', 'week-fill-1',
    ((v_today - 1) + time '13:00') at time zone 'Asia/Kolkata',
    ((v_today - 1) + time '13:30') at time zone 'Asia/Kolkata',
    796.00, 0, 0, 2.00, 4.00
  );

  for i in 2..6 loop
    insert into public.orders (
      customer_id, restaurant_id, rider_id, status, total_amount,
      delivery_address, notes, placed_at, delivered_at,
      rider_earning, tip_amount, bonus_amount, pickup_km, drop_km
    ) values (
      v_customer, v_dosa, v_rider, 'delivered', 200.00,
      'Goa', 'week-fill-' || i,
      ((v_today - i) + time '13:00') at time zone 'Asia/Kolkata',
      ((v_today - i) + time '13:40') at time zone 'Asia/Kolkata',
      862.00, 0, 0, 2.00, 4.00
    );
  end loop;

  -- Earlier this month, so the month rollup is ₹24,860 (24860 - 6420 = 18440).
  v_week_start := v_today - 6;
  v_month_start := date_trunc('month', v_today::timestamp)::date;
  v_span := v_week_start - v_month_start;

  if v_span > 0 then
    v_each := 18440 / v_span;
    v_rem := 18440 - (v_each * v_span);
    for i in 0..(v_span - 1) loop
      v_day := v_month_start + i;
      insert into public.orders (
        customer_id, restaurant_id, rider_id, status, total_amount,
        delivery_address, notes, placed_at, delivered_at,
        rider_earning, tip_amount, bonus_amount, pickup_km, drop_km
      ) values (
        v_customer, v_tandoor, v_rider, 'delivered', 250.00,
        'Goa', 'month-fill-' || i,
        (v_day + time '19:00') at time zone 'Asia/Kolkata',
        (v_day + time '19:30') at time zone 'Asia/Kolkata',
        v_each + case when i = v_span - 1 then v_rem else 0 end,
        0, 0, 2.00, 5.00
      );
    end loop;
  else
    raise notice 'Month seed skipped: this week already covers the calendar month.';
  end if;

  end if;

  -- Ratings. Mostly 5, a few 4, so a straight average lands on 4.9.
  insert into public.ratings (order_id, customer_id, restaurant_id, rider_id, food_rating, delivery_rating)
  select
    o.id,
    o.customer_id,
    o.restaurant_id,
    o.rider_id,
    5,
    case when row_number() over (order by o.delivered_at) % 9 = 0 then 4 else 5 end
  from public.orders o
  where o.rider_id = v_rider
    and o.status = 'delivered'
    and (o.notes like 'QB%' or o.notes like '%-fill-%')
  on conflict (order_id) do nothing;

  insert into public.notifications (user_id, title, body, created_at, read_at)
  select v_rider, title, body, created_at, read_at
  from (values
    ('New delivery available', 'The Tandoori Kitchen is 1.4 km away. You earn ₹78.', now() - interval '2 minutes', null::timestamptz),
    ('Order ready for pickup', 'Spice Villa marked order #QB7842 ready.', now() - interval '18 minutes', null),
    ('Delivery completed', 'Dosa Plaza · #QB7688 is delivered.', (v_today + time '12:20') at time zone 'Asia/Kolkata', (v_today + time '12:21') at time zone 'Asia/Kolkata'),
    ('Earnings update', 'Today’s earnings are ₹1,248 across 6 deliveries.', (v_today + time '12:21') at time zone 'Asia/Kolkata', (v_today + time '12:22') at time zone 'Asia/Kolkata'),
    ('QuickBite', 'Peak hours in Margao run 12:30–2:30 PM and 7–10 PM.', (v_today - 1 + time '09:00') at time zone 'Asia/Kolkata', (v_today - 1 + time '09:05') at time zone 'Asia/Kolkata')
  ) as n(title, body, created_at, read_at)
  where not exists (
    select 1 from public.notifications x
    where x.user_id = v_rider and x.title = n.title
  );
end
$$;
