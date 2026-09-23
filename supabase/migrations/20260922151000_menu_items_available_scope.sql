-- Menu items: hide paused dishes from everyone except that restaurant's staff and admins.
-- Old: "menu_items: everyone reads" using (true).
-- New: available dishes stay public. Unavailable dishes are staff/admin only.
-- The staff write policy is unchanged.

drop policy if exists "menu_items: everyone reads" on public.menu_items;

drop policy if exists "menu_items: available or staff reads" on public.menu_items;
create policy "menu_items: available or staff reads"
  on public.menu_items for select to authenticated
  using (
    is_available = true
    or private.manages_restaurant(restaurant_id)
    or private.has_role('admin')
  );
