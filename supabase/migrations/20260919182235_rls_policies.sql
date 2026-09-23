-- ============================================================
-- 04_rls_policies.sql
-- ============================================================

-- ------------------------------------------------------------
-- profiles
-- ------------------------------------------------------------
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using ( (select auth.uid()) = id );

-- Lets the three parties on an order see each other's contact details.
create policy "profiles: read order counterparties"
  on public.profiles for select to authenticated
  using ( private.shares_order_with(id) );

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using      ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );

-- No insert policy: rows only come from the on_auth_user_created trigger.
-- No delete policy: deleting the auth user cascades.

-- ------------------------------------------------------------
-- restaurants
-- ------------------------------------------------------------
-- Customers browse ALL restaurants, open and closed. Closed ones render
-- with a badge and a disabled Add to Cart; place_order re-checks anyway.
create policy "restaurants: everyone reads"
  on public.restaurants for select to authenticated
  using ( true );

create policy "restaurants: manager creates own"
  on public.restaurants for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select private.current_role()) = 'restaurant_manager'
  );

create policy "restaurants: manager updates own"
  on public.restaurants for update to authenticated
  using      ( owner_id = (select auth.uid()) )
  with check ( owner_id = (select auth.uid()) );

create policy "restaurants: manager deletes own"
  on public.restaurants for delete to authenticated
  using ( owner_id = (select auth.uid()) );

-- ------------------------------------------------------------
-- menu_items
-- ------------------------------------------------------------
create policy "menu_items: everyone reads"
  on public.menu_items for select to authenticated
  using ( true );

-- `for all` covers insert/update/delete. It's OR'd with the select policy
-- above, so customers keep read access.
create policy "menu_items: owner writes"
  on public.menu_items for all to authenticated
  using      ( restaurant_id = (select private.my_restaurant_id()) )
  with check ( restaurant_id = (select private.my_restaurant_id()) );

-- ------------------------------------------------------------
-- orders  (SELECT only — all writes go through RPCs)
-- ------------------------------------------------------------
create policy "orders: customer reads own"
  on public.orders for select to authenticated
  using ( customer_id = (select auth.uid()) );

create policy "orders: restaurant reads own"
  on public.orders for select to authenticated
  using ( restaurant_id = (select private.my_restaurant_id()) );

-- A rider sees: their own claimed deliveries, PLUS the unclaimed pool.
-- The unclaimed pool opens at 'preparing' so a rider can be lined up
-- while the food is still being cooked, and wait for 'ready' to pick up.
create policy "orders: rider reads own and the unclaimed pool"
  on public.orders for select to authenticated
  using (
    rider_id = (select auth.uid())
    or (
      (select private.current_role()) = 'rider'
      and rider_id is null
      and status in ('preparing', 'ready')
    )
  );

-- ------------------------------------------------------------
-- order_items
-- ------------------------------------------------------------
-- Elegant trick: this subquery on public.orders is itself subject to
-- orders' RLS. So this reads as "you can see the line items if and only
-- if you can see the parent order" — the three policies above are
-- inherited for free, and stay in sync automatically.
create policy "order_items: readable via parent order"
  on public.order_items for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_items.order_id)
  );

-- No write policies: rows are created only inside place_order().

-- ------------------------------------------------------------
-- cart_items
-- ------------------------------------------------------------
create policy "cart_items: owner does everything"
  on public.cart_items for all to authenticated
  using      ( customer_id = (select auth.uid()) )
  with check ( customer_id = (select auth.uid()) );

-- ------------------------------------------------------------
-- order_status_history
-- ------------------------------------------------------------
create policy "history: readable via parent order"
  on public.order_status_history for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_status_history.order_id)
  );

-- No insert policy. Rows come only from the trigger in Part 8, which is
-- security definer and therefore not bound by this.

-- ------------------------------------------------------------
-- ratings
-- ------------------------------------------------------------
create policy "ratings: everyone reads"
  on public.ratings for select to authenticated
  using ( true );

-- The WITH CHECK enforces "your order, and only once it's delivered".
-- The unique(order_id) constraint enforces "only once".
create policy "ratings: customer rates own delivered order"
  on public.ratings for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and exists (
      select 1 from public.orders o
      where o.id            = ratings.order_id
        and o.customer_id   = (select auth.uid())
        and o.restaurant_id = ratings.restaurant_id
        and o.status        = 'delivered'
    )
  );

-- Deliberately no update/delete: a rating is a permanent record.
-- If you want an edit window, add an update policy gated on
-- created_at > now() - interval '15 minutes'.

-- ------------------------------------------------------------
-- rider_locations
-- ------------------------------------------------------------
create policy "rider_locations: rider writes own"
  on public.rider_locations for all to authenticated
  using      ( rider_id = (select auth.uid()) )
  with check ( rider_id = (select auth.uid()) );

-- The customer sees the pin only while the food is actually moving.
-- Once delivered, this returns nothing and the map goes cold.
create policy "rider_locations: customer reads their active delivery"
  on public.rider_locations for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id          = rider_locations.order_id
        and o.customer_id = (select auth.uid())
        and o.status      = 'out_for_delivery'
    )
  );