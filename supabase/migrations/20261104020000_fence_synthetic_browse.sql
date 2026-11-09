-- P1: hide synthetic kitchens from product browse. Eval corpus rows stay in tables.

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
from public.restaurants
where coalesce(is_synthetic, false) = false;

grant select on public.restaurant_browse to authenticated;

comment on view public.restaurant_browse is
  'Customer-safe restaurant catalog. Excludes is_synthetic eval/demo kitchens.';

-- CRM segments: ignore delivered orders against synthetic kitchens.
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
  left join public.orders o
    on o.customer_id = p.id
   and exists (
     select 1
       from public.restaurants r
      where r.id = o.restaurant_id
        and coalesce(r.is_synthetic, false) = false
   )
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
  'A3-T2 customer segments (excludes orders at is_synthetic kitchens): frequent (≥3 delivered/60d), churned (idle ≥45d), new (≤1 delivered), else active.';
