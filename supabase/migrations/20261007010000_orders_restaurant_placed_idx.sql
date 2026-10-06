-- P3: Kitchen/history lists filter by restaurant_id + order placed_at.
-- FKs already exist: orders.delivery_address_id → customer_addresses,
-- home_highlights.restaurant_id → restaurants (see earlier migrations).
--
-- Rollback:
--   drop index if exists public.orders_restaurant_placed_idx;

create index if not exists orders_restaurant_placed_idx
  on public.orders (restaurant_id, placed_at desc);

comment on index public.orders_restaurant_placed_idx is
  'Manager kitchen/history: list orders by restaurant ordered by placed_at.';
