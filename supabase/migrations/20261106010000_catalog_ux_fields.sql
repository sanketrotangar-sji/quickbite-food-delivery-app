-- Catalog fields the customer screens need: live offer windows, kitchen hours,
-- cost for two, pure-veg flag, ordered menu categories, bestseller flag.
-- menu_items.category (text) stays; a trigger dual-writes category <-> category_id.
-- Rollback: drop trigger menu_items_sync_category on public.menu_items;
--           drop function private.sync_menu_item_category();
--           alter table public.menu_items drop column category_id, drop column is_bestseller;
--           drop table public.menu_categories;
--           alter table public.restaurants drop column opens_at, drop column closes_at,
--             drop column cost_for_two, drop column is_pure_veg;
--           alter table public.home_highlights drop column starts_at, drop column ends_at, drop column priority;

-- ---------------------------------------------------------------------------
-- Offer windows
-- ---------------------------------------------------------------------------
alter table public.home_highlights
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists priority integer not null default 0;

alter table public.home_highlights
  drop constraint if exists home_highlights_window_check;
alter table public.home_highlights
  add constraint home_highlights_window_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create index if not exists home_highlights_live_idx
  on public.home_highlights (is_active, priority desc, sort_order);

-- ---------------------------------------------------------------------------
-- Kitchen hours + card facts
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists opens_at time,
  add column if not exists closes_at time,
  add column if not exists cost_for_two integer,
  add column if not exists is_pure_veg boolean not null default false;

alter table public.restaurants
  drop constraint if exists restaurants_cost_for_two_check;
alter table public.restaurants
  add constraint restaurants_cost_for_two_check
  check (cost_for_two is null or cost_for_two > 0);

-- Open = manager toggle AND inside today's hours (IST). Null hours = always open.
-- closes_at < opens_at means the kitchen closes after midnight.
create or replace function private.restaurant_open_now(
  p_is_open boolean,
  p_opens time,
  p_closes time
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when not coalesce(p_is_open, false) then false
    when p_opens is null or p_closes is null then true
    when p_opens <= p_closes then
      (now() at time zone 'Asia/Kolkata')::time >= p_opens
      and (now() at time zone 'Asia/Kolkata')::time < p_closes
    else
      (now() at time zone 'Asia/Kolkata')::time >= p_opens
      or (now() at time zone 'Asia/Kolkata')::time < p_closes
  end;
$$;

-- Append new columns; existing column order is unchanged.
create or replace view public.restaurant_browse
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
  updated_at,
  opens_at,
  closes_at,
  cost_for_two,
  is_pure_veg
from public.restaurants
where coalesce(is_synthetic, false) = false;

grant select on public.restaurant_browse to authenticated;

-- ---------------------------------------------------------------------------
-- Menu categories
-- ---------------------------------------------------------------------------
create table if not exists public.menu_categories (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  sort_order    integer not null default 50,
  created_at    timestamptz not null default now()
);

create unique index if not exists menu_categories_restaurant_name_key
  on public.menu_categories (restaurant_id, lower(name));

alter table public.menu_categories enable row level security;

drop policy if exists "menu_categories: everyone reads" on public.menu_categories;
create policy "menu_categories: everyone reads"
  on public.menu_categories for select to authenticated
  using (true);

drop policy if exists "menu_categories: staff writes" on public.menu_categories;
create policy "menu_categories: staff writes"
  on public.menu_categories for all to authenticated
  using (private.manages_restaurant(restaurant_id) or private.has_role('admin'))
  with check (private.manages_restaurant(restaurant_id) or private.has_role('admin'));

grant select, insert, update, delete on public.menu_categories to authenticated;

alter table public.menu_items
  add column if not exists category_id uuid references public.menu_categories (id) on delete set null,
  add column if not exists is_bestseller boolean not null default false;

create index if not exists menu_items_category_id_idx on public.menu_items (category_id);

-- Default menu order for common category names; managers can reorder later.
create or replace function private.default_category_sort(p_name text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(p_name) ~ '(recommend|bestseller|signature|special)' then 5
    when lower(p_name) ~ '(starter|snack|appetizer|small plate|chaat|tandoor)' then 10
    when lower(p_name) ~ '(soup|salad)' then 15
    when lower(p_name) ~ '(breakfast|dosa|idli|tiffin)' then 18
    when lower(p_name) ~ '(main|curry|curries|thali|gravy|seafood|fish)' then 20
    when lower(p_name) ~ '(biryani|rice|pulao|noodle|pasta|pizza|burger|wrap|roll|bowl)' then 25
    when lower(p_name) ~ '(bread|roti|naan|pav|side)' then 30
    when lower(p_name) ~ '(dessert|sweet|ice cream)' then 40
    when lower(p_name) ~ '(drink|beverage|juice|shake|coffee|tea|lassi)' then 45
    else 50
  end;
$$;

-- Dual-write: text category -> category_id, or category_id -> text category.
-- Synthetic eval kitchens are skipped so they never create category rows.
create or replace function private.sync_menu_item_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_id uuid;
begin
  if exists (
    select 1 from public.restaurants r
    where r.id = new.restaurant_id and coalesce(r.is_synthetic, false)
  ) then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.category_id is distinct from old.category_id
     and new.category is not distinct from old.category then
    if new.category_id is not null then
      select c.name into v_name
      from public.menu_categories c
      where c.id = new.category_id and c.restaurant_id = new.restaurant_id;
      if v_name is null then
        raise exception 'Category does not belong to this restaurant';
      end if;
      new.category := v_name;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' and new.category_id is not null and nullif(btrim(new.category), '') is null then
    select c.name into v_name
    from public.menu_categories c
    where c.id = new.category_id and c.restaurant_id = new.restaurant_id;
    if v_name is null then
      raise exception 'Category does not belong to this restaurant';
    end if;
    new.category := v_name;
    return new;
  end if;

  v_name := nullif(btrim(new.category), '');
  if v_name is null then
    new.category_id := null;
    return new;
  end if;

  insert into public.menu_categories (restaurant_id, name, sort_order)
  values (new.restaurant_id, v_name, private.default_category_sort(v_name))
  on conflict (restaurant_id, lower(name)) do nothing;

  select c.id into v_id
  from public.menu_categories c
  where c.restaurant_id = new.restaurant_id and lower(c.name) = lower(v_name);

  new.category_id := v_id;
  return new;
end;
$$;

drop trigger if exists menu_items_sync_category on public.menu_items;
create trigger menu_items_sync_category
  before insert or update of category, category_id, restaurant_id on public.menu_items
  for each row execute function private.sync_menu_item_category();

-- Backfill real kitchens only.
insert into public.menu_categories (restaurant_id, name, sort_order)
select distinct on (m.restaurant_id, lower(btrim(m.category)))
  m.restaurant_id,
  btrim(m.category),
  private.default_category_sort(btrim(m.category))
from public.menu_items m
join public.restaurants r on r.id = m.restaurant_id
where coalesce(r.is_synthetic, false) = false
  and nullif(btrim(m.category), '') is not null
order by m.restaurant_id, lower(btrim(m.category)), btrim(m.category)
on conflict (restaurant_id, lower(name)) do nothing;

update public.menu_items m
set category_id = c.id
from public.menu_categories c
where c.restaurant_id = m.restaurant_id
  and lower(c.name) = lower(btrim(m.category))
  and m.category_id is distinct from c.id;

comment on table public.menu_categories is
  'Ordered menu sections per kitchen. menu_items.category text is dual-written via trigger.';
comment on column public.restaurants.opens_at is 'Daily opening time (IST). Null = no hours set.';
comment on column public.restaurants.closes_at is 'Daily closing time (IST). Earlier than opens_at = past midnight.';
comment on column public.home_highlights.ends_at is 'Offer hidden from home_feed after this time.';
