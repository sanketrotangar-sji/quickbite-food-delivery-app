-- Platform admin can read every order and manage the home catalog.

drop policy if exists "orders: admin reads all" on public.orders;
create policy "orders: admin reads all"
  on public.orders for select to authenticated
  using ( private.has_role('admin') );

drop policy if exists "home_highlights: admin reads all" on public.home_highlights;
create policy "home_highlights: admin reads all"
  on public.home_highlights for select to authenticated
  using ( private.has_role('admin') );

drop policy if exists "home_highlights: admin inserts" on public.home_highlights;
create policy "home_highlights: admin inserts"
  on public.home_highlights for insert to authenticated
  with check ( private.has_role('admin') );

drop policy if exists "home_highlights: admin updates" on public.home_highlights;
create policy "home_highlights: admin updates"
  on public.home_highlights for update to authenticated
  using ( private.has_role('admin') )
  with check ( private.has_role('admin') );

drop policy if exists "home_highlights: admin deletes" on public.home_highlights;
create policy "home_highlights: admin deletes"
  on public.home_highlights for delete to authenticated
  using ( private.has_role('admin') );

grant insert, update, delete on public.home_highlights to authenticated;
