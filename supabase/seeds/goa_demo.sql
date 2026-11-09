-- QuickBite Goa demo seed — local `supabase db reset` only. Runs after seed.sql.
-- Margao-centred kitchens with real coordinates, consistent menu categories,
-- opening hours, cost for two, bestsellers, and live offers linked by id.
-- Identifiable by email domain @goa.quickbite.demo and order notes [GOA_DEMO].
-- Password for every demo user: sanket123
--
-- Scenarios covered:
--   * 6 open Margao kitchens within 8 km of the Margao fallback pin
--   * Copperleaf closes after midnight (hours wrap)
--   * Navelim Sweets is switched off (closed card at the bottom)
--   * Green Bowl Co. in Verna is ~10 km away (hidden when a Margao pin is set)
--   * customer has delivered orders (Order again) and one live order (tracking)
--   * newbie has no address (location flow)
--   * one expired offer that home_feed must not return
--
-- Remove: delete from auth.users where email like '%@goa.quickbite.demo';
--         delete from public.restaurants where id::text like 'b2000000-%';

create extension if not exists pgcrypto with schema extensions;

delete from public.home_highlights where id::text like 'f2000000-%';
delete from public.restaurants where id::text like 'b2000000-%';
delete from auth.users where email like '%@goa.quickbite.demo';

-- ---------------------------------------------------------------------------
-- Users
--   owner    a2000000-0000-4000-8000-000000000001  owner@goa.quickbite.demo
--   manager  a2000000-0000-4000-8000-000000000002  manager@goa.quickbite.demo
--   rider    a2000000-0000-4000-8000-000000000003  rider@goa.quickbite.demo
--   customer a2000000-0000-4000-8000-000000000004  customer@goa.quickbite.demo
--   newbie   a2000000-0000-4000-8000-000000000005  newbie@goa.quickbite.demo
-- ---------------------------------------------------------------------------
do $$
declare
  v_pwd text := extensions.crypt('sanket123', extensions.gen_salt('bf'));
  r record;
begin
  for r in
    select *
    from (
      values
        ('a2000000-0000-4000-8000-000000000001'::uuid, 'owner@goa.quickbite.demo', 'Anita Naik'),
        ('a2000000-0000-4000-8000-000000000002'::uuid, 'manager@goa.quickbite.demo', 'Rohan Desai'),
        ('a2000000-0000-4000-8000-000000000003'::uuid, 'rider@goa.quickbite.demo', 'Savio Fernandes'),
        ('a2000000-0000-4000-8000-000000000004'::uuid, 'customer@goa.quickbite.demo', 'Priya Kamat'),
        ('a2000000-0000-4000-8000-000000000005'::uuid, 'newbie@goa.quickbite.demo', 'Nikhil Shet')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', r.id, 'authenticated', 'authenticated', r.email, v_pwd, now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', r.full_name), now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      r.id, r.id, jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
      'email', r.id::text, now(), now(), now()
    );
  end loop;
end
$$;

select private.grant_role('a2000000-0000-4000-8000-000000000001', 'restaurant_owner'::public.app_role);
select private.grant_role('a2000000-0000-4000-8000-000000000002', 'restaurant_manager'::public.app_role);
select private.grant_role('a2000000-0000-4000-8000-000000000003', 'rider'::public.app_role);

update public.profiles
set is_online = true, vehicle_label = 'Honda Activa', plate = 'GA-08-K-4521', phone = '9822000003'
where id = 'a2000000-0000-4000-8000-000000000003';

update public.profiles set phone = '9822000004' where id = 'a2000000-0000-4000-8000-000000000004';

-- ---------------------------------------------------------------------------
-- Kitchens
-- ---------------------------------------------------------------------------
insert into public.restaurants (
  id, owner_id, name, description, cuisine, address, phone, image_url,
  is_open, branch_name, lat, lng, offer_percent, prep_minutes,
  opens_at, closes_at, cost_for_two, is_pure_veg
) values
  ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
   'Malvan Aangan', 'Konkan and Malvani home cooking: bhakri, misal and sol kadhi.', 'Malvani',
   'Grace Church Rd, Margao', '9822100001',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/e8d22fb3-cece-42ce-96ba-2ccfaf57e475/Malvan_restuarant.png',
   true, 'Margao', 15.275200, 73.961400, 15, 25, '11:00', '23:00', 450, false),
  ('b2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000001',
   'Udupi Heritage', 'Crisp dosas, soft idlis and filter coffee since breakfast.', 'South Indian',
   'Abade Faria Rd, Margao', '9822100002',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/fe3c7228-8912-4a7f-88b3-d3883136ee45/masala_dosa.png',
   true, 'Margao', 15.276400, 73.959800, 10, 15, '07:00', '22:30', 250, true),
  ('b2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000001',
   'The Deccan Table', 'Hyderabadi dum biryani and tandoor grills.', 'Biryani',
   'Station Rd, Fatorda, Margao', '9822100003',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/9265c0b9-c318-45c7-aee6-ec45a78bd285/chicken_biryani.png',
   true, 'Fatorda', 15.285600, 73.954800, null, 30, '12:00', '23:30', 500, false),
  ('b2000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000001',
   'Wok & Roll', 'Indo-Chinese noodles, momos and fried rice.', 'Chinese',
   'Fatorda stadium road, Margao', '9822100004', null,
   true, 'Fatorda', 15.283000, 73.956000, 20, 20, '12:00', '23:00', 400, false),
  ('b2000000-0000-4000-8000-000000000005', 'a2000000-0000-4000-8000-000000000001',
   'Susegado Café', 'Goan breakfasts, burgers and cold coffee by the old market.', 'Café',
   'Old Market lane, Margao', '9822100005', null,
   true, 'Margao', 15.281200, 73.965400, null, 15, '08:00', '22:00', 350, false),
  ('b2000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000001',
   'Copperleaf Pizza Co.', 'Wood-fired pizza and pasta, open late.', 'Italian',
   'Near Grace Church, Margao', '9822100006', null,
   true, 'Margao', 15.277800, 73.960200, 10, 25, '12:00', '00:30', 700, false),
  ('b2000000-0000-4000-8000-000000000007', 'a2000000-0000-4000-8000-000000000001',
   'Navelim Sweets & Chaat', 'Pani puri, pav bhaji and mithai.', 'Chaat',
   'Navelim junction, Margao', '9822100007', null,
   false, 'Navelim', 15.255000, 73.975000, null, 15, '10:00', '21:30', 200, true),
  ('b2000000-0000-4000-8000-000000000008', 'a2000000-0000-4000-8000-000000000001',
   'Green Bowl Co.', 'Salads and protein bowls near the Verna industrial estate.', 'Healthy',
   'Nagoa–Verna junction, Verna', '9822100008', null,
   true, 'Verna', 15.360400, 73.934600, 5, 15, '09:00', '21:00', 450, false);

insert into public.restaurant_members (restaurant_id, user_id, status)
values ('b2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'active');

-- ---------------------------------------------------------------------------
-- Menus (category text is turned into menu_categories by trigger)
-- ---------------------------------------------------------------------------
insert into public.menu_items (
  id, restaurant_id, name, description, price, is_available, category, is_veg, is_bestseller, image_url
)
select m.id, m.restaurant_id, m.name, m.description, m.price, m.is_available, m.category, m.is_veg, m.is_bestseller,
  case when m.img is null then null
       else 'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/' || m.img end
from (
  values
    -- Malvan Aangan
    ('c2000000-0000-4000-8000-000000000101'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Misal Pav', 'Spicy sprout curry, farsan, two pav', 140.00, true, 'Breakfast', true, true, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/misal_pav.png'),
    ('c2000000-0000-4000-8000-000000000102'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Kothimbir Vadi', 'Crisp coriander gram-flour squares', 110.00, true, 'Starters', true, false, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/kothimbir_vadi.png'),
    ('c2000000-0000-4000-8000-000000000103'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Batata Bhaji', 'Mustard-tempered potato, Konkan style', 100.00, true, 'Starters', true, false, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/batata_bhaji.png'),
    ('c2000000-0000-4000-8000-000000000104'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Bharli Vangi with Bhakri', 'Stuffed brinjal masala, jowar bhakri', 210.00, true, 'Mains', true, true, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/bharli_vangi_and_bhakri.png'),
    ('c2000000-0000-4000-8000-000000000105'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Pithla Bhakri', 'Gram-flour curry with bhakri', 160.00, true, 'Mains', true, false, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/pithla_bhakri.png'),
    ('c2000000-0000-4000-8000-000000000106'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Zunka Bhakri', 'Dry besan stir-fry, bhakri, onion', 150.00, true, 'Mains', true, false, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/zunka_bhakri.png'),
    ('c2000000-0000-4000-8000-000000000107'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Kingfish Thali', 'Fried surmai, curry, rice, sol kadhi', 420.00, true, 'Seafood', false, true, null),
    ('c2000000-0000-4000-8000-000000000108'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Prawn Malvani Curry', 'Coconut-kokum gravy with rice', 380.00, true, 'Seafood', false, false, null),
    ('c2000000-0000-4000-8000-000000000109'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Sol Kadhi', 'Kokum and coconut milk cooler', 60.00, true, 'Drinks', true, false, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/sol_khadi.png'),
    ('c2000000-0000-4000-8000-000000000110'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Ukadiche Modak', 'Steamed coconut-jaggery dumplings (2)', 120.00, true, 'Desserts', true, false, 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/ukadiche_modak.png'),
    -- Udupi Heritage
    ('c2000000-0000-4000-8000-000000000201'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Masala Dosa', 'Potato masala, sambar, two chutneys', 120.00, true, 'Dosa', true, true, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/masala_dosa.png'),
    ('c2000000-0000-4000-8000-000000000202'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Mysore Masala Dosa', 'Red chutney spread, potato masala', 140.00, true, 'Dosa', true, false, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/Mysore_masala_dosa.png'),
    ('c2000000-0000-4000-8000-000000000203'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Ghee Roast Dosa', 'Paper-thin, roasted in ghee', 150.00, true, 'Dosa', true, true, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/ghee_roast_dosa.png'),
    ('c2000000-0000-4000-8000-000000000204'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Set Dosa', 'Three soft dosas with sagu', 110.00, true, 'Dosa', true, false, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/set_dosa.png'),
    ('c2000000-0000-4000-8000-000000000205'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Idli Sambar', 'Three idlis, sambar, chutney', 80.00, true, 'Breakfast', true, true, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/idli_sambar.png'),
    ('c2000000-0000-4000-8000-000000000206'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Medu Vada', 'Two crisp lentil vadas', 70.00, true, 'Breakfast', true, false, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/medu_vada.png'),
    ('c2000000-0000-4000-8000-000000000207'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Vegetable Upma', 'Semolina with vegetables and cashew', 75.00, true, 'Breakfast', true, false, 'fe3c7228-8912-4a7f-88b3-d3883136ee45/vegetable_upma.png'),
    ('c2000000-0000-4000-8000-000000000208'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Curd Rice', 'Tempered curd rice, pomegranate', 90.00, true, 'Rice', true, false, null),
    ('c2000000-0000-4000-8000-000000000209'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Filter Coffee', 'Chicory blend, dabara-tumbler', 45.00, true, 'Drinks', true, false, null),
    ('c2000000-0000-4000-8000-000000000210'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Kesari Bath', 'Saffron semolina sweet', 60.00, false, 'Desserts', true, false, null),
    -- The Deccan Table
    ('c2000000-0000-4000-8000-000000000301'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Chicken Dum Biryani', 'Hyderabadi dum, raita, salan', 280.00, true, 'Biryani', false, true, '9265c0b9-c318-45c7-aee6-ec45a78bd285/chicken_biryani.png'),
    ('c2000000-0000-4000-8000-000000000302'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Mutton Biryani', 'Slow-cooked mutton, saffron rice', 360.00, true, 'Biryani', false, false, null),
    ('c2000000-0000-4000-8000-000000000303'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Veg Dum Biryani', 'Seasonal vegetables, mint, fried onion', 220.00, true, 'Biryani', true, false, null),
    ('c2000000-0000-4000-8000-000000000304'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Chicken Tikka', 'Tandoor-charred, mint chutney', 260.00, true, 'Starters', false, true, '9265c0b9-c318-45c7-aee6-ec45a78bd285/chicken_tikka.png'),
    ('c2000000-0000-4000-8000-000000000305'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Paneer Tikka', 'Charred cottage cheese, peppers', 230.00, true, 'Starters', true, false, null),
    ('c2000000-0000-4000-8000-000000000306'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Butter Chicken', 'Tomato-butter gravy', 290.00, true, 'Mains', false, false, null),
    ('c2000000-0000-4000-8000-000000000307'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Dal Makhani', 'Black lentils, cream, butter', 190.00, true, 'Mains', true, false, null),
    ('c2000000-0000-4000-8000-000000000308'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Butter Naan', 'Tandoor flatbread', 50.00, true, 'Breads', true, false, null),
    ('c2000000-0000-4000-8000-000000000309'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Double Ka Meetha', 'Bread pudding, saffron, nuts', 110.00, true, 'Desserts', true, false, null),
    -- Wok & Roll
    ('c2000000-0000-4000-8000-000000000401'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Veg Hakka Noodles', 'Wok-tossed, spring onion', 170.00, true, 'Noodles', true, true, null),
    ('c2000000-0000-4000-8000-000000000402'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Chicken Schezwan Noodles', 'Fiery Schezwan sauce', 210.00, true, 'Noodles', false, false, null),
    ('c2000000-0000-4000-8000-000000000403'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Egg Fried Rice', 'Smoky wok rice', 180.00, true, 'Rice', false, false, null),
    ('c2000000-0000-4000-8000-000000000404'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Chicken Momos', 'Steamed, red chilli dip (8)', 160.00, true, 'Starters', false, true, null),
    ('c2000000-0000-4000-8000-000000000405'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Veg Manchurian', 'Dry, garlic-soy glaze', 160.00, true, 'Starters', true, false, null),
    ('c2000000-0000-4000-8000-000000000406'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Chilli Chicken', 'Peppers, onion, dark soy', 240.00, true, 'Mains', false, false, null),
    ('c2000000-0000-4000-8000-000000000407'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Hot & Sour Soup', 'Vegetable, tangy and spicy', 120.00, true, 'Soups', true, false, null),
    ('c2000000-0000-4000-8000-000000000408'::uuid, 'b2000000-0000-4000-8000-000000000004'::uuid, 'Darsaan', 'Honey noodles, vanilla ice cream', 140.00, true, 'Desserts', true, false, null),
    -- Susegado Café
    ('c2000000-0000-4000-8000-000000000501'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Chorizo Pão', 'Goan sausage in fresh poi', 160.00, true, 'Breakfast', false, true, null),
    ('c2000000-0000-4000-8000-000000000502'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Bhaji Pão', 'Tomato-potato bhaji, poi', 90.00, true, 'Breakfast', true, false, null),
    ('c2000000-0000-4000-8000-000000000503'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Classic Chicken Burger', 'Crumb-fried, slaw, fries', 220.00, true, 'Burgers', false, true, null),
    ('c2000000-0000-4000-8000-000000000504'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Paneer Peri Peri Burger', 'Grilled paneer, peri peri mayo', 200.00, true, 'Burgers', true, false, null),
    ('c2000000-0000-4000-8000-000000000505'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Masala Fries', 'Crisp fries, house spice', 110.00, true, 'Sides', true, false, null),
    ('c2000000-0000-4000-8000-000000000506'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Cold Coffee', 'Thick, with ice cream', 130.00, true, 'Drinks', true, false, null),
    ('c2000000-0000-4000-8000-000000000507'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Kokum Soda', 'Sweet-sour Goan cooler', 80.00, true, 'Drinks', true, false, null),
    ('c2000000-0000-4000-8000-000000000508'::uuid, 'b2000000-0000-4000-8000-000000000005'::uuid, 'Bebinca', 'Layered Goan coconut dessert', 120.00, true, 'Desserts', true, true, null),
    -- Copperleaf Pizza Co.
    ('c2000000-0000-4000-8000-000000000601'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Margherita', 'San Marzano, fior di latte, basil', 299.00, true, 'Pizza', true, true, null),
    ('c2000000-0000-4000-8000-000000000602'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Goan Chorizo Pizza', 'Chorizo, onion, chilli', 389.00, true, 'Pizza', false, true, null),
    ('c2000000-0000-4000-8000-000000000603'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Farmhouse', 'Peppers, mushroom, olive, corn', 349.00, true, 'Pizza', true, false, null),
    ('c2000000-0000-4000-8000-000000000604'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Penne Arrabbiata', 'Spicy tomato, garlic', 289.00, true, 'Pasta', true, false, null),
    ('c2000000-0000-4000-8000-000000000605'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Chicken Alfredo', 'Cream, parmesan, mushroom', 339.00, true, 'Pasta', false, false, null),
    ('c2000000-0000-4000-8000-000000000606'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Garlic Bread', 'Herb butter, cheese', 159.00, true, 'Sides', true, false, null),
    ('c2000000-0000-4000-8000-000000000607'::uuid, 'b2000000-0000-4000-8000-000000000006'::uuid, 'Tiramisu', 'Espresso, mascarpone', 199.00, true, 'Desserts', true, false, null),
    -- Navelim Sweets & Chaat (kitchen switched off)
    ('c2000000-0000-4000-8000-000000000701'::uuid, 'b2000000-0000-4000-8000-000000000007'::uuid, 'Pani Puri', 'Six puris, tangy pani', 60.00, true, 'Chaat', true, true, null),
    ('c2000000-0000-4000-8000-000000000702'::uuid, 'b2000000-0000-4000-8000-000000000007'::uuid, 'Pav Bhaji', 'Butter pav, spicy bhaji', 130.00, true, 'Mains', true, false, null),
    ('c2000000-0000-4000-8000-000000000703'::uuid, 'b2000000-0000-4000-8000-000000000007'::uuid, 'Kaju Katli', '250 g', 260.00, true, 'Desserts', true, false, null),
    ('c2000000-0000-4000-8000-000000000704'::uuid, 'b2000000-0000-4000-8000-000000000007'::uuid, 'Sweet Lassi', 'Thick Punjabi lassi', 80.00, true, 'Drinks', true, false, null),
    -- Green Bowl Co. (Verna, out of Margao range)
    ('c2000000-0000-4000-8000-000000000801'::uuid, 'b2000000-0000-4000-8000-000000000008'::uuid, 'Grilled Chicken Bowl', 'Brown rice, greens, tahini', 290.00, true, 'Bowls', false, true, null),
    ('c2000000-0000-4000-8000-000000000802'::uuid, 'b2000000-0000-4000-8000-000000000008'::uuid, 'Falafel Bowl', 'Hummus, quinoa, pickles', 260.00, true, 'Bowls', true, false, null),
    ('c2000000-0000-4000-8000-000000000803'::uuid, 'b2000000-0000-4000-8000-000000000008'::uuid, 'Greek Salad', 'Feta, olives, cucumber', 230.00, true, 'Salads', true, false, null),
    ('c2000000-0000-4000-8000-000000000804'::uuid, 'b2000000-0000-4000-8000-000000000008'::uuid, 'Green Detox Juice', 'Spinach, apple, ginger', 140.00, true, 'Drinks', true, false, null)
) as m(id, restaurant_id, name, description, price, is_available, category, is_veg, is_bestseller, img);

-- ---------------------------------------------------------------------------
-- Offers (linked by id)
-- ---------------------------------------------------------------------------
insert into public.home_highlights (
  id, title, subtitle, image_url, kind, sort_order, is_active, badge, cta_label, restaurant_id,
  starts_at, ends_at, priority
) values
  ('f2000000-0000-4000-8000-000000000001', '15% off Malvani thalis', 'Kingfish, prawns and bhakri — this week only',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/e8d22fb3-cece-42ce-96ba-2ccfaf57e475/Malvan_restuarant.png',
   'offer', 1, true, '15% OFF', 'Order now', 'b2000000-0000-4000-8000-000000000001',
   now() - interval '1 day', now() + interval '7 days', 30),
  ('f2000000-0000-4000-8000-000000000002', 'Breakfast from ₹70', 'Dosa, idli and filter coffee from 7 am',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/fe3c7228-8912-4a7f-88b3-d3883136ee45/masala_dosa.png',
   'offer', 2, true, '10% OFF', 'See menu', 'b2000000-0000-4000-8000-000000000002',
   null, null, 20),
  ('f2000000-0000-4000-8000-000000000003', 'Biryani night', 'Dum biryani, raita and salan delivered hot',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/9265c0b9-c318-45c7-aee6-ec45a78bd285/chicken_biryani.png',
   'offer', 3, true, 'Trending', 'Order now', 'b2000000-0000-4000-8000-000000000003',
   null, now() + interval '30 days', 10),
  ('f2000000-0000-4000-8000-000000000004', 'Monsoon momo fest (ended)', 'Expired — must not appear on Home',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/9265c0b9-c318-45c7-aee6-ec45a78bd285/chicken_tikka.png',
   'offer', 4, true, '20% OFF', 'Order now', 'b2000000-0000-4000-8000-000000000004',
   now() - interval '30 days', now() - interval '1 day', 40),
  ('f2000000-0000-4000-8000-000000000005', 'Verna lunch bowls', 'Only shown to addresses within range of Verna',
   'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/fe3c7228-8912-4a7f-88b3-d3883136ee45/vegetable_upma.png',
   'offer', 5, true, '5% OFF', 'Order now', 'b2000000-0000-4000-8000-000000000008',
   null, null, 5);

-- ---------------------------------------------------------------------------
-- Customer address (newbie has none on purpose)
-- ---------------------------------------------------------------------------
insert into public.customer_addresses (
  id, customer_id, label, nickname, address_line, area, landmark, lat, lng, is_default
) values (
  'd2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004',
  'home', 'Home', 'Flat 3B, Palm Residency, Rua de Saudades', 'Margao', 'Opposite Holy Spirit Church',
  15.278300, 73.957900, true
);

-- ---------------------------------------------------------------------------
-- Orders: two delivered (Order again, popular dishes), one out for delivery
-- ---------------------------------------------------------------------------
insert into public.orders (
  id, customer_id, restaurant_id, rider_id, status, total_amount, delivery_fee,
  delivery_address, delivery_lat, delivery_lng, notes, placed_at, delivered_at
) values
  ('e2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000002',
   null, 'placed', 330.00, 30.00, 'Flat 3B, Palm Residency, Margao', 15.278300, 73.957900,
   '[GOA_DEMO] delivered breakfast', now() - interval '3 days', null),
  ('e2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000003',
   null, 'placed', 620.00, 30.00, 'Flat 3B, Palm Residency, Margao', 15.278300, 73.957900,
   '[GOA_DEMO] delivered biryani', now() - interval '1 day', null),
  ('e2000000-0000-4000-8000-000000000003', 'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000001',
   null, 'placed', 560.00, 30.00, 'Flat 3B, Palm Residency, Margao', 15.278300, 73.957900,
   '[GOA_DEMO] out for delivery', now() - interval '25 minutes', null);

update public.orders set status = 'preparing' where id::text like 'e2000000-%';
update public.orders set status = 'ready' where id::text like 'e2000000-%';
update public.orders
   set rider_id = 'a2000000-0000-4000-8000-000000000003', status = 'out_for_delivery'
 where id::text like 'e2000000-%';
update public.orders
   set status = 'delivered', delivered_at = placed_at + interval '35 minutes'
 where id in ('e2000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000002');

insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price) values
  ('e2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000201', 'Masala Dosa', 2, 120.00),
  ('e2000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000209', 'Filter Coffee', 2, 45.00),
  ('e2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000301', 'Chicken Dum Biryani', 2, 280.00),
  ('e2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000308', 'Butter Naan', 1, 50.00),
  ('e2000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000107', 'Kingfish Thali', 1, 420.00),
  ('e2000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000102', 'Kothimbir Vadi', 1, 110.00);

insert into public.ratings (order_id, customer_id, restaurant_id, rider_id, food_rating, delivery_rating, comment) values
  ('e2000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000002',
   'a2000000-0000-4000-8000-000000000003', 5, 5, '[GOA_DEMO] Crisp dosa, coffee still hot'),
  ('e2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000003',
   'a2000000-0000-4000-8000-000000000003', 4, 5, '[GOA_DEMO] Great biryani, a bit oily');

insert into public.rider_locations (rider_id, order_id, lat, lng) values
  ('a2000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000003', 15.276900, 73.959100);

insert into public.notifications (user_id, title, body) values
  ('a2000000-0000-4000-8000-000000000004', 'Your Kingfish Thali is on the way', '[GOA_DEMO] Savio picked up your order from Malvan Aangan.');
