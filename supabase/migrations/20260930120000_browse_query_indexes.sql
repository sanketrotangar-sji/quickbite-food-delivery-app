-- Browse/filter helpers for home catalog and kitchen menus.
create index if not exists menu_items_restaurant_available_idx
  on public.menu_items (restaurant_id, is_available);

create index if not exists restaurants_cuisine_idx
  on public.restaurants (cuisine);

-- Ops note: prefer Supabase project region Mumbai (ap-south-1) for IN latency.
