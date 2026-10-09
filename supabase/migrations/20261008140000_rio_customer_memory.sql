-- Durable RIO preferences (survive new chats). Injected via rio_snapshot.memory.
-- Writes only through security-definer RPC (profiles UPDATE is limited to full_name/phone).

alter table public.profiles
  add column if not exists rio_memory jsonb not null default '{}'::jsonb;

comment on column public.profiles.rio_memory is
  'Customer prefs for RIO (diet, spice, budget, cuisines, notes). Merged by rio_update_memory.';

create or replace function public.rio_update_memory(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_next jsonb;
  v_diet text;
  v_spice text;
  v_budget numeric;
  v_notes text;
  v_cuisines jsonb;
  v_avoid jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Memory patch must be a JSON object.' using errcode = '22023';
  end if;

  v_diet := nullif(lower(trim(coalesce(p_patch ->> 'diet', ''))), '');
  if v_diet is not null and v_diet not in ('veg', 'non_veg', 'any', 'eggetarian') then
    raise exception 'diet must be veg, non_veg, any, or eggetarian.' using errcode = '22023';
  end if;

  v_spice := nullif(lower(trim(coalesce(p_patch ->> 'spice', ''))), '');
  if v_spice is not null and v_spice not in ('mild', 'medium', 'spicy', 'any') then
    raise exception 'spice must be mild, medium, spicy, or any.' using errcode = '22023';
  end if;

  begin
    v_budget := nullif(trim(coalesce(p_patch ->> 'budget_max', '')), '')::numeric;
  exception when others then
    raise exception 'budget_max must be a number.' using errcode = '22023';
  end;
  if v_budget is not null and (v_budget < 50 or v_budget > 5000) then
    raise exception 'budget_max must be between 50 and 5000.' using errcode = '22023';
  end if;

  v_notes := nullif(trim(coalesce(p_patch ->> 'notes', '')), '');
  if v_notes is not null then
    v_notes := left(v_notes, 240);
  end if;

  if p_patch ? 'cuisines_like' then
    if jsonb_typeof(p_patch -> 'cuisines_like') is distinct from 'array' then
      raise exception 'cuisines_like must be an array of strings.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(to_jsonb(left(trim(x), 40))), '[]'::jsonb)
      into v_cuisines
      from (
        select value #>> '{}' as x
          from jsonb_array_elements(p_patch -> 'cuisines_like')
         limit 8
      ) s
     where nullif(trim(x), '') is not null;
  end if;

  if p_patch ? 'avoid' then
    if jsonb_typeof(p_patch -> 'avoid') is distinct from 'array' then
      raise exception 'avoid must be an array of strings.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(to_jsonb(left(trim(x), 40))), '[]'::jsonb)
      into v_avoid
      from (
        select value #>> '{}' as x
          from jsonb_array_elements(p_patch -> 'avoid')
         limit 8
      ) s
     where nullif(trim(x), '') is not null;
  end if;

  update public.profiles p
     set rio_memory = coalesce(p.rio_memory, '{}'::jsonb)
       || jsonb_strip_nulls(jsonb_build_object(
            'diet', v_diet,
            'spice', v_spice,
            'budget_max', v_budget,
            'notes', v_notes,
            'cuisines_like', v_cuisines,
            'avoid', v_avoid,
            'updated_at', to_jsonb(now())
          )),
         updated_at = now()
   where p.id = v_uid
   returning p.rio_memory into v_next;

  return coalesce(v_next, '{}'::jsonb);
end;
$$;

revoke all on function public.rio_update_memory(jsonb) from public, anon;
grant execute on function public.rio_update_memory(jsonb) to authenticated;

-- Snapshot includes durable memory + inferred taste.
create or replace function public.rio_snapshot(
  p_delivery_address_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text;
  v_email text;
  v_memory jsonb := '{}'::jsonb;
  v_addr_id uuid;
  v_address text;
  v_lat double precision;
  v_lng double precision;
  v_rest_id uuid;
  v_rest_name text;
  v_rest_lat double precision;
  v_rest_lng double precision;
  v_offer integer := 0;
  v_subtotal numeric(10,2) := 0;
  v_discount numeric(10,2) := 0;
  v_fee numeric(10,2) := 0;
  v_total numeric(10,2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_drop_km numeric(6,2);
  v_in_range boolean;
  v_order jsonb;
  v_ticket jsonb;
  v_taste jsonb := '{}'::jsonb;
  v_order_count integer := 0;
  v_avg_spend numeric(10,2);
  v_veg_ratio numeric(5,2);
  v_cuisines jsonb;
  v_last_dishes jsonb;
  v_last_kitchen text;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select nullif(trim(p.full_name), ''), p.email, coalesce(p.rio_memory, '{}'::jsonb)
    into v_name, v_email, v_memory
    from public.profiles p
   where p.id = v_uid;
  if v_name is null then
    v_name := split_part(coalesce(v_email, 'there'), '@', 1);
  end if;

  if p_delivery_address_id is not null then
    select a.id,
           concat_ws(
             ', ',
             trim(a.address_line),
             trim(a.area),
             case
               when nullif(trim(a.landmark), '') is not null
                 then 'Landmark: ' || trim(a.landmark)
             end
           ),
           a.lat::double precision,
           a.lng::double precision
      into v_addr_id, v_address, v_lat, v_lng
      from public.customer_addresses a
     where a.id = p_delivery_address_id
       and a.customer_id = v_uid;
  end if;

  if v_addr_id is null then
    select a.id,
           concat_ws(
             ', ',
             trim(a.address_line),
             trim(a.area),
             case
               when nullif(trim(a.landmark), '') is not null
                 then 'Landmark: ' || trim(a.landmark)
             end
           ),
           a.lat::double precision,
           a.lng::double precision
      into v_addr_id, v_address, v_lat, v_lng
      from public.customer_addresses a
     where a.customer_id = v_uid
     order by a.is_default desc, a.created_at desc
     limit 1;
  end if;

  select c.restaurant_id,
         r.name,
         r.lat::double precision,
         r.lng::double precision,
         greatest(0, least(100, coalesce(r.offer_percent, 0)))
    into v_rest_id, v_rest_name, v_rest_lat, v_rest_lng, v_offer
    from public.cart_items c
    join public.restaurants r on r.id = c.restaurant_id
   where c.customer_id = v_uid
   limit 1;

  if v_rest_id is not null then
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'menu_item_id', c.menu_item_id,
                 'name', m.name,
                 'quantity', c.quantity,
                 'unit_price', m.price
               )
               order by c.created_at
             ),
             '[]'::jsonb
           ),
           coalesce(sum(c.quantity * m.price), 0)
      into v_lines, v_subtotal
      from public.cart_items c
      join public.menu_items m on m.id = c.menu_item_id
     where c.customer_id = v_uid;

    v_discount := round(v_subtotal * v_offer / 100.0, 2);
    v_fee := public.standard_delivery_fee();
    v_total := greatest(0, round(v_subtotal - v_discount, 2)) + v_fee;

    if v_rest_lat is not null and v_rest_lng is not null and v_lat is not null and v_lng is not null then
      v_drop_km := round(
        private.haversine_km(v_rest_lat, v_rest_lng, v_lat, v_lng)::numeric,
        2
      );
      v_in_range := v_drop_km <= 8;
    elsif v_lat is null or v_lng is null then
      v_in_range := false;
    else
      v_in_range := null;
    end if;
  end if;

  select jsonb_build_object(
           'id', o.id,
           'status', o.status,
           'total', o.total_amount,
           'placed_at', o.placed_at,
           'restaurant_name', r.name,
           'rider_assigned', o.rider_id is not null,
           'last_status', (
             select h.status
               from public.order_status_history h
              where h.order_id = o.id
              order by h.changed_at desc
              limit 1
           )
         )
    into v_order
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
   where o.customer_id = v_uid
     and o.status in ('placed', 'preparing', 'ready', 'out_for_delivery')
   order by o.placed_at desc
   limit 1;

  select jsonb_build_object(
           'id', t.id,
           'order_id', t.order_id,
           'issue_type', t.issue_type,
           'status', t.status,
           'urgency', t.urgency
         )
    into v_ticket
    from public.support_tickets t
   where t.customer_id = v_uid
     and t.status in ('open', 'in_progress')
   order by t.created_at desc
   limit 1;

  select count(*)::integer,
         round(avg(o.total_amount)::numeric, 2)
    into v_order_count, v_avg_spend
    from public.orders o
   where o.customer_id = v_uid
     and o.status = 'delivered';

  if v_order_count > 0 then
    select coalesce(
             jsonb_agg(jsonb_build_object('cuisine', x.cuisine, 'count', x.ct) order by x.ct desc),
             '[]'::jsonb
           )
      into v_cuisines
      from (
        select coalesce(nullif(trim(r.cuisine), ''), 'Other') as cuisine, count(*)::integer as ct
          from public.orders o
          join public.restaurants r on r.id = o.restaurant_id
         where o.customer_id = v_uid
           and o.status = 'delivered'
         group by 1
         order by ct desc
         limit 3
      ) x;

    select case
             when sum(oi.quantity) = 0 then null
             else round(100.0 * sum(case when coalesce(m.is_veg, false) then oi.quantity else 0 end)
                  / sum(oi.quantity), 1)
           end
      into v_veg_ratio
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      left join public.menu_items m on m.id = oi.menu_item_id
     where o.customer_id = v_uid
       and o.status = 'delivered';

    select r.name
      into v_last_kitchen
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
     where o.customer_id = v_uid
       and o.status = 'delivered'
     order by o.placed_at desc
     limit 1;

    select coalesce(
             jsonb_agg(jsonb_build_object('name', x.item_name, 'restaurant_id', x.restaurant_id) order by x.n),
             '[]'::jsonb
           )
      into v_last_dishes
      from (
        select oi.item_name, o.restaurant_id, row_number() over (order by o.placed_at desc, oi.item_name) as n
          from public.orders o
          join public.order_items oi on oi.order_id = o.id
         where o.customer_id = v_uid
           and o.status = 'delivered'
         order by o.placed_at desc, oi.item_name
         limit 5
      ) x;

    v_taste := jsonb_build_object(
      'order_count', v_order_count,
      'typical_spend', v_avg_spend,
      'top_cuisines', coalesce(v_cuisines, '[]'::jsonb),
      'veg_ratio_percent', v_veg_ratio,
      'last_kitchen', v_last_kitchen,
      'recent_dishes', coalesce(v_last_dishes, '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'customer', jsonb_build_object('name', v_name),
    'memory', v_memory,
    'address', case
      when v_addr_id is null then null
      else jsonb_build_object(
        'id', v_addr_id,
        'text', v_address,
        'lat', v_lat,
        'lng', v_lng
      )
    end,
    'cart', case
      when v_rest_id is null then null
      else jsonb_build_object(
        'restaurant_id', v_rest_id,
        'restaurant_name', v_rest_name,
        'lines', v_lines,
        'subtotal', v_subtotal,
        'offer_percent', v_offer,
        'discount_amount', v_discount,
        'delivery_fee', v_fee,
        'total', v_total,
        'drop_km', v_drop_km,
        'in_range', v_in_range
      )
    end,
    'active_order', v_order,
    'open_ticket', v_ticket,
    'taste', v_taste
  );
end;
$$;

revoke all on function public.rio_snapshot(uuid) from public, anon;
grant execute on function public.rio_snapshot(uuid) to authenticated;

comment on function public.rio_snapshot(uuid) is
  'Live RIO context: customer, durable memory prefs, address, cart, active order, ticket, taste.';
