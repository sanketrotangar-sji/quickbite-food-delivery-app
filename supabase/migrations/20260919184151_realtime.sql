alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_status_history;
alter publication supabase_realtime add table public.rider_locations;

-- REPLICA IDENTITY FULL makes Postgres include the full OLD row in the
-- change event. Without it you only get the primary key for the old
-- values, and server-side filters on non-PK columns behave oddly.
-- The cost is a slightly larger WAL, which is fine at this scale.
alter table public.orders          replica identity full;
alter table public.rider_locations replica identity full;

