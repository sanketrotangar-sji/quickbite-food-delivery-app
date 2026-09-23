-- Kitchen open/closed and menu availability need to reach the customer app
-- without a manual refresh. Orders were already in the publication.
alter publication supabase_realtime add table public.restaurants;
alter publication supabase_realtime add table public.menu_items;

alter table public.restaurants replica identity full;
alter table public.menu_items replica identity full;
