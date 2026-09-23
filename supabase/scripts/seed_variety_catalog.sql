-- Variety catalog seed: 3 restored kitchens + 5 new, owners by email, 8 managers.
-- Never deletes rows. Safe to re-run (upsert by id/name).
-- Requires the planned owner/manager/customer profiles already in place.

do $$
declare
  v_base constant text := 'https://motqehtswgjbbvoazarh.supabase.co/storage/v1/object/public/menu-images/';
  v_malvan_id constant uuid := 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475';
  v_udupi_id  constant uuid := 'fe3c7228-8912-4a7f-88b3-d3883136ee45';
  v_deccan_id constant uuid := '9265c0b9-c318-45c7-aee6-ec45a78bd285';
  v_malvan constant text := 'e8d22fb3-cece-42ce-96ba-2ccfaf57e475/';
  v_udupi  constant text := 'fe3c7228-8912-4a7f-88b3-d3883136ee45/';
  v_deccan constant text := '9265c0b9-c318-45c7-aee6-ec45a78bd285/';
  v_catalog constant text := 'catalog/';
  v_mayur uuid;
  v_priya uuid;
  v_arjun uuid;
  v_ravi uuid;
  v_neha uuid;
  v_cafe uuid;
  v_casa uuid;
  v_wok uuid;
  v_nonna uuid;
  v_green uuid;
  v_mgr uuid;
  mgr_row record;
begin
  select id into v_mayur from public.profiles where email = 'mayur@quickbite.test';
  select id into v_priya from public.profiles where email = 'priya@quickbite.test';
  select id into v_arjun from public.profiles where email = 'arjun@quickbite.test';
  select id into v_ravi  from public.profiles where email = 'ravi@quickbite.test';
  select id into v_neha  from public.profiles where email = 'neha@quickbite.test';

  if v_mayur is null or v_priya is null or v_arjun is null or v_ravi is null or v_neha is null then
    raise exception 'Missing owner profile. Need mayur, priya, arjun, ravi, neha @quickbite.test';
  end if;

  -- Restored kitchens (fixed ids so existing Storage folders still match)
  insert into public.restaurants (
    id, owner_id, name, description, cuisine, address, image_url, is_open,
    branch_name, lat, lng, offer_percent, prep_minutes
  ) values
  (
    v_malvan_id, v_mayur,
    'Malvan Aangan', 'Maharashtrian · Konkani · Pure Veg', 'Maharashtrian',
    'Near Municipal Garden, Margao', v_base || v_malvan || 'Malvan_restuarant.png', true,
    'Goa', 15.272900, 73.958800, 15, 28
  ),
  (
    v_udupi_id, v_mayur,
    'Udupi Heritage', 'South Indian · Temple style · Pure Veg', 'South Indian',
    '18th June Rd, Panaji', v_base || 'udupi_heritage.png', true,
    'Goa', 15.490500, 73.827200, 10, 20
  ),
  (
    v_deccan_id, v_arjun,
    'The Deccan Table', 'North Indian · Mughlai · Grills', 'North Indian',
    'Campal, Panaji', v_base || v_deccan || 'the_deccan_table.png', true,
    'Goa', 15.495800, 73.821100, 18, 30
  )
  on conflict (id) do update set
    owner_id = excluded.owner_id,
    description = excluded.description,
    cuisine = excluded.cuisine,
    address = excluded.address,
    image_url = excluded.image_url,
    is_open = true,
    offer_percent = excluded.offer_percent,
    prep_minutes = excluded.prep_minutes;

  -- New variety kitchens
  insert into public.restaurants (
    owner_id, name, description, cuisine, address, image_url, is_open,
    branch_name, lat, lng, offer_percent, prep_minutes
  )
  select owner_id, name, description, cuisine, address, v_base || v_catalog || file, true,
         'Goa', lat, lng, offer_percent, prep_minutes
  from (values
    (v_priya, 'Café Laranja', 'Cafe · Bakery', 'Cafe', '18 18th June Rd, Panaji', 'cafe_laranja.jpg', 15.498100, 73.826400, 15, 20),
    (v_priya, 'Casa do Mar', 'Goan · Seafood', 'Goan', 'Dona Paula jetty road', 'casa_do_mar.jpg', 15.457200, 73.802800, 10, 32),
    (v_priya, 'Wok & Roll', 'Indo-Chinese', 'Chinese', 'Near Grace Church, Margao', 'wok_and_roll.jpg', 15.275600, 73.960900, 20, 22),
    (v_ravi,  'Nonna''s Oven', 'Italian · Pizza', 'Italian', 'Taleigao market road', 'nonnas_oven.jpg', 15.480200, 73.815600, 12, 28),
    (v_neha,  'Green Bowl Co.', 'Healthy · Salads', 'Healthy', 'Campal promenade', 'green_bowl_co.jpg', 15.492400, 73.818900, 25, 18)
  ) as k(owner_id, name, description, cuisine, address, file, lat, lng, offer_percent, prep_minutes)
  where not exists (select 1 from public.restaurants r where r.name = k.name);

  update public.restaurants r
  set
    owner_id = k.owner_id,
    image_url = v_base || v_catalog || k.file,
    lat = k.lat,
    lng = k.lng,
    offer_percent = k.offer_percent,
    prep_minutes = k.prep_minutes,
    cuisine = k.cuisine,
    address = k.address,
    description = k.description,
    is_open = true
  from (values
    (v_priya, 'Café Laranja', 'Cafe · Bakery', 'Cafe', '18 18th June Rd, Panaji', 'cafe_laranja.jpg', 15.498100, 73.826400, 15, 20),
    (v_priya, 'Casa do Mar', 'Goan · Seafood', 'Goan', 'Dona Paula jetty road', 'casa_do_mar.jpg', 15.457200, 73.802800, 10, 32),
    (v_priya, 'Wok & Roll', 'Indo-Chinese', 'Chinese', 'Near Grace Church, Margao', 'wok_and_roll.jpg', 15.275600, 73.960900, 20, 22),
    (v_ravi,  'Nonna''s Oven', 'Italian · Pizza', 'Italian', 'Taleigao market road', 'nonnas_oven.jpg', 15.480200, 73.815600, 12, 28),
    (v_neha,  'Green Bowl Co.', 'Healthy · Salads', 'Healthy', 'Campal promenade', 'green_bowl_co.jpg', 15.492400, 73.818900, 25, 18)
  ) as k(owner_id, name, description, cuisine, address, file, lat, lng, offer_percent, prep_minutes)
  where r.name = k.name;

  select id into v_cafe  from public.restaurants where name = 'Café Laranja' limit 1;
  select id into v_casa  from public.restaurants where name = 'Casa do Mar' limit 1;
  select id into v_wok   from public.restaurants where name = 'Wok & Roll' limit 1;
  select id into v_nonna from public.restaurants where name = 'Nonna''s Oven' limit 1;
  select id into v_green from public.restaurants where name = 'Green Bowl Co.' limit 1;

  if v_cafe is null or v_casa is null or v_wok is null or v_nonna is null or v_green is null then
    raise exception 'New kitchen insert failed.';
  end if;

  -- Restored dishes
  insert into public.menu_items (
    restaurant_id, name, description, price, image_url, is_available, is_veg, category
  )
  select restaurant_id, name, description, price, v_base || file, is_available, is_veg, category
  from (values
    (v_malvan_id, 'Kothimbir Vadi', 'Coriander fritters', 149.00, v_malvan || 'kothimbir_vadi.png', true, true, 'Starters'),
    (v_malvan_id, 'Bharli Vangi + Bhakri', 'Stuffed brinjal with bhakri', 249.00, v_malvan || 'bharli_vangi_and_bhakri.png', true, true, 'Main Course'),
    (v_malvan_id, 'Zunka Bhakri', 'Besan mash with bhakri', 219.00, v_malvan || 'zunka_bhakri.png', true, true, 'Main Course'),
    (v_malvan_id, 'Batata Bhaji', 'Potato bhaji', 90.00, v_malvan || 'batata_bhaji.png', true, true, 'Sides'),
    (v_malvan_id, 'Pithla Bhakri', 'Gram-flour curry with bhakri', 130.00, v_malvan || 'pithla_bhakri.png', true, true, 'Main Course'),
    (v_malvan_id, 'Sol Kadhi', 'Kokum and coconut drink', 60.00, v_malvan || 'sol_khadi.png', true, true, 'Drinks'),
    (v_malvan_id, 'Ukadiche Modak', 'Steamed coconut modak', 80.00, v_malvan || 'ukadiche_modak.png', true, true, 'Desserts'),
    (v_malvan_id, 'Misal Pav', 'Spiced moth beans with pav', 130.00, v_malvan || 'misal_pav.png', true, true, 'Snacks'),
    (v_malvan_id, 'Sabudana Vada', 'Tapioca fritters', 90.00, v_malvan || 'sabudana_vada.png', true, true, 'Snacks'),
    (v_udupi_id, 'Masala Dosa', 'Crisp dosa, potato masala', 159.00, v_udupi || 'masala_dosa.png', true, true, 'Main Course'),
    (v_udupi_id, 'Ghee Roast Dosa', 'Ghee roast dosa', 189.00, v_udupi || 'ghee_roast_dosa.png', true, true, 'Main Course'),
    (v_udupi_id, 'Idli Sambar', 'Steamed idli with sambar', 129.00, v_udupi || 'idli_sambar.png', true, true, 'Breakfast'),
    (v_udupi_id, 'Mysore Masala Dosa', 'Red chutney dosa', 170.00, v_udupi || 'Mysore_masala_dosa.png', true, true, 'Main Course'),
    (v_udupi_id, 'Set Dosa', 'Soft set dosa', 140.00, v_udupi || 'set_dosa.png', true, true, 'Breakfast'),
    (v_udupi_id, 'Medu Vada', 'Crisp lentil vada', 90.00, v_udupi || 'medu_vada.png', true, true, 'Snacks'),
    (v_udupi_id, 'Vegetable Upma', 'Semolina upma', 100.00, v_udupi || 'vegetable_upma.png', true, true, 'Breakfast'),
    (v_deccan_id, 'Chicken Tikka', 'Chargrilled chicken tikka', 279.00, v_deccan || 'chicken_tikka.png', true, false, 'Starters'),
    (v_deccan_id, 'Chicken Biryani', 'Dum chicken biryani', 289.00, v_deccan || 'chicken_biryani.png', true, false, 'Rice')
  ) as d(restaurant_id, name, description, price, file, is_available, is_veg, category)
  where not exists (
    select 1 from public.menu_items m
    where m.restaurant_id = d.restaurant_id and m.name = d.name
  );

  update public.menu_items m
  set image_url = v_base || d.file, is_available = d.is_available, is_veg = d.is_veg,
      price = d.price, category = d.category, description = d.description
  from (values
    (v_malvan_id, 'Kothimbir Vadi', 'Coriander fritters', 149.00, v_malvan || 'kothimbir_vadi.png', true, true, 'Starters'),
    (v_malvan_id, 'Bharli Vangi + Bhakri', 'Stuffed brinjal with bhakri', 249.00, v_malvan || 'bharli_vangi_and_bhakri.png', true, true, 'Main Course'),
    (v_malvan_id, 'Zunka Bhakri', 'Besan mash with bhakri', 219.00, v_malvan || 'zunka_bhakri.png', true, true, 'Main Course'),
    (v_malvan_id, 'Batata Bhaji', 'Potato bhaji', 90.00, v_malvan || 'batata_bhaji.png', true, true, 'Sides'),
    (v_malvan_id, 'Pithla Bhakri', 'Gram-flour curry with bhakri', 130.00, v_malvan || 'pithla_bhakri.png', true, true, 'Main Course'),
    (v_malvan_id, 'Sol Kadhi', 'Kokum and coconut drink', 60.00, v_malvan || 'sol_khadi.png', true, true, 'Drinks'),
    (v_malvan_id, 'Ukadiche Modak', 'Steamed coconut modak', 80.00, v_malvan || 'ukadiche_modak.png', true, true, 'Desserts'),
    (v_malvan_id, 'Misal Pav', 'Spiced moth beans with pav', 130.00, v_malvan || 'misal_pav.png', true, true, 'Snacks'),
    (v_malvan_id, 'Sabudana Vada', 'Tapioca fritters', 90.00, v_malvan || 'sabudana_vada.png', true, true, 'Snacks'),
    (v_udupi_id, 'Masala Dosa', 'Crisp dosa, potato masala', 159.00, v_udupi || 'masala_dosa.png', true, true, 'Main Course'),
    (v_udupi_id, 'Ghee Roast Dosa', 'Ghee roast dosa', 189.00, v_udupi || 'ghee_roast_dosa.png', true, true, 'Main Course'),
    (v_udupi_id, 'Idli Sambar', 'Steamed idli with sambar', 129.00, v_udupi || 'idli_sambar.png', true, true, 'Breakfast'),
    (v_udupi_id, 'Mysore Masala Dosa', 'Red chutney dosa', 170.00, v_udupi || 'Mysore_masala_dosa.png', true, true, 'Main Course'),
    (v_udupi_id, 'Set Dosa', 'Soft set dosa', 140.00, v_udupi || 'set_dosa.png', true, true, 'Breakfast'),
    (v_udupi_id, 'Medu Vada', 'Crisp lentil vada', 90.00, v_udupi || 'medu_vada.png', true, true, 'Snacks'),
    (v_udupi_id, 'Vegetable Upma', 'Semolina upma', 100.00, v_udupi || 'vegetable_upma.png', true, true, 'Breakfast'),
    (v_deccan_id, 'Chicken Tikka', 'Chargrilled chicken tikka', 279.00, v_deccan || 'chicken_tikka.png', true, false, 'Starters'),
    (v_deccan_id, 'Chicken Biryani', 'Dum chicken biryani', 289.00, v_deccan || 'chicken_biryani.png', true, false, 'Rice')
  ) as d(restaurant_id, name, description, price, file, is_available, is_veg, category)
  where m.restaurant_id = d.restaurant_id and m.name = d.name;

  -- New kitchen dishes (full public catalog URLs)
  insert into public.menu_items (
    restaurant_id, name, description, price, image_url, is_available, is_veg, category
  )
  select restaurant_id, name, description, price, v_base || v_catalog || file, true, is_veg, category
  from (values
    (v_cafe, 'Egg croissant sandwich', 'Soft egg, croissant', 160.00, 'egg_croissant.jpg', false, 'Breakfast'),
    (v_cafe, 'Cold brew', 'Slow steeped coffee', 140.00, 'cold_brew.jpg', true, 'Drinks'),
    (v_cafe, 'Almond banana bread', 'Toasted almond loaf', 90.00, 'banana_bread.jpg', true, 'Bakery'),
    (v_cafe, 'Caprese toast', 'Tomato, mozzarella, basil', 150.00, 'caprese_toast.jpg', true, 'Snacks'),
    (v_casa, 'Prawn recheado', 'Goan stuffed prawns', 380.00, 'prawn_recheado.jpg', false, 'Mains'),
    (v_casa, 'Kingfish curry', 'Coastal fish curry', 340.00, 'kingfish_curry.jpg', false, 'Mains'),
    (v_casa, 'Solantulem salad', 'Kokum salad', 180.00, 'solantulem_salad.jpg', true, 'Starters'),
    (v_casa, 'Bebinca slice', 'Layered Goan dessert', 120.00, 'bebinca.jpg', true, 'Desserts'),
    (v_wok, 'Chilli paneer dry', 'Indo-Chinese paneer', 220.00, 'chilli_paneer.jpg', true, 'Starters'),
    (v_wok, 'Hakka noodles', 'Veg hakka noodles', 190.00, 'hakka_noodles.jpg', true, 'Mains'),
    (v_wok, 'Chicken manchurian', 'Gravy manchurian', 260.00, 'chicken_manchurian.jpg', false, 'Mains'),
    (v_wok, 'Hot garlic soup', 'Clear garlic soup', 130.00, 'hot_garlic_soup.jpg', true, 'Soups'),
    (v_nonna, 'Margherita', 'Tomato, mozzarella, basil', 280.00, 'margherita.jpg', true, 'Pizza'),
    (v_nonna, 'Pepperoni', 'Pepperoni pizza', 340.00, 'pepperoni.jpg', false, 'Pizza'),
    (v_nonna, 'Garlic bread', 'Buttered garlic bread', 120.00, 'garlic_bread.jpg', true, 'Sides'),
    (v_nonna, 'Tiramisu cup', 'Coffee mascarpone cup', 160.00, 'tiramisu.jpg', true, 'Desserts'),
    (v_green, 'Quinoa garden bowl', 'Quinoa, greens, seeds', 240.00, 'quinoa_bowl.jpg', true, 'Bowls'),
    (v_green, 'Grilled chicken power bowl', 'Chicken, greens, grains', 280.00, 'chicken_bowl.jpg', false, 'Bowls'),
    (v_green, 'Avocado toast', 'Smashed avocado on sourdough', 200.00, 'avocado_toast.jpg', true, 'Breakfast'),
    (v_green, 'Fresh lime soda', 'Sweet or salted', 80.00, 'lime_soda.jpg', true, 'Drinks')
  ) as d(restaurant_id, name, description, price, file, is_veg, category)
  where not exists (
    select 1 from public.menu_items m
    where m.restaurant_id = d.restaurant_id and m.name = d.name
  );

  update public.menu_items m
  set image_url = v_base || v_catalog || d.file, is_veg = d.is_veg, price = d.price,
      category = d.category, description = d.description, is_available = true
  from (values
    (v_cafe, 'Egg croissant sandwich', 'Soft egg, croissant', 160.00, 'egg_croissant.jpg', false, 'Breakfast'),
    (v_cafe, 'Cold brew', 'Slow steeped coffee', 140.00, 'cold_brew.jpg', true, 'Drinks'),
    (v_cafe, 'Almond banana bread', 'Toasted almond loaf', 90.00, 'banana_bread.jpg', true, 'Bakery'),
    (v_cafe, 'Caprese toast', 'Tomato, mozzarella, basil', 150.00, 'caprese_toast.jpg', true, 'Snacks'),
    (v_casa, 'Prawn recheado', 'Goan stuffed prawns', 380.00, 'prawn_recheado.jpg', false, 'Mains'),
    (v_casa, 'Kingfish curry', 'Coastal fish curry', 340.00, 'kingfish_curry.jpg', false, 'Mains'),
    (v_casa, 'Solantulem salad', 'Kokum salad', 180.00, 'solantulem_salad.jpg', true, 'Starters'),
    (v_casa, 'Bebinca slice', 'Layered Goan dessert', 120.00, 'bebinca.jpg', true, 'Desserts'),
    (v_wok, 'Chilli paneer dry', 'Indo-Chinese paneer', 220.00, 'chilli_paneer.jpg', true, 'Starters'),
    (v_wok, 'Hakka noodles', 'Veg hakka noodles', 190.00, 'hakka_noodles.jpg', true, 'Mains'),
    (v_wok, 'Chicken manchurian', 'Gravy manchurian', 260.00, 'chicken_manchurian.jpg', false, 'Mains'),
    (v_wok, 'Hot garlic soup', 'Clear garlic soup', 130.00, 'hot_garlic_soup.jpg', true, 'Soups'),
    (v_nonna, 'Margherita', 'Tomato, mozzarella, basil', 280.00, 'margherita.jpg', true, 'Pizza'),
    (v_nonna, 'Pepperoni', 'Pepperoni pizza', 340.00, 'pepperoni.jpg', false, 'Pizza'),
    (v_nonna, 'Garlic bread', 'Buttered garlic bread', 120.00, 'garlic_bread.jpg', true, 'Sides'),
    (v_nonna, 'Tiramisu cup', 'Coffee mascarpone cup', 160.00, 'tiramisu.jpg', true, 'Desserts'),
    (v_green, 'Quinoa garden bowl', 'Quinoa, greens, seeds', 240.00, 'quinoa_bowl.jpg', true, 'Bowls'),
    (v_green, 'Grilled chicken power bowl', 'Chicken, greens, grains', 280.00, 'chicken_bowl.jpg', false, 'Bowls'),
    (v_green, 'Avocado toast', 'Smashed avocado on sourdough', 200.00, 'avocado_toast.jpg', true, 'Breakfast'),
    (v_green, 'Fresh lime soda', 'Sweet or salted', 80.00, 'lime_soda.jpg', true, 'Drinks')
  ) as d(restaurant_id, name, description, price, file, is_veg, category)
  where m.restaurant_id = d.restaurant_id and m.name = d.name;

  -- One active manager per kitchen
  for mgr_row in
    select * from (values
      ('nikhil@quickbite.test', v_malvan_id),
      ('ananya@quickbite.test', v_udupi_id),
      ('karan@quickbite.test',  v_deccan_id),
      ('diya@quickbite.test',   v_cafe),
      ('rohan@quickbite.test',  v_casa),
      ('isha@quickbite.test',   v_wok),
      ('vivek@quickbite.test',  v_nonna),
      ('meera@quickbite.test',  v_green)
    ) as x(email, restaurant_id)
  loop
    select id into v_mgr from public.profiles where email = mgr_row.email;
    if v_mgr is null then
      raise exception 'Missing manager profile: %', mgr_row.email;
    end if;
    insert into public.restaurant_members (restaurant_id, user_id, status)
    values (mgr_row.restaurant_id, v_mgr, 'active')
    on conflict (restaurant_id, user_id) do update
      set status = 'active';
  end loop;

  raise notice 'Variety catalog seeded: 8 kitchens, dishes upserted, 8 managers linked.';
end
$$;
