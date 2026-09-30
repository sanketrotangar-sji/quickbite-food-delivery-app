-- H1: riders no longer SELECT full unclaimed order rows (PII).
-- Pool is exposed via a redacted SECURITY DEFINER RPC instead.

drop policy if exists "orders: rider reads own and the unclaimed pool" on public.orders;

create policy "orders: rider reads assigned"
  on public.orders for select to authenticated
  using (
    private.has_role('rider')
    and rider_id = (select auth.uid())
  );

create or replace function public.list_rider_delivery_pool()
returns table (
  id uuid,
  status public.order_status,
  total_amount numeric,
  placed_at timestamptz,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_address text,
  cuisine text,
  image_url text,
  restaurant_lat numeric,
  restaurant_lng numeric,
  items_summary text,
  item_count integer,
  rider_earning numeric,
  tip_amount numeric,
  bonus_amount numeric,
  pickup_km numeric,
  drop_km numeric,
  eta_minutes integer,
  area_hint text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rider uuid := (select auth.uid());
begin
  if v_rider is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can browse the delivery pool.' using errcode = '42501';
  end if;

  return query
  select
    o.id,
    o.status,
    o.total_amount,
    o.placed_at,
    o.restaurant_id,
    coalesce(r.name, 'Kitchen')::text,
    coalesce(r.address, '')::text,
    coalesce(nullif(trim(r.description), ''), nullif(trim(r.cuisine), ''), 'Kitchen')::text,
    r.image_url,
    r.lat,
    r.lng,
    coalesce(
      (
        select string_agg(oi.quantity::text || '× ' || oi.item_name, ', ' order by oi.item_name)
        from public.order_items oi
        where oi.order_id = o.id
      ),
      'No items listed'
    )::text,
    coalesce(
      (
        select sum(oi.quantity)::integer
        from public.order_items oi
        where oi.order_id = o.id
      ),
      0
    ),
    o.rider_earning,
    o.tip_amount,
    o.bonus_amount,
    o.pickup_km,
    o.drop_km,
    o.eta_minutes,
    -- Area hint only — never full delivery_address / lat / lng / notes for unclaimed.
    case
      when o.delivery_address is null then null
      else split_part(o.delivery_address, ',', array_length(string_to_array(o.delivery_address, ','), 1))
    end::text
  from public.orders o
  left join public.restaurants r on r.id = o.restaurant_id
  where o.rider_id is null
    and o.status in ('preparing', 'ready')
    and o.customer_id is distinct from v_rider
  order by o.placed_at desc;
end;
$$;

revoke all on function public.list_rider_delivery_pool() from public;
grant execute on function public.list_rider_delivery_pool() to authenticated;
