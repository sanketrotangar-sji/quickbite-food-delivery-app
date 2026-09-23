-- Restaurants: stop letting every login read owner_id and phone.
-- Old: "restaurants: everyone reads" using (true).
-- New: full rows only for staff of that restaurant or an admin.
-- Public browse (including closed kitchens) is restaurant_browse, which
-- omits owner_id and phone. Closed rows stay so the customer home can
-- still grey them out.

drop policy if exists "restaurants: everyone reads" on public.restaurants;

drop policy if exists "restaurants: staff or admin reads" on public.restaurants;
create policy "restaurants: staff or admin reads"
  on public.restaurants for select to authenticated
  using (
    private.manages_restaurant(id)
    or private.has_role('admin')
  );

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
  created_at,
  updated_at
from public.restaurants;

grant select on public.restaurant_browse to authenticated;
