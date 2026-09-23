-- ============================================================
-- RLS for new tables + rewrite restaurant/order/storage policies
-- for multi-branch managers and self-dealing.
-- ============================================================

-- ---------- user_roles (read own / admin; writes only via definer RPCs) ----------
drop policy if exists "user_roles: read own" on public.user_roles;
create policy "user_roles: read own"
  on public.user_roles for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists "user_roles: admin reads all" on public.user_roles;
create policy "user_roles: admin reads all"
  on public.user_roles for select to authenticated
  using ( private.has_role('admin') );

-- ---------- applications ----------
drop policy if exists "applications: read own" on public.applications;
create policy "applications: read own"
  on public.applications for select to authenticated
  using ( applicant_id = (select auth.uid()) );

drop policy if exists "applications: admin reads all" on public.applications;
create policy "applications: admin reads all"
  on public.applications for select to authenticated
  using ( private.has_role('admin') );

-- ---------- restaurant_members ----------
drop policy if exists "restaurant_members: read self or owner" on public.restaurant_members;
create policy "restaurant_members: read self or owner"
  on public.restaurant_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.owns_restaurant(restaurant_id)
    or private.has_role('admin')
  );

-- ---------- manager_invites ----------
drop policy if exists "manager_invites: owner or invitee" on public.manager_invites;
create policy "manager_invites: owner or invitee"
  on public.manager_invites for select to authenticated
  using (
    private.owns_restaurant(restaurant_id)
    or email = lower((select email from public.profiles where id = (select auth.uid())))
    or private.has_role('admin')
  );

-- ---------- profiles: admin ----------
drop policy if exists "profiles: admin reads all" on public.profiles;
create policy "profiles: admin reads all"
  on public.profiles for select to authenticated
  using ( private.has_role('admin') );

drop policy if exists "profiles: owner reads staff" on public.profiles;
create policy "profiles: owner reads staff"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.restaurant_members m
      join public.restaurants r on r.id = m.restaurant_id
      where m.user_id = profiles.id
        and r.owner_id = (select auth.uid())
    )
  );

-- ---------- restaurants write ----------
drop policy if exists "restaurants: manager creates own" on public.restaurants;
drop policy if exists "restaurants: manager updates own" on public.restaurants;
drop policy if exists "restaurants: manager deletes own" on public.restaurants;
drop policy if exists "restaurants: owner creates" on public.restaurants;
drop policy if exists "restaurants: staff updates managed" on public.restaurants;
drop policy if exists "restaurants: owner deletes" on public.restaurants;

create policy "restaurants: owner creates"
  on public.restaurants for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and private.has_role('restaurant_owner')
  );

create policy "restaurants: staff updates managed"
  on public.restaurants for update to authenticated
  using      ( private.manages_restaurant(id) )
  with check ( private.manages_restaurant(id) );

create policy "restaurants: owner deletes"
  on public.restaurants for delete to authenticated
  using ( private.owns_restaurant(id) );

-- ---------- menu_items ----------
drop policy if exists "menu_items: owner writes" on public.menu_items;
drop policy if exists "menu_items: staff writes" on public.menu_items;
create policy "menu_items: staff writes"
  on public.menu_items for all to authenticated
  using      ( private.manages_restaurant(restaurant_id) )
  with check ( private.manages_restaurant(restaurant_id) );

-- ---------- orders: restaurant reads ----------
drop policy if exists "orders: restaurant reads own" on public.orders;
drop policy if exists "orders: staff reads managed" on public.orders;
create policy "orders: staff reads managed"
  on public.orders for select to authenticated
  using ( private.manages_restaurant(restaurant_id) );

drop policy if exists "orders: rider reads own and the unclaimed pool" on public.orders;
create policy "orders: rider reads own and the unclaimed pool"
  on public.orders for select to authenticated
  using (
    rider_id = (select auth.uid())
    or (
      private.has_role('rider')
      and rider_id is null
      and status in ('preparing', 'ready')
    )
  );

-- ---------- ratings: cannot rate a kitchen you run ----------
drop policy if exists "ratings: customer rates own delivered order" on public.ratings;
create policy "ratings: customer rates own delivered order"
  on public.ratings for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and not private.manages_restaurant(restaurant_id)
    and exists (
      select 1 from public.orders o
      where o.id            = ratings.order_id
        and o.customer_id   = (select auth.uid())
        and o.restaurant_id = ratings.restaurant_id
        and o.status        = 'delivered'
        and o.customer_id is distinct from o.rider_id
    )
  );

-- ---------- storage: any managed restaurant folder ----------
drop policy if exists "menu images: manager uploads to own folder" on storage.objects;
drop policy if exists "menu images: manager updates own folder" on storage.objects;
drop policy if exists "menu images: manager deletes own folder" on storage.objects;

create policy "menu images: manager uploads to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-images'
    and private.manages_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy "menu images: manager updates own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-images'
    and private.manages_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy "menu images: manager deletes own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-images'
    and private.manages_restaurant(((storage.foldername(name))[1])::uuid)
  );
