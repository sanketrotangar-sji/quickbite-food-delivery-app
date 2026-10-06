-- Aggregated public ratings for home/browse (avoids pulling every ratings row).
-- Rollback: drop view public.restaurant_rating_summary;

create or replace view public.restaurant_rating_summary
with (security_invoker = false, security_barrier = true) as
select
  restaurant_id,
  avg(food_rating)::float8 as avg_food,
  count(*)::int as rating_count
from public.ratings
group by restaurant_id;

grant select on public.restaurant_rating_summary to authenticated;

comment on view public.restaurant_rating_summary is
  'Per-restaurant average food rating for home catalog / browse cards.';
