-- QuickBite demo seed (P8) — local `supabase db reset` only.
-- Identifiable by email domain @quickbite.demo and order notes [SEED_DEMO].
-- Password for every demo user: sanket123
--
-- DO NOT run against a shared cloud project until wipe plan P7 is approved.
-- Remove: delete from auth.users where email like '%@quickbite.demo';

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Wipe previous demo (cascade profiles → dependent rows)
-- ---------------------------------------------------------------------------
delete from auth.users
where email like '%@quickbite.demo';

-- ---------------------------------------------------------------------------
-- Fixed ids
-- ---------------------------------------------------------------------------
-- users
--   admin    a1000000-0000-4000-8000-000000000001  admin@quickbite.demo
--   owner    a1000000-0000-4000-8000-000000000002  owner@quickbite.demo
--   manager  a1000000-0000-4000-8000-000000000003  manager@quickbite.demo
--   rider    a1000000-0000-4000-8000-000000000004  rider@quickbite.demo
--   cust1    a1000000-0000-4000-8000-000000000005  customer1@quickbite.demo
--   cust2    a1000000-0000-4000-8000-000000000006  customer2@quickbite.demo
--   cust3    a1000000-0000-4000-8000-000000000007  customer3@quickbite.demo
-- kitchens
--   spice    b1000000-0000-4000-8000-000000000001
--   udupi    b1000000-0000-4000-8000-000000000002
--   pizza    b1000000-0000-4000-8000-000000000003
--   bowl     b1000000-0000-4000-8000-000000000004

do $$
declare
  v_pwd text := extensions.crypt('sanket123', extensions.gen_salt('bf'));
  r record;
begin
  for r in
    select *
    from (
      values
        ('a1000000-0000-4000-8000-000000000001'::uuid, 'admin@quickbite.demo', 'Seed Admin'),
        ('a1000000-0000-4000-8000-000000000002'::uuid, 'owner@quickbite.demo', 'Seed Owner'),
        ('a1000000-0000-4000-8000-000000000003'::uuid, 'manager@quickbite.demo', 'Seed Manager'),
        ('a1000000-0000-4000-8000-000000000004'::uuid, 'rider@quickbite.demo', 'Seed Rider'),
        ('a1000000-0000-4000-8000-000000000005'::uuid, 'customer1@quickbite.demo', 'Seed Customer One'),
        ('a1000000-0000-4000-8000-000000000006'::uuid, 'customer2@quickbite.demo', 'Seed Customer Two'),
        ('a1000000-0000-4000-8000-000000000007'::uuid, 'customer3@quickbite.demo', 'Seed Customer Three')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      r.id,
      'authenticated',
      'authenticated',
      r.email,
      v_pwd,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      r.id,
      r.id,
      jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      'email',
      r.id::text,
      now(),
      now(),
      now()
    );
  end loop;
end
$$;

-- Roles (handle_new_user already created customer profiles)
select private.grant_role('a1000000-0000-4000-8000-000000000001', 'admin'::public.app_role);
select private.grant_role('a1000000-0000-4000-8000-000000000002', 'restaurant_owner'::public.app_role);
select private.grant_role('a1000000-0000-4000-8000-000000000003', 'restaurant_manager'::public.app_role);
select private.grant_role('a1000000-0000-4000-8000-000000000004', 'rider'::public.app_role);

update public.profiles
set is_online = true,
    vehicle_label = 'Demo Bike',
    plate = 'MH-12-SEED'
where id = 'a1000000-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------------------
-- Restaurants (owner owns all four; manager hired on first)
-- ---------------------------------------------------------------------------
insert into public.restaurants (
  id, owner_id, name, description, cuisine, address, phone, image_url,
  is_open, branch_name, lat, lng, offer_percent, prep_minutes
) values
  (
    'b1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000002',
    'Seed Spice Villa',
    'North Indian comfort food for demo screens',
    'North Indian',
    '12 Demo Lane, Pune',
    '9000000001',
    null,
    true,
    'Koregaon Park',
    18.536200,
    73.893900,
    10,
    25
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000002',
    'Seed Udupi Garden',
    'South Indian vegetarian classics',
    'South Indian',
    '44 Seed Road, Pune',
    '9000000002',
    null,
    true,
    'FC Road',
    18.520400,
    73.856700,
    15,
    20
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000002',
    'Seed Pizza Deck',
    'Wood-fired pizza and pasta',
    'Italian',
    '9 Oven Street, Pune',
    '9000000003',
    null,
    true,
    'Baner',
    18.559000,
    73.786800,
    null,
    30
  ),
  (
    'b1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000002',
    'Seed Green Bowl',
    'Salads and light bowls (often closed for UI demos)',
    'Healthy',
    '3 Leaf Avenue, Pune',
    '9000000004',
    null,
    false,
    'Kothrud',
    18.507400,
    73.807700,
    5,
    18
  );

insert into public.restaurant_members (restaurant_id, user_id, status)
values (
  'b1000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000003',
  'active'
);

-- ---------------------------------------------------------------------------
-- Menu items (10 per open kitchen + a few on closed bowl)
-- ---------------------------------------------------------------------------
insert into public.menu_items (
  id, restaurant_id, name, description, price, is_available, category, is_veg
)
select *
from (
  values
    -- Spice Villa
    ('c1000000-0000-4000-8000-000000000101'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Butter Chicken', 'Creamy tomato gravy', 280.00, true, 'Mains', false),
    ('c1000000-0000-4000-8000-000000000102'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Paneer Tikka', 'Charcoal paneer', 220.00, true, 'Starters', true),
    ('c1000000-0000-4000-8000-000000000103'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Dal Makhani', 'Slow cooked black lentils', 180.00, true, 'Mains', true),
    ('c1000000-0000-4000-8000-000000000104'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Garlic Naan', 'Butter garlic flatbread', 60.00, true, 'Breads', true),
    ('c1000000-0000-4000-8000-000000000105'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Chicken Biryani', 'Dum cooked', 260.00, true, 'Rice', false),
    ('c1000000-0000-4000-8000-000000000106'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Veg Biryani', 'Fragrant basmati', 200.00, true, 'Rice', true),
    ('c1000000-0000-4000-8000-000000000107'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Gulab Jamun', 'Two pieces', 90.00, true, 'Dessert', true),
    ('c1000000-0000-4000-8000-000000000108'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Masala Chai', 'Spiced tea', 40.00, true, 'Drinks', true),
    ('c1000000-0000-4000-8000-000000000109'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Tandoori Chicken', 'Half portion', 320.00, true, 'Starters', false),
    ('c1000000-0000-4000-8000-000000000110'::uuid, 'b1000000-0000-4000-8000-000000000001'::uuid, 'Jeera Rice', 'Cumin rice', 120.00, false, 'Rice', true),
    -- Udupi
    ('c1000000-0000-4000-8000-000000000201'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Masala Dosa', 'Potato filling', 120.00, true, 'Dosa', true),
    ('c1000000-0000-4000-8000-000000000202'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Idli Sambar', 'Soft idli', 80.00, true, 'Breakfast', true),
    ('c1000000-0000-4000-8000-000000000203'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Medu Vada', 'Crispy lentil', 70.00, true, 'Breakfast', true),
    ('c1000000-0000-4000-8000-000000000204'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Rava Dosa', 'Crisp semolina', 130.00, true, 'Dosa', true),
    ('c1000000-0000-4000-8000-000000000205'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Filter Coffee', 'South filter', 50.00, true, 'Drinks', true),
    ('c1000000-0000-4000-8000-000000000206'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Onion Uttapam', 'Thick dosa', 110.00, true, 'Dosa', true),
    ('c1000000-0000-4000-8000-000000000207'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Lemon Rice', 'Tangy rice', 100.00, true, 'Rice', true),
    ('c1000000-0000-4000-8000-000000000208'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Curd Rice', 'Cooling', 90.00, true, 'Rice', true),
    ('c1000000-0000-4000-8000-000000000209'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Mysore Pak', 'Sweet', 85.00, true, 'Dessert', true),
    ('c1000000-0000-4000-8000-000000000210'::uuid, 'b1000000-0000-4000-8000-000000000002'::uuid, 'Ghee Roast Dosa', 'Rich dosa', 150.00, true, 'Dosa', true),
    -- Pizza
    ('c1000000-0000-4000-8000-000000000301'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Margherita', 'Classic cheese', 249.00, true, 'Pizza', true),
    ('c1000000-0000-4000-8000-000000000302'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Pepperoni', 'Spicy salami', 329.00, true, 'Pizza', false),
    ('c1000000-0000-4000-8000-000000000303'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Farmhouse', 'Veg loaded', 299.00, true, 'Pizza', true),
    ('c1000000-0000-4000-8000-000000000304'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Garlic Bread', 'Cheesy', 149.00, true, 'Sides', true),
    ('c1000000-0000-4000-8000-000000000305'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Penne Arrabiata', 'Spicy pasta', 279.00, true, 'Pasta', true),
    ('c1000000-0000-4000-8000-000000000306'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Chicken Alfredo', 'Cream pasta', 319.00, true, 'Pasta', false),
    ('c1000000-0000-4000-8000-000000000307'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Tiramisu Cup', 'Dessert', 159.00, true, 'Dessert', true),
    ('c1000000-0000-4000-8000-000000000308'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Iced Tea', 'Lemon', 99.00, true, 'Drinks', true),
    ('c1000000-0000-4000-8000-000000000309'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'BBQ Chicken Pizza', 'Smoky', 349.00, true, 'Pizza', false),
    ('c1000000-0000-4000-8000-000000000310'::uuid, 'b1000000-0000-4000-8000-000000000003'::uuid, 'Veggie Supreme', 'Garden toppings', 309.00, false, 'Pizza', true),
    -- Green Bowl (closed kitchen)
    ('c1000000-0000-4000-8000-000000000401'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Quinoa Bowl', 'Light bowl', 220.00, true, 'Bowls', true),
    ('c1000000-0000-4000-8000-000000000402'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Greek Salad', 'Feta salad', 190.00, true, 'Salads', true),
    ('c1000000-0000-4000-8000-000000000403'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Detox Juice', 'Green juice', 120.00, true, 'Drinks', true),
    ('c1000000-0000-4000-8000-000000000404'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Avocado Toast', 'Sourdough', 210.00, true, 'Mains', true),
    ('c1000000-0000-4000-8000-000000000405'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Hummus Plate', 'With pita', 160.00, true, 'Starters', true),
    ('c1000000-0000-4000-8000-000000000406'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Berry Smoothie', 'Mixed berry', 140.00, true, 'Drinks', true),
    ('c1000000-0000-4000-8000-000000000407'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Caesar Salad', 'Classic', 200.00, true, 'Salads', false),
    ('c1000000-0000-4000-8000-000000000408'::uuid, 'b1000000-0000-4000-8000-000000000004'::uuid, 'Protein Bowl', 'Chicken', 250.00, true, 'Bowls', false)
) as m(id, restaurant_id, name, description, price, is_available, category, is_veg);

-- ---------------------------------------------------------------------------
-- Addresses + cart
-- ---------------------------------------------------------------------------
insert into public.customer_addresses (
  id, customer_id, label, nickname, address_line, area, landmark, lat, lng, is_default
) values
  (
    'd1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000005',
    'home',
    'Home',
    '101 Seed Residency',
    'Koregaon Park',
    'Near demo park',
    18.536500,
    73.894200,
    true
  ),
  (
    'd1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000006',
    'work',
    'Office',
    '22 Tech Park',
    'Hinjewadi',
    'Gate 2',
    18.591200,
    73.738900,
    true
  );

insert into public.cart_items (customer_id, restaurant_id, menu_item_id, quantity)
values
  (
    'a1000000-0000-4000-8000-000000000007',
    'b1000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000201',
    2
  );

-- ---------------------------------------------------------------------------
-- Orders: insert as placed, then walk to final status (history via trigger)
-- ---------------------------------------------------------------------------
insert into public.orders (
  id, customer_id, restaurant_id, rider_id, status, total_amount, delivery_fee,
  delivery_address, delivery_lat, delivery_lng, notes, placed_at, delivered_at
) values
  (
    'e1000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000001',
    null,
    'placed',
    340.00,
    40.00,
    '101 Seed Residency, Koregaon Park',
    18.536500,
    73.894200,
    '[SEED_DEMO] placed — kitchen pending',
    now() - interval '5 minutes',
    null
  ),
  (
    'e1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000001',
    null,
    'placed',
    400.00,
    40.00,
    '101 Seed Residency, Koregaon Park',
    18.536500,
    73.894200,
    '[SEED_DEMO] preparing',
    now() - interval '20 minutes',
    null
  ),
  (
    'e1000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000002',
    null,
    'placed',
    200.00,
    40.00,
    '22 Tech Park, Hinjewadi',
    18.591200,
    73.738900,
    '[SEED_DEMO] ready — unclaimed pool',
    now() - interval '35 minutes',
    null
  ),
  (
    'e1000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000006',
    'b1000000-0000-4000-8000-000000000003',
    null,
    'placed',
    428.00,
    40.00,
    '22 Tech Park, Hinjewadi',
    18.591200,
    73.738900,
    '[SEED_DEMO] out_for_delivery',
    now() - interval '50 minutes',
    null
  ),
  (
    'e1000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000005',
    'b1000000-0000-4000-8000-000000000002',
    null,
    'placed',
    200.00,
    40.00,
    '101 Seed Residency, Koregaon Park',
    18.536500,
    73.894200,
    '[SEED_DEMO] delivered',
    now() - interval '2 hours',
    null
  ),
  (
    'e1000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000007',
    'b1000000-0000-4000-8000-000000000003',
    null,
    'placed',
    289.00,
    40.00,
    '55 Cancel Street, Pune',
    18.520000,
    73.850000,
    '[SEED_DEMO] cancelled',
    now() - interval '3 hours',
    null
  );

update public.orders set status = 'preparing' where id = 'e1000000-0000-4000-8000-000000000002';

update public.orders set status = 'preparing' where id = 'e1000000-0000-4000-8000-000000000003';
update public.orders set status = 'ready' where id = 'e1000000-0000-4000-8000-000000000003';

update public.orders set status = 'preparing' where id = 'e1000000-0000-4000-8000-000000000004';
update public.orders set status = 'ready' where id = 'e1000000-0000-4000-8000-000000000004';
update public.orders
   set rider_id = 'a1000000-0000-4000-8000-000000000004',
       status = 'out_for_delivery'
 where id = 'e1000000-0000-4000-8000-000000000004';

update public.orders set status = 'preparing' where id = 'e1000000-0000-4000-8000-000000000005';
update public.orders set status = 'ready' where id = 'e1000000-0000-4000-8000-000000000005';
update public.orders
   set rider_id = 'a1000000-0000-4000-8000-000000000004',
       status = 'out_for_delivery'
 where id = 'e1000000-0000-4000-8000-000000000005';
update public.orders
   set status = 'delivered',
       delivered_at = now() - interval '90 minutes'
 where id = 'e1000000-0000-4000-8000-000000000005';

update public.orders set status = 'cancelled' where id = 'e1000000-0000-4000-8000-000000000006';

insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price) values
  ('e1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000101', 'Butter Chicken', 1, 280.00),
  ('e1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000104', 'Garlic Naan', 1, 60.00),
  ('e1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000105', 'Chicken Biryani', 1, 260.00),
  ('e1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000107', 'Gulab Jamun', 1, 90.00),
  ('e1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000201', 'Masala Dosa', 1, 120.00),
  ('e1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000205', 'Filter Coffee', 1, 50.00),
  ('e1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000301', 'Margherita', 1, 249.00),
  ('e1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000304', 'Garlic Bread', 1, 149.00),
  ('e1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000202', 'Idli Sambar', 2, 80.00),
  ('e1000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000301', 'Margherita', 1, 249.00);

insert into public.ratings (
  order_id, customer_id, restaurant_id, rider_id, food_rating, delivery_rating, comment
) values (
  'e1000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000005',
  'b1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000004',
  5,
  4,
  '[SEED_DEMO] Great idli — demo review'
);

insert into public.rider_locations (rider_id, order_id, lat, lng)
values (
  'a1000000-0000-4000-8000-000000000004',
  'e1000000-0000-4000-8000-000000000004',
  18.550000,
  73.760000
);

insert into public.notifications (user_id, title, body)
values
  ('a1000000-0000-4000-8000-000000000005', 'Welcome to QuickBite demo', '[SEED_DEMO] Customer inbox sample'),
  ('a1000000-0000-4000-8000-000000000004', 'Rider demo ready', '[SEED_DEMO] Go online and open the pool');
