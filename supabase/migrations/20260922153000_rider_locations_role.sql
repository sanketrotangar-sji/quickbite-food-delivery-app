-- Rider locations: writing a pin requires the rider role, not just a matching id.
-- Old: "rider_locations: rider writes own" for all using rider_id = auth.uid().
-- New: same ownership check, plus private.has_role('rider').
-- "rider_locations: customer reads their active delivery" is unchanged.

drop policy if exists "rider_locations: rider writes own" on public.rider_locations;

create policy "rider_locations: rider writes own"
  on public.rider_locations for all to authenticated
  using (
    rider_id = (select auth.uid())
    and private.has_role('rider')
  )
  with check (
    rider_id = (select auth.uid())
    and private.has_role('rider')
  );
