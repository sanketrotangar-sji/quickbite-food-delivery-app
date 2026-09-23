-- Ratings: stop exposing customer, rider, comment, and delivery score to every login.
-- Old: "ratings: everyone reads" using (true).
-- New: a full row is visible to the customer who wrote it, staff of that
-- restaurant, the rider on that rating, or an admin.
-- Home averages only need restaurant_id and food_rating, via restaurant_rating_public.
-- The insert policy is unchanged.

drop policy if exists "ratings: everyone reads" on public.ratings;

drop policy if exists "ratings: parties read" on public.ratings;
create policy "ratings: parties read"
  on public.ratings for select to authenticated
  using (
    customer_id = (select auth.uid())
    or private.manages_restaurant(restaurant_id)
    or rider_id = (select auth.uid())
    or private.has_role('admin')
  );

create or replace view public.restaurant_rating_public
with (security_invoker = false, security_barrier = true) as
select
  restaurant_id,
  food_rating
from public.ratings;

grant select on public.restaurant_rating_public to authenticated;
