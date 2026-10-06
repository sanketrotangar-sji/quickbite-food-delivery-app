-- Admin can open/close kitchens and read profiles for platform tools.

drop policy if exists "restaurants: admin updates" on public.restaurants;
create policy "restaurants: admin updates"
  on public.restaurants for update to authenticated
  using ( private.has_role('admin') )
  with check ( private.has_role('admin') );
