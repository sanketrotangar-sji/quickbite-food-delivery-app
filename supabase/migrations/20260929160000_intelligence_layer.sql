-- Part 2 intelligence: RAG match RPC, support tickets, automation events/config,
-- auto rider assign on ready, kitchen-load ETA alerts via pg_cron.

-- ------------------------------------------------------------
-- match_embeddings — cosine search over the generic embeddings index
-- ------------------------------------------------------------
create or replace function public.match_embeddings(
  query_embedding extensions.vector(768),
  match_count integer default 5,
  filter_source text[] default null
)
returns table (
  source_table text,
  source_id uuid,
  similarity double precision,
  preview text,
  meta jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if match_count is null or match_count < 1 then
    match_count := 5;
  end if;
  if match_count > 20 then
    match_count := 20;
  end if;

  return query
  with ranked as (
    select
      e.source_table,
      e.source_id,
      (1 - (e.embedding <=> query_embedding))::double precision as similarity
    from public.embeddings e
    where filter_source is null
       or e.source_table = any (filter_source)
    order by e.embedding <=> query_embedding
    limit match_count
  )
  select
    r.source_table,
    r.source_id,
    r.similarity,
    case r.source_table
      when 'menu_items' then coalesce(
        nullif(trim(concat_ws(' · ', mi.name, mi.category, mi.description)), ''),
        'menu item'
      )
      when 'ratings' then coalesce(nullif(trim(ra.comment), ''), format('Food rating %s/5', ra.food_rating))
      else r.source_table
    end as preview,
    case r.source_table
      when 'menu_items' then jsonb_build_object(
        'name', mi.name,
        'category', mi.category,
        'price', mi.price,
        'is_veg', mi.is_veg,
        'is_available', mi.is_available,
        'restaurant_id', mi.restaurant_id,
        'restaurant_name', rest.name,
        'cuisine', rest.cuisine
      )
      when 'ratings' then jsonb_build_object(
        'food_rating', ra.food_rating,
        'delivery_rating', ra.delivery_rating,
        'restaurant_id', ra.restaurant_id,
        'comment', ra.comment
      )
      else '{}'::jsonb
    end as meta
  from ranked r
  left join public.menu_items mi
    on r.source_table = 'menu_items' and mi.id = r.source_id
  left join public.restaurants rest
    on mi.restaurant_id = rest.id
  left join public.ratings ra
    on r.source_table = 'ratings' and ra.id = r.source_id;
end;
$$;

revoke all on function public.match_embeddings(extensions.vector, integer, text[]) from public;
grant execute on function public.match_embeddings(extensions.vector, integer, text[]) to authenticated, service_role;

-- ------------------------------------------------------------
-- support_tickets
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('open', 'in_progress', 'resolved');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_urgency') then
    create type public.ticket_urgency as enum ('low', 'medium', 'high');
  end if;
end
$$;

create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  customer_id   uuid not null references public.profiles(id) on delete cascade,
  issue_type    text not null check (char_length(trim(issue_type)) > 0),
  description   text not null check (char_length(trim(description)) > 0),
  status        public.ticket_status not null default 'open',
  urgency       public.ticket_urgency not null default 'low',
  created_at    timestamptz not null default now()
);

create index if not exists support_tickets_customer_idx
  on public.support_tickets (customer_id, created_at desc);
create index if not exists support_tickets_order_idx
  on public.support_tickets (order_id);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets: customer reads own" on public.support_tickets;
create policy "support_tickets: customer reads own"
  on public.support_tickets for select to authenticated
  using ( customer_id = (select auth.uid()) );

drop policy if exists "support_tickets: customer inserts own" on public.support_tickets;
create policy "support_tickets: customer inserts own"
  on public.support_tickets for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id = (select auth.uid())
    )
  );

drop policy if exists "support_tickets: staff reads kitchen tickets" on public.support_tickets;
create policy "support_tickets: staff reads kitchen tickets"
  on public.support_tickets for select to authenticated
  using (
    private.has_role('admin')
    or exists (
      select 1
      from public.orders o
      where o.id = order_id
        and private.manages_restaurant(o.restaurant_id)
    )
  );

drop policy if exists "support_tickets: staff updates kitchen tickets" on public.support_tickets;
create policy "support_tickets: staff updates kitchen tickets"
  on public.support_tickets for update to authenticated
  using (
    private.has_role('admin')
    or exists (
      select 1
      from public.orders o
      where o.id = order_id
        and private.manages_restaurant(o.restaurant_id)
    )
  )
  with check (
    private.has_role('admin')
    or exists (
      select 1
      from public.orders o
      where o.id = order_id
        and private.manages_restaurant(o.restaurant_id)
    )
  );

grant select, insert on public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;

-- ------------------------------------------------------------
-- automation_events + automation_config
-- ------------------------------------------------------------
create table if not exists public.automation_events (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (char_length(trim(kind)) > 0),
  order_id        uuid references public.orders(id) on delete set null,
  restaurant_id   uuid references public.restaurants(id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists automation_events_kind_idx
  on public.automation_events (kind, created_at desc);
create index if not exists automation_events_restaurant_idx
  on public.automation_events (restaurant_id, created_at desc);

alter table public.automation_events enable row level security;

drop policy if exists "automation_events: admin reads" on public.automation_events;
create policy "automation_events: admin reads"
  on public.automation_events for select to authenticated
  using ( private.has_role('admin') );

drop policy if exists "automation_events: customer reads own order events" on public.automation_events;
create policy "automation_events: customer reads own order events"
  on public.automation_events for select to authenticated
  using (
    order_id is not null
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = (select auth.uid())
    )
  );

drop policy if exists "automation_events: staff reads kitchen events" on public.automation_events;
create policy "automation_events: staff reads kitchen events"
  on public.automation_events for select to authenticated
  using (
    restaurant_id is not null
    and private.manages_restaurant(restaurant_id)
  );

grant select on public.automation_events to authenticated;

create table if not exists public.automation_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.automation_config enable row level security;

drop policy if exists "automation_config: authenticated reads" on public.automation_config;
create policy "automation_config: authenticated reads"
  on public.automation_config for select to authenticated
  using ( true );

drop policy if exists "automation_config: admin writes" on public.automation_config;
create policy "automation_config: admin writes"
  on public.automation_config for all to authenticated
  using ( private.has_role('admin') )
  with check ( private.has_role('admin') );

grant select on public.automation_config to authenticated;
grant insert, update, delete on public.automation_config to authenticated;

insert into public.automation_config (key, value) values
  ('kitchen_open_order_threshold', '8'::jsonb),
  ('kitchen_eta_bump_minutes', '15'::jsonb),
  ('kitchen_load_cooldown_minutes', '30'::jsonb)
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- Automation 1: auto-assign nearest online rider when order becomes ready
-- ------------------------------------------------------------
create or replace function private.haversine_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select case
    when lat1 is null or lng1 is null or lat2 is null or lng2 is null then null
    else (
      6371.0 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(lat1)) * cos(radians(lat2))
          * cos(radians(lng2) - radians(lng1))
          + sin(radians(lat1)) * sin(radians(lat2))
        ))
      )
    )
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

  -- BEFORE UPDATE: assign on the incoming row (race-safe vs concurrent claim).
  new.rider_id := v_rider;

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

drop trigger if exists orders_auto_assign_rider on public.orders;
create trigger orders_auto_assign_rider
  before update of status on public.orders
  for each row
  execute function private.auto_assign_rider();

revoke all on function private.auto_assign_rider() from public, anon, authenticated;
revoke all on function private.haversine_km(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- Automation 2: kitchen-load ETA bumps (scheduled)
-- ------------------------------------------------------------
create or replace function public.run_kitchen_load_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold int := 8;
  v_bump int := 15;
  v_cooldown int := 30;
  v_rest record;
  v_order record;
  v_base int;
  v_new_eta int;
  v_bumped int := 0;
  v_kitchens int := 0;
  v_open int;
begin
  select coalesce((value #>> '{}')::int, 8) into v_threshold
  from public.automation_config where key = 'kitchen_open_order_threshold';
  select coalesce((value #>> '{}')::int, 15) into v_bump
  from public.automation_config where key = 'kitchen_eta_bump_minutes';
  select coalesce((value #>> '{}')::int, 30) into v_cooldown
  from public.automation_config where key = 'kitchen_load_cooldown_minutes';

  for v_rest in
    select
      r.id as restaurant_id,
      r.name,
      coalesce(r.prep_minutes, 30) as prep_minutes,
      count(o.id)::int as open_count
    from public.restaurants r
    join public.orders o
      on o.restaurant_id = r.id
     and o.status in ('placed', 'preparing', 'ready')
    group by r.id, r.name, r.prep_minutes
    having count(o.id) > v_threshold
  loop
    if exists (
      select 1
      from public.automation_events ae
      where ae.kind = 'kitchen_load_eta_bump'
        and ae.restaurant_id = v_rest.restaurant_id
        and ae.created_at > now() - make_interval(mins => v_cooldown)
    ) then
      continue;
    end if;

    v_kitchens := v_kitchens + 1;
    v_open := v_rest.open_count;

    for v_order in
      select o.id, o.customer_id, o.eta_minutes
      from public.orders o
      where o.restaurant_id = v_rest.restaurant_id
        and o.status in ('placed', 'preparing', 'ready')
    loop
      v_base := coalesce(v_order.eta_minutes, v_rest.prep_minutes, 30);
      v_new_eta := v_base + v_bump;

      update public.orders
         set eta_minutes = v_new_eta
       where id = v_order.id;

      insert into public.notifications (user_id, title, body)
      values (
        v_order.customer_id,
        'Kitchen is busy — ETA updated',
        format(
          '%s has a heavy order load right now. Your estimated delivery time was adjusted to about %s minutes.',
          v_rest.name,
          v_new_eta
        )
      );

      insert into public.automation_events (kind, order_id, restaurant_id, payload)
      values (
        'kitchen_load_eta_bump',
        v_order.id,
        v_rest.restaurant_id,
        jsonb_build_object(
          'previous_eta', v_order.eta_minutes,
          'new_eta', v_new_eta,
          'bump_minutes', v_bump,
          'open_orders', v_open,
          'threshold', v_threshold,
          'restaurant_name', v_rest.name
        )
      );

      v_bumped := v_bumped + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'kitchens', v_kitchens,
    'orders_bumped', v_bumped,
    'threshold', v_threshold,
    'bump_minutes', v_bump
  );
end;
$$;

revoke all on function public.run_kitchen_load_alerts() from public;
grant execute on function public.run_kitchen_load_alerts() to service_role;

-- pg_cron schedule (hosted Supabase). Safe no-op if extension unavailable.
do $$
begin
  create extension if not exists pg_cron;

  -- Unschedule prior job if re-running migration.
  if exists (select 1 from cron.job where jobname = 'quickbite-kitchen-load-alerts') then
    perform cron.unschedule('quickbite-kitchen-load-alerts');
  end if;

  perform cron.schedule(
    'quickbite-kitchen-load-alerts',
    '*/5 * * * *',
    $cron$select public.run_kitchen_load_alerts();$cron$
  );
exception
  when others then
    raise notice 'pg_cron not available or schedule failed: %', sqlerrm;
end
$$;

grant select, insert, update, delete on public.support_tickets to service_role;
grant select, insert on public.automation_events to service_role;
grant select on public.automation_config to service_role;
