-- Screen-shaped reads for the customer app and RIO.
-- Browse RPCs are security definer and return only customer-safe columns (same model as
-- restaurant_browse) so guests (anon) can browse. Synthetic kitchens and the caller's own
-- kitchens are excluded. Distance, ETA, 8 km range and open-now are computed here.
-- order_tracking is security invoker: existing orders / history / rider RLS applies.
-- Rollback: drop function public.order_tracking(uuid);
--           drop function public.restaurant_detail(uuid, double precision, double precision);
--           drop function public.home_feed(double precision, double precision);
--           drop function public.browse_restaurants(double precision, double precision, text, boolean,
--             boolean, numeric, boolean, text, text, text, integer);
--           drop function private.place_rows(double precision, double precision);
--           drop function private.place_card(...); drop function private.place_sort_key(...);
--           drop function private.delivery_max_km();

create or replace function private.delivery_max_km()
returns double precision
language sql
immutable
set search_path = ''
as $$ select 8::double precision $$;

-- One row per visible kitchen, with everything a card needs.
create or replace function private.place_rows(p_lat double precision, p_lng double precision)
returns table (
  id uuid,
  name text,
  cuisine text,
  description text,
  image_url text,
  branch_name text,
  address text,
  lat double precision,
  lng double precision,
  is_open boolean,
  opens_at time,
  closes_at time,
  offer_percent integer,
  prep_minutes integer,
  cost_for_two integer,
  is_pure_veg boolean,
  has_veg boolean,
  has_nonveg boolean,
  rating_avg double precision,
  rating_count integer,
  distance_km double precision,
  eta_min integer,
  eta_max integer,
  in_range boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      r.*,
      case
        when p_lat is not null and p_lng is not null and r.lat is not null and r.lng is not null
          then round(private.haversine_km(p_lat, p_lng, r.lat::double precision, r.lng::double precision)::numeric, 2)::double precision
      end as dist
    from public.restaurants r
    where coalesce(r.is_synthetic, false) = false
      and not (
        (select auth.uid()) is not null
        and private.manages_restaurant(r.id)
      )
  )
  select
    b.id,
    b.name,
    b.cuisine,
    b.description,
    b.image_url,
    b.branch_name,
    b.address,
    b.lat::double precision,
    b.lng::double precision,
    private.restaurant_open_now(b.is_open, b.opens_at, b.closes_at),
    b.opens_at,
    b.closes_at,
    b.offer_percent,
    b.prep_minutes,
    b.cost_for_two,
    b.is_pure_veg,
    exists (select 1 from public.menu_items m where m.restaurant_id = b.id and m.is_available and m.is_veg),
    exists (select 1 from public.menu_items m where m.restaurant_id = b.id and m.is_available and not m.is_veg),
    rs.avg_food,
    coalesce(rs.rating_count, 0),
    b.dist,
    (coalesce(nullif(b.prep_minutes, 0), 20) + ceil(coalesce(b.dist, 3) * 3))::integer,
    (coalesce(nullif(b.prep_minutes, 0), 20) + ceil(coalesce(b.dist, 3) * 3))::integer + 10,
    case when b.dist is null then null else b.dist <= private.delivery_max_km() end
  from base b
  left join public.restaurant_rating_summary rs on rs.restaurant_id = b.id;
$$;

revoke all on function private.place_rows(double precision, double precision) from public;

-- Shared JSON shape for a restaurant card (snake_case; @quickbite/api maps to camelCase).
create or replace function private.place_card(
  p_id uuid,
  p_name text,
  p_cuisine text,
  p_description text,
  p_image_url text,
  p_branch_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_is_open boolean,
  p_opens_at time,
  p_closes_at time,
  p_offer_percent integer,
  p_prep_minutes integer,
  p_cost_for_two integer,
  p_is_pure_veg boolean,
  p_has_veg boolean,
  p_has_nonveg boolean,
  p_rating_avg double precision,
  p_rating_count integer,
  p_distance_km double precision,
  p_eta_min integer,
  p_eta_max integer,
  p_in_range boolean
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_id,
    'name', p_name,
    'cuisine', p_cuisine,
    'description', p_description,
    'image_url', p_image_url,
    'branch_name', p_branch_name,
    'address', p_address,
    'lat', p_lat,
    'lng', p_lng,
    'is_open', p_is_open,
    'opens_at', to_char(p_opens_at, 'HH24:MI'),
    'closes_at', to_char(p_closes_at, 'HH24:MI'),
    'offer_percent', p_offer_percent,
    'prep_minutes', p_prep_minutes,
    'cost_for_two', p_cost_for_two,
    'is_pure_veg', p_is_pure_veg,
    'has_veg', p_has_veg,
    'has_nonveg', p_has_nonveg,
    'rating_avg', case when p_rating_avg is null then null else round(p_rating_avg::numeric, 1) end,
    'rating_count', p_rating_count,
    'distance_km', p_distance_km,
    'eta_min', p_eta_min,
    'eta_max', p_eta_max,
    'in_range', p_in_range
  );
$$;

-- Sort key: smaller is better. Closed kitchens always sort after open ones.
create or replace function private.place_sort_key(
  p_sort text,
  p_is_open boolean,
  p_distance_km double precision,
  p_eta_min integer,
  p_rating_avg double precision,
  p_offer_percent integer
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (case when p_is_open then 0 else 100000 end)::numeric
    + case coalesce(p_sort, 'relevance')
        when 'eta' then coalesce(p_eta_min, 999)::numeric
        when 'rating' then round((5 - coalesce(p_rating_avg, 0))::numeric * 100, 0)
        when 'offer' then (100 - coalesce(p_offer_percent, 0))::numeric
        when 'distance' then round(coalesce(p_distance_km, 999)::numeric * 100, 0)
        else round(coalesce(p_distance_km, 50)::numeric * 100, 0)
             - round(coalesce(p_rating_avg, 0)::numeric * 10, 0)
      end;
$$;

-- ---------------------------------------------------------------------------
-- browse_restaurants: filtered, sorted, keyset-paged restaurant list
-- ---------------------------------------------------------------------------
create or replace function public.browse_restaurants(
  p_lat double precision default null,
  p_lng double precision default null,
  p_cuisine text default null,
  p_veg_only boolean default false,
  p_offers_only boolean default false,
  p_min_rating numeric default null,
  p_open_only boolean default false,
  p_query text default null,
  p_sort text default 'relevance',
  p_cursor text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor_key numeric;
  v_cursor_id uuid;
  v_query text := nullif(btrim(p_query), '');
  v_cuisine text := nullif(btrim(p_cuisine), '');
  v_rows jsonb;
  v_next text;
  v_count integer;
begin
  if p_sort is not null and p_sort not in ('relevance', 'eta', 'rating', 'offer', 'distance') then
    raise exception 'Unknown sort %', p_sort using errcode = '22023';
  end if;

  if nullif(p_cursor, '') is not null then
    begin
      v_cursor_key := split_part(p_cursor, '|', 1)::numeric;
      v_cursor_id := split_part(p_cursor, '|', 2)::uuid;
    exception when others then
      raise exception 'Invalid cursor' using errcode = '22023';
    end;
  end if;

  with ranked as (
    select
      p.*,
      private.place_sort_key(p_sort, p.is_open, p.distance_km, p.eta_min, p.rating_avg, p.offer_percent) as sort_key
    from private.place_rows(p_lat, p_lng) p
    where p.in_range is not false
      and (v_cuisine is null or p.cuisine ilike '%' || v_cuisine || '%'
           or exists (
             select 1 from public.menu_items m
             where m.restaurant_id = p.id and m.is_available and m.category ilike '%' || v_cuisine || '%'
           ))
      and (not coalesce(p_veg_only, false) or p.has_veg)
      and (not coalesce(p_offers_only, false) or coalesce(p.offer_percent, 0) > 0)
      and (p_min_rating is null or coalesce(p.rating_avg, 0) >= p_min_rating)
      and (not coalesce(p_open_only, false) or p.is_open)
      and (
        v_query is null
        or p.name ilike '%' || v_query || '%'
        or p.cuisine ilike '%' || v_query || '%'
        or exists (
          select 1 from public.menu_items m
          where m.restaurant_id = p.id and m.is_available and m.name ilike '%' || v_query || '%'
        )
      )
  ),
  page as (
    select *
    from ranked r
    where v_cursor_key is null or (r.sort_key, r.id) > (v_cursor_key, v_cursor_id)
    order by r.sort_key, r.id
    limit v_limit + 1
  ),
  numbered as (
    select page.*, row_number() over (order by page.sort_key, page.id) as rn
    from page
  )
  select
    coalesce(
      jsonb_agg(
        private.place_card(
          n.id, n.name, n.cuisine, n.description, n.image_url, n.branch_name, n.address, n.lat, n.lng,
          n.is_open, n.opens_at, n.closes_at, n.offer_percent, n.prep_minutes, n.cost_for_two,
          n.is_pure_veg, n.has_veg, n.has_nonveg, n.rating_avg, n.rating_count, n.distance_km,
          n.eta_min, n.eta_max, n.in_range
        ) order by n.rn
      ) filter (where n.rn <= v_limit),
      '[]'::jsonb
    ),
    max(case when n.rn = v_limit then n.sort_key::text || '|' || n.id::text end),
    count(*)
  into v_rows, v_next, v_count
  from numbered n;

  return jsonb_build_object(
    'items', v_rows,
    'next_cursor', case when v_count > v_limit then v_next end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- home_feed: everything Home paints in one round trip
-- ---------------------------------------------------------------------------
create or replace function public.home_feed(
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_banners jsonb;
  v_categories jsonb;
  v_dishes jsonb;
  v_order_again jsonb := '[]'::jsonb;
  v_places jsonb;
begin
  select coalesce(jsonb_agg(b order by b_priority desc, b_sort), '[]'::jsonb)
  into v_banners
  from (
    select
      jsonb_build_object(
        'id', h.id,
        'title', h.title,
        'subtitle', h.subtitle,
        'image_url', h.image_url,
        'kind', h.kind,
        'restaurant_id', h.restaurant_id,
        'restaurant_name', p.name,
        'badge', coalesce(nullif(btrim(h.badge), ''), case when h.kind = 'offer' then 'Offer' else 'Watch' end),
        'cta_label', coalesce(nullif(btrim(h.cta_label), ''), 'Order now'),
        'ends_at', h.ends_at
      ) as b,
      h.priority as b_priority,
      h.sort_order as b_sort
    from public.home_highlights h
    left join (select * from private.place_rows(p_lat, p_lng) x where x.in_range is not false) p on p.id = h.restaurant_id
    where h.is_active
      and (h.starts_at is null or h.starts_at <= now())
      and (h.ends_at is null or h.ends_at > now())
      and (h.restaurant_id is null or p.id is not null)
  ) banners;

  select coalesce(jsonb_agg(c order by c_count desc, c_label), '[]'::jsonb)
  into v_categories
  from (
    select
      jsonb_build_object('label', min(mc.name), 'count', count(*), 'image_url',
        (array_agg(m.image_url order by m.is_bestseller desc, m.name) filter (where m.image_url is not null))[1]
      ) as c,
      count(*) as c_count,
      lower(mc.name) as c_label
    from public.menu_items m
    join public.menu_categories mc on mc.id = m.category_id
    join (select * from private.place_rows(p_lat, p_lng) x where x.in_range is not false) p on p.id = m.restaurant_id
    where m.is_available
    group by lower(mc.name)
    order by count(*) desc
    limit 12
  ) cats;

  with order_counts as (
    select oi.menu_item_id, sum(oi.quantity)::integer as qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.status = 'delivered'
      and o.placed_at >= now() - interval '60 days'
      and oi.menu_item_id is not null
    group by oi.menu_item_id
  ),
  ranked as (
    select
      m.id, m.restaurant_id, m.name, m.price, m.image_url, m.is_veg, m.category, m.is_bestseller,
      p.name as restaurant_name, p.offer_percent,
      row_number() over (
        partition by m.restaurant_id
        order by coalesce(oc.qty, 0) desc, m.is_bestseller desc, (m.image_url is null), m.name
      ) as rn,
      coalesce(oc.qty, 0) as qty
    from public.menu_items m
    join (select * from private.place_rows(p_lat, p_lng) x where x.in_range is not false) p on p.id = m.restaurant_id and p.is_open
    left join order_counts oc on oc.menu_item_id = m.id
    where m.is_available
  )
  select coalesce(jsonb_agg(d order by d_qty desc, d_best desc, d_name), '[]'::jsonb)
  into v_dishes
  from (
    select
      jsonb_build_object(
        'id', r.id,
        'restaurant_id', r.restaurant_id,
        'restaurant_name', r.restaurant_name,
        'name', r.name,
        'price', r.price,
        'image_url', r.image_url,
        'is_veg', r.is_veg,
        'category', r.category,
        'is_bestseller', r.is_bestseller,
        'offer_percent', r.offer_percent
      ) as d,
      r.qty as d_qty,
      r.is_bestseller as d_best,
      r.name as d_name
    from ranked r
    where r.rn <= 2
    order by r.qty desc, r.is_bestseller desc, r.name
    limit 16
  ) dishes;

  if v_uid is not null then
    select coalesce(jsonb_agg(card order by last_at desc), '[]'::jsonb)
    into v_order_again
    from (
      select
        private.place_card(
          p.id, p.name, p.cuisine, p.description, p.image_url, p.branch_name, p.address, p.lat, p.lng,
          p.is_open, p.opens_at, p.closes_at, p.offer_percent, p.prep_minutes, p.cost_for_two,
          p.is_pure_veg, p.has_veg, p.has_nonveg, p.rating_avg, p.rating_count, p.distance_km,
          p.eta_min, p.eta_max, p.in_range
        ) as card,
        last_orders.last_at
      from (
        select o.restaurant_id, max(o.placed_at) as last_at
        from public.orders o
        where o.customer_id = v_uid and o.status = 'delivered'
        group by o.restaurant_id
        order by max(o.placed_at) desc
        limit 6
      ) last_orders
      join (select * from private.place_rows(p_lat, p_lng) x where x.in_range is not false) p on p.id = last_orders.restaurant_id
    ) again;
  end if;

  v_places := public.browse_restaurants(p_lat => p_lat, p_lng => p_lng, p_limit => 20);

  return jsonb_build_object(
    'banners', v_banners,
    'categories', v_categories,
    'popular_dishes', v_dishes,
    'order_again', v_order_again,
    'places', v_places -> 'items',
    'places_next_cursor', v_places -> 'next_cursor',
    'has_location', p_lat is not null and p_lng is not null
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- restaurant_detail: kitchen card + menu grouped by category
-- ---------------------------------------------------------------------------
create or replace function public.restaurant_detail(
  p_id uuid,
  p_lat double precision default null,
  p_lng double precision default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with place as (
    select * from private.place_rows(p_lat, p_lng) p where p.id = p_id
  ),
  items as (
    select
      m.*,
      coalesce(mc.id::text, 'other') as section_id,
      coalesce(mc.name, nullif(btrim(m.category), ''), 'Menu') as section_name,
      coalesce(mc.sort_order, 60) as section_sort
    from public.menu_items m
    join place on place.id = m.restaurant_id
    left join public.menu_categories mc on mc.id = m.category_id
    where m.is_available
  ),
  sections as (
    select
      section_id,
      min(section_name) as section_name,
      min(section_sort) as section_sort,
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'restaurant_id', i.restaurant_id,
          'name', i.name,
          'description', i.description,
          'price', i.price,
          'image_url', i.image_url,
          'is_veg', i.is_veg,
          'is_available', i.is_available,
          'is_bestseller', i.is_bestseller,
          'category', i.section_name
        ) order by i.is_bestseller desc, i.name
      ) as items
    from items i
    group by section_id
  )
  select case when not exists (select 1 from place) then null else
    jsonb_build_object(
      'restaurant', (
        select private.place_card(
          p.id, p.name, p.cuisine, p.description, p.image_url, p.branch_name, p.address, p.lat, p.lng,
          p.is_open, p.opens_at, p.closes_at, p.offer_percent, p.prep_minutes, p.cost_for_two,
          p.is_pure_veg, p.has_veg, p.has_nonveg, p.rating_avg, p.rating_count, p.distance_km,
          p.eta_min, p.eta_max, p.in_range
        ) from place p
      ),
      'sections', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', s.section_id, 'name', s.section_name, 'items', s.items)
          order by s.section_sort, s.section_name
        ) from sections s
      ), '[]'::jsonb),
      'bestsellers', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id, 'restaurant_id', i.restaurant_id, 'name', i.name, 'description', i.description,
            'price', i.price, 'image_url', i.image_url, 'is_veg', i.is_veg,
            'is_available', i.is_available, 'is_bestseller', true, 'category', i.section_name
          ) order by i.name
        ) from items i where i.is_bestseller
      ), '[]'::jsonb)
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- order_tracking: one read for the tracking screen (RLS applies)
-- ---------------------------------------------------------------------------
create or replace function public.order_tracking(p_order_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when o.id is null then null else
    to_jsonb(o) || jsonb_build_object(
      'restaurant', (
        select jsonb_build_object(
          'id', r.id, 'name', r.name, 'address', r.address, 'image_url', r.image_url,
          'lat', r.lat, 'lng', r.lng, 'phone', null
        )
        from public.restaurant_browse r where r.id = o.restaurant_id
      ),
      'rider', (
        select jsonb_build_object(
          'id', pr.id, 'full_name', pr.full_name, 'phone', pr.phone,
          'vehicle_label', pr.vehicle_label, 'plate', pr.plate, 'is_online', pr.is_online
        )
        from public.profiles pr where pr.id = o.rider_id
      ),
      'items', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id, 'item_name', oi.item_name, 'quantity', oi.quantity,
            'unit_price', oi.unit_price, 'menu_item_id', oi.menu_item_id,
            'image_url', mi.image_url, 'is_veg', mi.is_veg
          ) order by oi.item_name
        )
        from public.order_items oi
        left join public.menu_items mi on mi.id = oi.menu_item_id
        where oi.order_id = o.id
      ), '[]'::jsonb),
      'history', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', h.id, 'status', h.status, 'changed_at', h.changed_at)
          order by h.changed_at
        )
        from public.order_status_history h where h.order_id = o.id
      ), '[]'::jsonb),
      'riderLocation', (
        select jsonb_build_object(
          'rider_id', l.rider_id, 'order_id', l.order_id, 'lat', l.lat, 'lng', l.lng,
          'updated_at', l.updated_at
        )
        from public.rider_locations l
        where l.order_id = o.id
        order by l.updated_at desc
        limit 1
      )
    )
  end
  from (select 1) one
  left join public.orders o on o.id = p_order_id;
$$;

revoke all on function public.browse_restaurants(double precision, double precision, text, boolean, boolean, numeric, boolean, text, text, text, integer) from public;
revoke all on function public.home_feed(double precision, double precision) from public;
revoke all on function public.restaurant_detail(uuid, double precision, double precision) from public;
revoke all on function public.order_tracking(uuid) from public;

grant execute on function public.browse_restaurants(double precision, double precision, text, boolean, boolean, numeric, boolean, text, text, text, integer) to anon, authenticated, service_role;
grant execute on function public.home_feed(double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.restaurant_detail(uuid, double precision, double precision) to anon, authenticated, service_role;
grant execute on function public.order_tracking(uuid) to authenticated;

comment on function public.browse_restaurants is
  'Customer restaurant list: server-side filters, sort (relevance|eta|rating|offer|distance), keyset cursor, 8 km range.';
comment on function public.home_feed is
  'Home in one call: live banners, categories, popular dishes, order again, first page of places.';
comment on function public.restaurant_detail is
  'Kitchen card + available menu grouped by menu_categories (bestsellers first). Null when hidden.';
comment on function public.order_tracking is
  'Tracking screen read: order, restaurant, rider, items, status history, latest rider location. RLS applies.';
