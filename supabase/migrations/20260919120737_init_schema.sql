-- ============================================================
-- 01_init_schema.sql
-- ============================================================

create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- ---------- enums ----------
create type public.app_role as enum ('customer', 'restaurant_manager', 'rider');

create type public.order_status as enum (
  'placed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
);

-- ---------- profiles ----------
-- One row per user. id is the SAME uuid as auth.users.id, so auth.uid()
-- can be compared to it directly everywhere.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text not null,
  role        public.app_role not null default 'customer',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

-- ---------- restaurants ----------
create table public.restaurants (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  description  text,
  cuisine      text,
  address      text not null,
  phone        text,
  image_url    text,
  is_open      boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint restaurants_one_per_owner unique (owner_id)
);

create index restaurants_is_open_idx on public.restaurants (is_open);

-- ---------- menu_items ----------
create table public.menu_items (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null check (length(trim(name)) > 0),
  description    text,
  price          numeric(10,2) not null check (price >= 0),
  image_url      text,
  is_available   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index menu_items_restaurant_idx on public.menu_items (restaurant_id);

-- ---------- orders ----------
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.profiles(id) on delete restrict,
  restaurant_id     uuid not null references public.restaurants(id) on delete restrict,
  rider_id          uuid references public.profiles(id) on delete set null,
  status            public.order_status not null default 'placed',
  total_amount      numeric(10,2) not null check (total_amount >= 0),
  delivery_address  text not null,
  delivery_lat      numeric(9,6),
  delivery_lng      numeric(9,6),
  notes             text,
  placed_at         timestamptz not null default now(),
  delivered_at      timestamptz,
  updated_at        timestamptz not null default now()
);

-- Indexes matching the columns RLS policies and dashboards filter on.
create index orders_customer_idx     on public.orders (customer_id);
create index orders_restaurant_idx   on public.orders (restaurant_id, status);
create index orders_rider_idx        on public.orders (rider_id);
-- Partial index: the "Available Deliveries" feed is a hot query.
create index orders_unclaimed_idx    on public.orders (status)
  where rider_id is null and status in ('preparing', 'ready');

-- ---------- order_items ----------
-- item_name and unit_price are SNAPSHOTS. Never rewrite them.
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  menu_item_id  uuid references public.menu_items(id) on delete set null,
  item_name     text not null,
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(10,2) not null check (unit_price >= 0),
  line_total    numeric(12,2) generated always as (quantity * unit_price) stored
);

create index order_items_order_idx on public.order_items (order_id);

-- ---------- cart_items ----------
-- restaurant_id is derived by a trigger, never trusted from the client.
create table public.cart_items (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.profiles(id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  menu_item_id   uuid not null references public.menu_items(id) on delete cascade,
  quantity       integer not null check (quantity > 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint cart_items_one_per_item unique (customer_id, menu_item_id)
);

create index cart_items_customer_idx on public.cart_items (customer_id);

-- ---------- order_status_history ----------
-- Written ONLY by a trigger. No insert policy will exist for users.
create table public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders(id) on delete cascade,
  status      public.order_status not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid references public.profiles(id) on delete set null
);

create index osh_order_idx on public.order_status_history (order_id, changed_at);

-- ---------- ratings ----------
-- unique(order_id) is what makes "one rating per order" a database fact
-- rather than a frontend hope.
create table public.ratings (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null unique references public.orders(id) on delete cascade,
  customer_id      uuid not null references public.profiles(id) on delete cascade,
  restaurant_id    uuid not null references public.restaurants(id) on delete cascade,
  rider_id         uuid references public.profiles(id) on delete set null,
  food_rating      integer not null check (food_rating between 1 and 5),
  delivery_rating  integer check (delivery_rating between 1 and 5),
  comment          text,
  created_at       timestamptz not null default now()
);

create index ratings_restaurant_idx on public.ratings (restaurant_id);

-- ---------- rider_locations ----------
-- rider_id is the PRIMARY KEY: one live row per rider, overwritten on each
-- ping. This is a "where are they now" table, not a GPS history log.
create table public.rider_locations (
  rider_id    uuid primary key references public.profiles(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  lat         numeric(9,6) not null check (lat between -90 and 90),
  lng         numeric(9,6) not null check (lng between -180 and 180),
  updated_at  timestamptz not null default now()
);

create index rider_locations_order_idx on public.rider_locations (order_id);

-- ---------- enable RLS on everything, immediately ----------
-- With RLS on and no policies, these tables are now completely locked.
-- That is the correct starting point. Part 7 opens specific doors.
alter table public.profiles             enable row level security;
alter table public.restaurants          enable row level security;
alter table public.menu_items           enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.cart_items           enable row level security;
alter table public.order_status_history enable row level security;
alter table public.ratings              enable row level security;
alter table public.rider_locations      enable row level security;