#!/usr/bin/env node
/**
 * Generate synthetic restaurants + menu_items CSVs and generation_report.json.
 *
 * Usage: node scripts/datagen/generate.mjs
 */

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAndExpand } from './expand.mjs';
import { restaurantId, menuItemId, SYNTHETIC_OWNER_ID } from './lib/ids.mjs';
import { mulberry32, pick, shuffle, intBetween, priceBetween } from './lib/prng.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, 'out');
const SEED = 'quickbite-datagen-v1';
const TARGET_RESTAURANTS = 250;
const ITEMS_PER_RESTAURANT = 82;
const MIN_MENU_ITEMS = 20500;

const CUISINE_WEIGHTS = [
  ['goan', 22],
  ['maharashtrian', 20],
  ['south_indian', 14],
  ['north_indian', 14],
  ['chinese', 10],
  ['italian', 10],
  ['fast_food', 10],
];

const GOA_AREA = {
  names: [
    'Panaji',
    'Mapusa',
    'Margao',
    'Vasco',
    'Calangute',
    'Anjuna',
    'Candolim',
    'Porvorim',
    'Ponda',
    'Colva',
    'Baga',
    'Dona Paula',
  ],
  lat: [15.3, 15.6],
  lng: [73.75, 74.05],
};

const NAME_PREFIX = [
  'Spice',
  'Coastal',
  'Garden',
  'Royal',
  'Urban',
  'Heritage',
  'Palm',
  'Monsoon',
  'Sunset',
  'Harbor',
  'Lotus',
  'Copper',
  'Saffron',
  'Pepper',
  'Coconut',
  'Mango',
  'River',
  'Hilltop',
  'Market',
  'Lantern',
];

const NAME_SUFFIX = [
  'Kitchen',
  'Kitchenette',
  'Bistro',
  'Cafe',
  'Eatery',
  'House',
  'Table',
  'Tandoor',
  'Thali',
  'Diner',
  'Corner',
  'Grill',
  'Bowl',
  'Plate',
  'Oven',
  'Hut',
  'Room',
  'Spot',
  'Den',
  'Works',
];

function weightedCuisine(rng) {
  const total = CUISINE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [c, w] of CUISINE_WEIGHTS) {
    r -= w;
    if (r <= 0) return c;
  }
  return CUISINE_WEIGHTS[0][0];
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows, columns) {
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(','));
  }
  return lines.join('\n') + '\n';
}

function formatTags(tags) {
  // Postgres text[] via CSV: {"a","b"}
  return `{${tags.map((t) => `"${String(t).replace(/"/g, '\\"')}"`).join(',')}}`;
}

function buildRestaurants(rng) {
  const restaurants = [];
  const usedNames = new Set();
  for (let i = 0; i < TARGET_RESTAURANTS; i++) {
    const cuisine = weightedCuisine(rng);
    const area = pick(rng, GOA_AREA.names);
    let name;
    let guard = 0;
    do {
      name = `${pick(rng, NAME_PREFIX)} ${pick(rng, NAME_SUFFIX)} ${area}`;
      guard++;
    } while (usedNames.has(name.toLowerCase()) && guard < 50);
    usedNames.add(name.toLowerCase());

    const slug = `syn-${cuisine}-${String(i + 1).padStart(3, '0')}-${area.toLowerCase().replace(/\s+/g, '-')}`;
    const lat = GOA_AREA.lat[0] + rng() * (GOA_AREA.lat[1] - GOA_AREA.lat[0]);
    const lng = GOA_AREA.lng[0] + rng() * (GOA_AREA.lng[1] - GOA_AREA.lng[0]);

    restaurants.push({
      id: restaurantId(slug),
      owner_id: SYNTHETIC_OWNER_ID,
      name,
      description: `Synthetic ${cuisine.replace(/_/g, ' ')} kitchen in ${area} for RAG scale-up.`,
      cuisine,
      address: `${intBetween(rng, 1, 240)} ${pick(rng, ['MG Road', 'Church Street', 'Market Road', 'Beach Road', 'Station Road'])}, ${area}, Goa`,
      phone: `98${String(intBetween(rng, 10000000, 99999999))}`,
      image_url: null,
      is_open: true,
      branch_name: area,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      offer_percent: rng() < 0.35 ? intBetween(rng, 5, 25) : null,
      prep_minutes: intBetween(rng, 20, 45),
      capacity_threshold: 8,
      is_synthetic: true,
      slug,
    });
  }
  return restaurants;
}

function assignMenus(rng, restaurants, expanded) {
  const byCuisine = new Map();
  const shared = [];
  for (const d of expanded) {
    if (!byCuisine.has(d.cuisine)) byCuisine.set(d.cuisine, []);
    byCuisine.get(d.cuisine).push(d);
    if (['beverage', 'dessert', 'side'].includes(d.category)) shared.push(d);
  }

  const menuItems = [];
  let dupesRemoved = 0;

  for (const r of restaurants) {
    const pool = shuffle(rng, [...(byCuisine.get(r.cuisine) || []), ...shared]);
    // Prefer cuisine-primary dishes first
    const primary = shuffle(rng, byCuisine.get(r.cuisine) || []);
    const extras = shuffle(
      rng,
      expanded.filter((d) => d.cuisine !== r.cuisine && ['beverage', 'dessert', 'side', 'snack'].includes(d.category)),
    );
    const ordered = [...primary, ...extras, ...pool];

    const seenNames = new Set();
    let added = 0;
    for (const dish of ordered) {
      if (added >= ITEMS_PER_RESTAURANT) break;
      const nameKey = dish.name.toLowerCase();
      if (seenNames.has(nameKey)) {
        dupesRemoved++;
        continue;
      }
      seenNames.add(nameKey);

      const desc = pick(rng, dish.descriptions);
      const price = priceBetween(rng, dish.price_min, dish.price_max);
      menuItems.push({
        id: menuItemId(r.slug, dish.canonical_key),
        restaurant_id: r.id,
        name: dish.name,
        description: desc,
        price,
        image_url: null,
        is_available: true,
        category: dish.category,
        is_veg: dish.is_veg,
        tags: dish.tags,
        canonical_key: dish.canonical_key,
        is_synthetic: true,
        _cuisine: dish.cuisine,
        _restaurant_slug: r.slug,
      });
      added++;
    }
  }

  // Global dedupe on (restaurant_id, lower(name)) — should already be clean
  const global = new Map();
  const deduped = [];
  for (const m of menuItems) {
    const k = `${m.restaurant_id}|${m.name.toLowerCase()}`;
    if (global.has(k)) {
      dupesRemoved++;
      continue;
    }
    global.set(k, true);
    deduped.push(m);
  }

  return { menuItems: deduped, dupesRemoved };
}

function buildReport(restaurants, menuItems, baseCount, expandedCount, dupesRemoved) {
  const byCuisine = {};
  const byCategory = {};
  let veg = 0;
  for (const m of menuItems) {
    byCuisine[m._cuisine] = (byCuisine[m._cuisine] || 0) + 1;
    byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    if (m.is_veg) veg++;
  }
  const restByCuisine = {};
  for (const r of restaurants) {
    restByCuisine[r.cuisine] = (restByCuisine[r.cuisine] || 0) + 1;
  }
  return {
    seed: SEED,
    generated_at: new Date().toISOString(),
    base_dishes: baseCount,
    expanded_dishes: expandedCount,
    restaurants: restaurants.length,
    restaurants_by_cuisine: restByCuisine,
    menu_items: menuItems.length,
    menu_items_by_cuisine: byCuisine,
    menu_items_by_category: byCategory,
    veg_count: veg,
    non_veg_count: menuItems.length - veg,
    veg_ratio: Number((veg / menuItems.length).toFixed(4)),
    dupes_removed: dupesRemoved,
    synthetic_owner_id: SYNTHETIC_OWNER_ID,
    min_target_met: menuItems.length >= MIN_MENU_ITEMS,
  };
}

function main() {
  const rng = mulberry32(SEED);
  const { base, expanded } = loadAndExpand();
  console.log(`Base dishes: ${base.length}; expanded: ${expanded.length}`);

  if (expanded.length < 550) {
    console.warn(`Warning: expanded catalog is ${expanded.length} (target ~600)`);
  }

  const restaurants = buildRestaurants(rng);
  const { menuItems, dupesRemoved } = assignMenus(rng, restaurants, expanded);

  if (menuItems.length < MIN_MENU_ITEMS) {
    console.error(`FAIL: only ${menuItems.length} menu items (need >= ${MIN_MENU_ITEMS})`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const restCols = [
    'id',
    'owner_id',
    'name',
    'description',
    'cuisine',
    'address',
    'phone',
    'image_url',
    'is_open',
    'branch_name',
    'lat',
    'lng',
    'offer_percent',
    'prep_minutes',
    'capacity_threshold',
    'is_synthetic',
  ];
  const menuCols = [
    'id',
    'restaurant_id',
    'name',
    'description',
    'price',
    'image_url',
    'is_available',
    'category',
    'is_veg',
    'tags',
    'canonical_key',
    'is_synthetic',
  ];

  const restRows = restaurants.map((r) => ({
    ...r,
    is_open: r.is_open,
    is_synthetic: true,
  }));
  const menuRows = menuItems.map((m) => ({
    ...m,
    tags: formatTags(m.tags),
    is_veg: m.is_veg,
    is_available: true,
    is_synthetic: true,
  }));

  writeFileSync(join(OUT_DIR, 'restaurants.csv'), toCsv(restRows, restCols));
  writeFileSync(join(OUT_DIR, 'menu_items.csv'), toCsv(menuRows, menuCols));

  // Also write JSON sidecars for reliable load (CSV tags are awkward)
  writeFileSync(
    join(OUT_DIR, 'restaurants.json'),
    JSON.stringify(
      restaurants.map(({ slug, ...r }) => ({ ...r, is_synthetic: true })),
      null,
      0,
    ),
  );
  writeFileSync(
    join(OUT_DIR, 'menu_items.json'),
    JSON.stringify(
      menuItems.map(({ _cuisine, _restaurant_slug, ...m }) => ({
        ...m,
        is_synthetic: true,
      })),
      null,
      0,
    ),
  );

  const report = buildReport(restaurants, menuItems, base.length, expanded.length, dupesRemoved);
  writeFileSync(join(OUT_DIR, 'generation_report.json'), JSON.stringify(report, null, 2) + '\n');

  console.log(
    `Wrote ${restaurants.length} restaurants, ${menuItems.length} menu_items (dupes removed: ${dupesRemoved}) → ${OUT_DIR}`,
  );
  console.log(`Veg ratio: ${(report.veg_ratio * 100).toFixed(1)}%; expanded dishes: ${expanded.length}`);
}

main();
