-- Manual ops: cluster cloud kitchens for Margao / Verna delivery testing.
-- Prefer: node scripts/apply-goa-kitchen-geo.mjs (same values).
-- Does NOT wipe data. Run only after explicit approval.
--
-- Margao hub ~15.273 / 73.958 — Near me (≤8 km) when pin is Margao
-- Verna hub  ~15.355 / 73.925 — Near me when pin is Verna / Nagoa
-- Others across Goa — outside 8 km from both hubs

update public.restaurants as r
set
  lat = k.lat,
  lng = k.lng,
  address = k.address,
  updated_at = now()
from (
  values
    -- Margao
    ('Malvan Aangan', 'Grace Church Rd, Margao', 15.2752, 73.9614),
    ('Wok & Roll', 'Fatorda stadium road, Margao', 15.2856, 73.9548),
    ('Fisherman''s Local', 'Near Colva circle (Margao side)', 15.2795, 73.9589),
    ('Martin''s Corner', 'Near Municipal Garden, Margao', 15.2728, 73.9572),
    ('Susegado', 'Old Market lane, Margao', 15.2812, 73.9654),
    ('Infanteria', 'Abade Faria Rd, Margao', 15.2764, 73.9598),
    ('Jamies Restaurant', 'Isidorio Baptista Rd, Margao', 15.2741, 73.9625),
    ('Copperleaf', 'Near Grace Church, Margao', 15.2778, 73.9602),
    -- Verna
    ('Café Laranja', 'NH66 service road, Verna', 15.3482, 73.9224),
    ('Green Bowl Co.', 'Nagoa–Verna junction', 15.3604, 73.9346),
    ('The Deccan Table', 'Airport Rd near Sancoale (Verna–Margao)', 15.3256, 73.9418),
    ('Burger Factory', 'Verna Industrial Estate Rd, Verna', 15.3548, 73.9282),
    ('Aura Cafe', 'Verna village market road', 15.3512, 73.9248),
    ('Bean Me Up', 'NH66 / Verna bypass', 15.3576, 73.9311),
    ('Botanico', 'Nagoa church road, Verna', 15.3628, 73.9274),
    ('Peep Kitchen', 'Verna Industrial Estate gate 2', 15.3495, 73.9358),
    -- Across Goa
    ('Udupi Heritage', '18th June Rd, Panaji', 15.4905, 73.8272),
    ('Casa do Mar', 'Dona Paula jetty road', 15.4572, 73.8028),
    ('Nonna''s Oven', 'Municipal Market Rd, Mapusa', 15.5910, 73.8095),
    ('Mum''s Kitchen', 'DB Marg, Panaji', 15.4975, 73.8439),
    ('Ritz Classic', 'Wagle Vision, Panaji', 15.4942, 73.7983),
    ('The Black Sheep Bistro', 'Villa Braganza, Panaji', 15.4560, 73.8755),
    ('Viva Panjim', '31st January Rd, Fontainhas', 15.4982, 73.8278),
    ('Joseph Bar', 'Gomes Pereira Rd, Fontainhas', 15.4965, 73.8261),
    ('Souza Lobo', 'Calangute Beach Rd', 15.5439, 73.7553),
    ('Thalassa', 'Vaddy, Siolim', 15.5269, 73.8765),
    ('Gunpowder', 'Assagao–Anjuna Rd', 15.4833, 73.8188),
    ('La Plage', 'Ashwem Beach, Mandrem', 15.4875, 73.8559),
    ('Fat Fish', 'Calangute–Arpora Rd, Arpora', 15.5309, 73.8870),
    ('Spice Goa', 'NH-66, Karaswada, Mapusa', 15.5282, 73.8346),
    ('Anand Seafood Restaurant', 'Highway Junction, Anjuna', 15.5192, 73.8145),
    ('Antares Restaurant & Beach Club', 'Ozran Beach, Vagator', 15.4849, 73.8477),
    ('Bhatti Village', 'Bhatti Waddo, Nerul', 15.4941, 73.8212),
    ('Sakana', 'Chapora Rd, Anjuna', 15.4406, 73.8691),
    ('Vinayak Family Restaurant', 'Main Road, Anjuna', 15.5077, 73.8680)
) as k(name, address, lat, lng)
where r.name = k.name;

-- select name, address, lat, lng from public.restaurants where is_open order by name;
-- select count(*) as missing_coords from public.restaurants where lat is null or lng is null;
