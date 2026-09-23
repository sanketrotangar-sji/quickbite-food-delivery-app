-- Manager writes need table GRANTs in addition to RLS.
-- 20260919193521 only granted SELECT on restaurants / menu_items.

grant insert, update, delete on public.restaurants to authenticated;
grant insert, update, delete on public.menu_items to authenticated;

alter table public.menu_items
  add column if not exists category text;

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;
