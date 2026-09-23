-- Table access for the API roles (RLS still filters rows)
grant usage on schema public to anon, authenticated;

grant select on public.profiles             to authenticated;
grant select on public.restaurants          to authenticated;
grant select on public.menu_items           to authenticated;
grant select on public.orders               to authenticated;
grant select on public.order_items          to authenticated;
grant select, insert, update, delete on public.cart_items to authenticated;
grant select on public.order_status_history to authenticated;
grant select, insert on public.ratings      to authenticated;
grant select, insert, update, delete on public.rider_locations to authenticated;

-- Re-apply column-level profile guard (needs UPDATE privilege first)
revoke update on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;