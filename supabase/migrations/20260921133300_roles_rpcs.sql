-- ============================================================
-- Self-dealing guards + application / invite / branch RPCs.
-- ============================================================

-- ------------------------------------------------------------
-- list_my_restaurants()
-- ------------------------------------------------------------
create or replace function public.list_my_restaurants()
returns setof public.restaurants
language sql
stable
security definer
set search_path = ''
as $$
  select r.*
  from public.restaurants r
  where r.owner_id = (select auth.uid())
     or exists (
       select 1
       from public.restaurant_members m
       where m.restaurant_id = r.id
         and m.user_id = (select auth.uid())
         and m.status = 'active'
     );
$$;

-- ------------------------------------------------------------
-- place_order() — reject ordering from a kitchen you run
-- ------------------------------------------------------------
create or replace function public.place_order(
  p_delivery_address text,
  p_notes            text default null,
  p_delivery_lat     numeric default null,
  p_delivery_lng     numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer      uuid := (select auth.uid());
  v_restaurant    uuid;
  v_restaurant_ct integer;
  v_is_open       boolean;
  v_total         numeric(10,2);
  v_order_id      uuid;
begin
  if v_customer is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if coalesce(trim(p_delivery_address), '') = '' then
    raise exception 'A delivery address is required.' using errcode = '22023';
  end if;

  perform 1 from public.cart_items
   where customer_id = v_customer
   for update;

  select count(distinct restaurant_id) into v_restaurant_ct
  from public.cart_items where customer_id = v_customer;

  if v_restaurant_ct = 0 then
    raise exception 'CART_EMPTY' using
      message = 'Your cart is empty.', errcode = 'P0001';
  end if;

  if v_restaurant_ct > 1 then
    raise exception 'CART_MIXED' using
      message = 'Cart contains items from more than one restaurant.',
      errcode = 'P0001';
  end if;

  select restaurant_id into v_restaurant
  from public.cart_items where customer_id = v_customer limit 1;

  if private.manages_restaurant(v_restaurant) then
    raise exception 'SELF_ORDER' using
      message = 'You cannot order from a restaurant you manage.',
      errcode = 'P0001';
  end if;

  select is_open into v_is_open
  from public.restaurants where id = v_restaurant;

  if v_is_open is not true then
    raise exception 'RESTAURANT_CLOSED' using
      message = 'This restaurant is closed right now.', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.cart_items c
    join public.menu_items m on m.id = c.menu_item_id
    where c.customer_id = v_customer
      and (m.is_available is not true or m.restaurant_id <> v_restaurant)
  ) then
    raise exception 'ITEM_UNAVAILABLE' using
      message = 'One or more items are no longer available.',
      errcode = 'P0001';
  end if;

  select sum(c.quantity * m.price) into v_total
  from public.cart_items c
  join public.menu_items m on m.id = c.menu_item_id
  where c.customer_id = v_customer;

  insert into public.orders (
    customer_id, restaurant_id, status, total_amount,
    delivery_address, delivery_lat, delivery_lng, notes
  )
  values (
    v_customer, v_restaurant, 'placed', v_total,
    trim(p_delivery_address), p_delivery_lat, p_delivery_lng, p_notes
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
  select v_order_id, m.id, m.name, c.quantity, m.price
  from public.cart_items c
  join public.menu_items m on m.id = c.menu_item_id
  where c.customer_id = v_customer;

  delete from public.cart_items where customer_id = v_customer;

  return v_order_id;
end;
$$;

-- ------------------------------------------------------------
-- restaurant_set_order_status()
-- ------------------------------------------------------------
create or replace function public.restaurant_set_order_status(
  p_order_id uuid,
  p_status   public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
begin
  select * into v_row from public.orders where id = p_order_id;

  if v_row.id is null then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if not private.manages_restaurant(v_row.restaurant_id) then
    raise exception 'You do not manage this restaurant.' using errcode = '42501';
  end if;

  if v_row.customer_id = (select auth.uid()) then
    raise exception 'SELF_SERVICE' using
      message = 'You cannot kitchen-handle an order you placed.',
      errcode = 'P0001';
  end if;

  if p_status not in ('preparing', 'ready', 'cancelled') then
    raise exception 'A restaurant cannot set status %.', p_status
      using errcode = '22023';
  end if;

  update public.orders
     set status = p_status
   where id            = p_order_id
     and restaurant_id = v_row.restaurant_id
     and (
          (p_status = 'preparing' and status = 'placed')
       or (p_status = 'ready'     and status = 'preparing')
       or (p_status = 'cancelled' and status in ('placed', 'preparing'))
     )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVALID_TRANSITION' using
      message = 'That order is not in a state where this change is allowed.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- claim_delivery()
-- ------------------------------------------------------------
create or replace function public.claim_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
begin
  if not private.has_role('rider') then
    raise exception 'Only riders can claim deliveries.' using errcode = '42501';
  end if;

  select * into v_row from public.orders where id = p_order_id;

  if v_row.id is null then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if v_row.customer_id = (select auth.uid()) then
    raise exception 'SELF_DELIVERY' using
      message = 'You cannot deliver an order you placed.',
      errcode = 'P0001';
  end if;

  update public.orders
     set rider_id = (select auth.uid())
   where id       = p_order_id
     and rider_id is null
     and status in ('preparing', 'ready')
     and customer_id is distinct from (select auth.uid())
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ALREADY_CLAIMED' using
      message = 'Someone else already picked up this delivery.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- submit_application()
-- ------------------------------------------------------------
create or replace function public.submit_application(
  p_kind    public.application_kind,
  p_payload jsonb default '{}'::jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row  public.applications;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if p_kind = 'rider' and private.has_role('rider') then
    raise exception 'You are already a rider.' using errcode = 'P0001';
  end if;

  if p_kind = 'restaurant_owner' and private.has_role('restaurant_owner') then
    raise exception 'You already have a restaurant partner account.' using errcode = 'P0001';
  end if;

  if p_kind = 'restaurant_owner' then
    if coalesce(trim(p_payload ->> 'restaurant_name'), '') = ''
       or coalesce(trim(p_payload ->> 'address'), '') = '' then
      raise exception 'Restaurant name and address are required.' using errcode = '22023';
    end if;
  end if;

  insert into public.applications (applicant_id, kind, payload)
  values (v_user, p_kind, coalesce(p_payload, '{}'::jsonb))
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'You already have a pending application.' using errcode = 'P0001';
end;
$$;

-- ------------------------------------------------------------
-- admin_review_application()
-- ------------------------------------------------------------
create or replace function public.admin_review_application(
  p_application_id uuid,
  p_approve        boolean,
  p_note           text default null
)
returns public.applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row  public.applications;
  v_name text;
  v_addr text;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can review applications.' using errcode = '42501';
  end if;

  select * into v_row from public.applications where id = p_application_id for update;

  if v_row.id is null then
    raise exception 'Application not found.' using errcode = 'P0001';
  end if;

  if v_row.status is distinct from 'pending'::public.application_status then
    raise exception 'This application was already reviewed.' using errcode = 'P0001';
  end if;

  if p_approve then
    if v_row.kind = 'rider'::public.application_kind then
      perform private.grant_role(v_row.applicant_id, 'rider');
    elsif v_row.kind = 'restaurant_owner'::public.application_kind then
      v_name := trim(v_row.payload ->> 'restaurant_name');
      v_addr := trim(v_row.payload ->> 'address');
      if v_name = '' or v_addr = '' then
        raise exception 'Application is missing restaurant name or address.' using errcode = '22023';
      end if;
      perform private.grant_role(v_row.applicant_id, 'restaurant_owner');
      insert into public.restaurants (
        owner_id, name, address, phone, cuisine, description, branch_name
      )
      values (
        v_row.applicant_id,
        v_name,
        v_addr,
        nullif(trim(v_row.payload ->> 'phone'), ''),
        nullif(trim(v_row.payload ->> 'cuisine'), ''),
        nullif(trim(v_row.payload ->> 'description'), ''),
        nullif(trim(v_row.payload ->> 'branch_name'), '')
      );
    end if;
  end if;

  update public.applications
     set status      = (case when p_approve then 'approved' else 'rejected' end)::public.application_status,
         review_note = nullif(trim(p_note), ''),
         reviewed_by = (select auth.uid()),
         reviewed_at = now()
   where id = p_application_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- owner_create_branch()
-- ------------------------------------------------------------
create or replace function public.owner_create_branch(
  p_name        text,
  p_address     text,
  p_branch_name text default null,
  p_phone       text default null,
  p_cuisine     text default null,
  p_description text default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.restaurants;
begin
  if not private.has_role('restaurant_owner') then
    raise exception 'Only restaurant owners can add branches.' using errcode = '42501';
  end if;

  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_address), '') = '' then
    raise exception 'Name and address are required.' using errcode = '22023';
  end if;

  insert into public.restaurants (
    owner_id, name, address, branch_name, phone, cuisine, description
  )
  values (
    (select auth.uid()),
    trim(p_name),
    trim(p_address),
    nullif(trim(p_branch_name), ''),
    nullif(trim(p_phone), ''),
    nullif(trim(p_cuisine), ''),
    nullif(trim(p_description), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- owner_invite_manager()
-- ------------------------------------------------------------
create or replace function public.owner_invite_manager(
  p_restaurant_id uuid,
  p_email         text
)
returns public.manager_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_row   public.manager_invites;
begin
  if not private.owns_restaurant(p_restaurant_id) then
    raise exception 'Only the restaurant owner can invite managers.' using errcode = '42501';
  end if;

  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid email is required.' using errcode = '22023';
  end if;

  if v_email = lower((select email from public.profiles where id = (select auth.uid()))) then
    raise exception 'You cannot invite yourself.' using errcode = 'P0001';
  end if;

  insert into public.manager_invites (restaurant_id, email, invited_by)
  values (p_restaurant_id, v_email, (select auth.uid()))
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'That email already has a pending invite for this branch.' using errcode = 'P0001';
end;
$$;

-- ------------------------------------------------------------
-- accept_manager_invite()
-- ------------------------------------------------------------
create or replace function public.accept_manager_invite(p_invite_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
  v_inv   public.manager_invites;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select email into v_email from public.profiles where id = v_user;

  for v_inv in
    select *
    from public.manager_invites
    where status = 'pending'
      and email = lower(v_email)
      and (p_invite_id is null or id = p_invite_id)
    for update
  loop
    insert into public.restaurant_members (restaurant_id, user_id, status)
    values (v_inv.restaurant_id, v_user, 'active')
    on conflict (restaurant_id, user_id) do update
      set status = 'active';

    perform private.grant_role(v_user, 'restaurant_manager');

    update public.manager_invites
       set status = 'accepted', accepted_at = now()
     where id = v_inv.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- owner_revoke_manager()
-- ------------------------------------------------------------
create or replace function public.owner_revoke_manager(
  p_restaurant_id uuid,
  p_user_id       uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.owns_restaurant(p_restaurant_id) then
    raise exception 'Only the restaurant owner can remove managers.' using errcode = '42501';
  end if;

  update public.restaurant_members
     set status = 'revoked'
   where restaurant_id = p_restaurant_id
     and user_id = p_user_id
     and status = 'active';

  if not found then
    raise exception 'That person is not an active manager of this branch.' using errcode = 'P0001';
  end if;

  update public.manager_invites
     set status = 'revoked'
   where restaurant_id = p_restaurant_id
     and email = lower((select email from public.profiles where id = p_user_id))
     and status = 'pending';

  perform private.revoke_manager_role_if_unused(p_user_id);
end;
$$;

revoke execute on function public.list_my_restaurants() from public, anon;
revoke execute on function public.submit_application(public.application_kind, jsonb) from public, anon;
revoke execute on function public.admin_review_application(uuid, boolean, text) from public, anon;
revoke execute on function public.owner_create_branch(text, text, text, text, text, text) from public, anon;
revoke execute on function public.owner_invite_manager(uuid, text) from public, anon;
revoke execute on function public.accept_manager_invite(uuid) from public, anon;
revoke execute on function public.owner_revoke_manager(uuid, uuid) from public, anon;

grant execute on function public.list_my_restaurants() to authenticated;
grant execute on function public.submit_application(public.application_kind, jsonb) to authenticated;
grant execute on function public.admin_review_application(uuid, boolean, text) to authenticated;
grant execute on function public.owner_create_branch(text, text, text, text, text, text) to authenticated;
grant execute on function public.owner_invite_manager(uuid, text) to authenticated;
grant execute on function public.accept_manager_invite(uuid) to authenticated;
grant execute on function public.owner_revoke_manager(uuid, uuid) to authenticated;
