#!/usr/bin/env node
/**
 * Generate QuickBite bulk seed data into reviewable files (does NOT push to Supabase).
 *
 * Source of names / restaurants / menu templates:
 *   docs/seed-data-helper-names.md
 * Counts / rules:
 *   docs/seed-data-spec.md
 *
 * Auth contract:
 *   email    = <lowercase-name>@quickbite.test
 *   password = sanket123  (same for every user)
 *
 * Usage:
 *   node scripts/generate-seed-data.mjs
 *
 * Output:
 *   supabase/seed-data/generated/seed-bundle.json   — full dataset
 *   supabase/seed-data/generated/manifest.json      — counts + spot checks
 *   supabase/seed-data/generated/auth-users.csv     — email,password,role for review
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const HELPER = join(ROOT, 'docs/seed-data-helper-names.md');
const OUT_DIR = join(ROOT, 'supabase/seed-data/generated');

const PASSWORD = 'sanket123';
const EMAIL_DOMAIN = 'quickbite.test';
const DELIVERY_FEE = 40;
const SEED_TAG = '[seed]';
const RNG_SEED = 'quickbite-seed-v1';

// Exact targets from seed-data-spec.md
const TARGETS = {
  profiles: 180,
  customers: 140,
  riders: 20,
  owners: 12,
  managers: 7,
  admin: 1,
  restaurants: 35,
  restaurant_members: 35,
  menu_items: 350,
  customer_addresses: 220,
  orders: 750,
  order_items: 1900,
  ratings: 450,
  notifications: 350,
  home_highlights: 6,
  applications: 25,
  manager_invites: 15,
  cart_items: 40,
  rider_locations: 15,
};

const ORDER_STATUS_COUNTS = {
  delivered: 525,
  ready: 45,
  preparing: 30,
  out_for_delivery: 60,
  placed: 52,
  cancelled: 38,
};

const STATUS_PATHS = {
  placed: ['placed'],
  preparing: ['placed', 'preparing'],
  ready: ['placed', 'preparing', 'ready'],
  out_for_delivery: ['placed', 'preparing', 'ready', 'out_for_delivery'],
  delivered: ['placed', 'preparing', 'ready', 'out_for_delivery', 'delivered'],
  cancelled_early: ['placed', 'cancelled'],
  cancelled_mid: ['placed', 'preparing', 'cancelled'],
};

const GOA = { lat: 15.4989, lng: 73.8278 };
const AREAS = [
  'Panaji', 'Calangute', 'Anjuna', 'Mapusa', 'Candolim', 'Vagator',
  'Assagao', 'Morjim', 'Colva', 'Porvorim', 'Siolim', 'Mandrem',
];

const RATING_COMMENTS = [
  'Fresh fish, sol kadhi was perfect.',
  'Arrived hot. Packaging could be better.',
  'Best butter chicken near the beach.',
  'Portion was generous for the price.',
  'Rider was polite and on time.',
  'A bit spicy but exactly what I wanted.',
  'Dosa stayed crisp even after delivery.',
  'Would order the thali again.',
  'Dessert was the highlight.',
  'Took longer than the ETA but food was worth it.',
  'Veg options were solid.',
  'Authentic Goan flavours.',
  null,
  null,
  'Great value for a weekday dinner.',
];

const NOTIFICATION_TEMPLATES = [
  { title: 'Order placed', body: 'Your kitchen has received the order.' },
  { title: 'Preparing', body: 'The kitchen started preparing your food.' },
  { title: 'Out for delivery', body: 'A rider is on the way with your order.' },
  { title: 'Delivered', body: 'Enjoy your meal. Rate your order when you can.' },
  { title: 'Offer nearby', body: 'A kitchen near you has a limited-time deal.' },
  { title: 'Welcome to QuickBite', body: 'Browse restaurants and order in a few taps.' },
];

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) so re-runs produce the same bundle for review
// ---------------------------------------------------------------------------

function hashSeed(str) {
  const h = createHash('sha256').update(str).digest();
  return h.readUInt32LE(0);
}

function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(hashSeed(RNG_SEED));

function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randInt(min, maxInclusive) {
  return min + Math.floor(rand() * (maxInclusive - min + 1));
}

function jitter(n, pct = 0.08) {
  const f = 1 + (rand() * 2 - 1) * pct;
  return Math.round(n * f * 100) / 100;
}

function uuidFromKey(key) {
  // Deterministic UUIDv4-shaped id from key (stable across runs).
  const hex = createHash('sha256').update(`qb:${key}`).digest('hex');
  const chars = hex.slice(0, 32).split('');
  chars[12] = '4';
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const s = chars.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

function emailFor(name) {
  return `${name.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

function optimizeImageUrl(url) {
  if (!url) return url;
  if (url.includes('images.unsplash.com') && !url.includes('?')) {
    return `${url}?auto=format&fit=crop&w=1200&q=80`;
  }
  return url;
}

function inferVeg(name, description) {
  const t = `${name} ${description}`.toLowerCase();
  const nonVeg = /\b(chicken|pork|mutton|beef|fish|prawn|crab|squid|salmon|chorizo|sausage|pepperoni|seafood|chonak)\b/;
  if (nonVeg.test(t)) return false;
  return true;
}

function inferCategory(name, description) {
  const t = `${name} ${description}`.toLowerCase();
  if (/\b(dosa|vada|idli|appam|thali|biryani|curry|stew|pasta|pizza|noodles|dim sum|nigiri|khao|soup)\b/.test(t)) {
    if (/\b(dosa|vada|idli|appam)\b/.test(t)) return 'South Indian';
    if (/\b(pizza|pasta|steak|ratatouille)\b/.test(t)) return 'Mains';
    if (/\b(biryani|curry|butter chicken|dal|paneer|naan|manchurian)\b/.test(t)) return 'Indian';
    if (/\b(nigiri|dim sum|noodles|khao|thai)\b/.test(t)) return 'Asian';
    return 'Mains';
  }
  if (/\b(salad|hummus|falafel|toast|bowl|smoothie|acai)\b/.test(t)) return 'Healthy';
  if (/\b(coffee|brew|smoothie|juice)\b/.test(t)) return 'Beverages';
  if (/\b(bebinca|serradura|croissant|tiramisu|dessert|pudding)\b/.test(t)) return 'Desserts';
  if (/\b(burger|pao|wrap)\b/.test(t)) return 'Cafe';
  if (/\b(starter|skewer|platter|fried)\b/.test(t)) return 'Starters';
  return 'Mains';
}

function cuisineMatchScore(cuisine, item) {
  const c = (cuisine || '').toLowerCase();
  const t = `${item.name} ${item.description}`.toLowerCase();
  if (c.includes('goan') || c.includes('seafood')) {
    return /\b(goan|fish|prawn|crab|pork|squid|bebinca|serradura|chonak|sausage)\b/.test(t) ? 3 : 0;
  }
  if (c.includes('south')) {
    return /\b(dosa|vada|appam|filter coffee|chettinad)\b/.test(t) ? 3 : 0;
  }
  if (c.includes('north') || c.includes('indian')) {
    return /\b(butter chicken|dal|paneer|naan|biryani)\b/.test(t) ? 3 : 0;
  }
  if (c.includes('greek') || c.includes('mediterranean')) {
    return /\b(greek|souvlaki|hummus|falafel|spanakopita|salad)\b/.test(t) ? 3 : 0;
  }
  if (c.includes('japanese')) return /\bnigiri|sushi\b/.test(t) ? 3 : 0;
  if (c.includes('asian') || c.includes('burmese')) {
    return /\b(khao|dim sum|noodles|manchurian|thai)\b/.test(t) ? 3 : 0;
  }
  if (c.includes('french') || c.includes('european') || c.includes('continental')) {
    return /\b(steak|ratatouille|pasta|pizza|croissant|tiramisu)\b/.test(t) ? 3 : 0;
  }
  if (c.includes('cafe') || c.includes('healthy')) {
    return /\b(toast|bowl|smoothie|coffee|burger|croissant|wrap|salad)\b/.test(t) ? 3 : 0;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Parse helper markdown
// ---------------------------------------------------------------------------

function parseHelper(md) {
  const names = [];
  const restaurants = [];
  const menuTemplates = [];

  const lines = md.split(/\r?\n/);
  let section = 'names';

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('## restuarants') || line.startsWith('## restaurants')) {
      section = 'restaurants';
      continue;
    }
    if (line.startsWith('## menu')) {
      section = 'menu';
      continue;
    }
    if (!line) continue;

    if (section === 'names') {
      if (/^[A-Za-z]/.test(line) && !line.startsWith('|') && !line.startsWith('#') && !/:\s*$/.test(line)) {
        names.push(line);
      }
      continue;
    }

    if ((section === 'restaurants' || section === 'menu') && line.startsWith('|')) {
      if (line.includes('---') || /^\|\s*name\s*\|/i.test(line)) continue;
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (section === 'restaurants' && cells.length >= 4) {
        restaurants.push({
          name: cells[0],
          description: cells[1],
          cuisine: cells[2],
          address: cells[3],
        });
      }
      if (section === 'menu' && cells.length >= 5) {
        menuTemplates.push({
          name: cells[0],
          description: cells[1],
          price: Number(cells[2]),
          image_url: optimizeImageUrl(cells[3]),
          is_available: String(cells[4]).toUpperCase() === 'TRUE',
        });
      }
    }
  }

  return { names, restaurants, menuTemplates };
}

// ---------------------------------------------------------------------------
// Build dataset
// ---------------------------------------------------------------------------

function build() {
  const md = readFileSync(HELPER, 'utf8');
  const { names, restaurants: restRows, menuTemplates } = parseHelper(md);

  if (names.length !== TARGETS.profiles) {
    throw new Error(`Expected ${TARGETS.profiles} names, got ${names.length}`);
  }
  if (restRows.length !== TARGETS.restaurants) {
    throw new Error(`Expected ${TARGETS.restaurants} restaurants, got ${restRows.length}`);
  }
  if (menuTemplates.length < 10) {
    throw new Error(`Need at least 10 menu templates, got ${menuTemplates.length}`);
  }

  const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
  const roles = [
    ...Array(TARGETS.admin).fill('admin'),
    ...Array(TARGETS.owners).fill('restaurant_owner'),
    ...Array(TARGETS.managers).fill('restaurant_manager'),
    ...Array(TARGETS.riders).fill('rider'),
    ...Array(TARGETS.customers).fill('customer'),
  ];
  if (roles.length !== TARGETS.profiles) throw new Error('Role breakdown mismatch');

  const auth_users = sortedNames.map((full_name, i) => {
    const role = roles[i];
    const id = uuidFromKey(`user:${full_name.toLowerCase()}`);
    return {
      id,
      email: emailFor(full_name),
      password: PASSWORD,
      full_name,
      role,
      phone: `9${String(700000000 + i).slice(0, 9)}`,
      is_online: role === 'rider' ? i % 3 !== 0 : false,
      vehicle_label: role === 'rider' ? pick(['Bike', 'Scooter', 'Activa']) : null,
      plate: role === 'rider' ? `GA-0${randInt(1, 9)}-${randInt(1000, 9999)}` : null,
    };
  });

  const byRole = (role) => auth_users.filter((u) => u.role === role);
  const owners = byRole('restaurant_owner');
  const managers = byRole('restaurant_manager');
  const riders = byRole('rider');
  const customers = byRole('customer');
  const admin = byRole('admin')[0];

  // --- restaurants: 12 owners → 35 branches (11×3 + 1×2) ---
  const ownerSlot = [];
  for (let i = 0; i < owners.length; i += 1) {
    const count = i < 11 ? 3 : 2;
    for (let b = 0; b < count; b += 1) ownerSlot.push({ owner: owners[i], branchIndex: b });
  }
  if (ownerSlot.length !== 35) throw new Error(`Owner slots ${ownerSlot.length} !== 35`);

  const restaurants = restRows.map((row, i) => {
    const { owner, branchIndex } = ownerSlot[i];
    const branch_name = branchIndex === 0 ? 'Main' : `Branch ${branchIndex + 1}`;
    const lat = GOA.lat + (rand() - 0.5) * 0.12;
    const lng = GOA.lng + (rand() - 0.5) * 0.12;
    return {
      id: uuidFromKey(`restaurant:${row.name}:${branch_name}`),
      owner_id: owner.id,
      name: row.name,
      description: `${row.description} ${SEED_TAG}`,
      cuisine: row.cuisine,
      address: row.address,
      phone: `0832${randInt(2000000, 2999999)}`,
      image_url: menuTemplates[i % menuTemplates.length].image_url,
      is_open: i % 5 !== 0, // ~80% open
      branch_name,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      offer_percent: i % 4 === 0 ? pick([10, 15, 20, 25]) : null,
      prep_minutes: pick([20, 25, 30, 35, 40]),
    };
  });

  // --- members: 7 managers × 5 kitchens = 35 ---
  const restaurant_members = [];
  for (let i = 0; i < restaurants.length; i += 1) {
    const manager = managers[i % managers.length];
    restaurant_members.push({
      restaurant_id: restaurants[i].id,
      user_id: manager.id,
      status: 'active',
    });
  }

  // --- menu_items: 10 per restaurant ---
  const menu_items = [];
  for (let r = 0; r < restaurants.length; r += 1) {
    const rest = restaurants[r];
    const scored = menuTemplates
      .map((t, idx) => ({ t, idx, score: cuisineMatchScore(rest.cuisine, t) + rand() }))
      .sort((a, b) => b.score - a.score);
    const chosen = scored.slice(0, 10);
    for (let j = 0; j < chosen.length; j += 1) {
      const { t } = chosen[j];
      const globalIndex = menu_items.length;
      menu_items.push({
        id: uuidFromKey(`menu:${rest.id}:${t.name}:${j}`),
        restaurant_id: rest.id,
        name: t.name,
        description: t.description,
        price: jitter(t.price, 0.06),
        image_url: t.image_url,
        is_available: globalIndex % 10 !== 0, // ~10% unavailable
        category: inferCategory(t.name, t.description),
        is_veg: inferVeg(t.name, t.description),
      });
    }
  }
  if (menu_items.length !== TARGETS.menu_items) {
    throw new Error(`menu_items ${menu_items.length} !== ${TARGETS.menu_items}`);
  }

  const menuByRestaurant = new Map();
  for (const item of menu_items) {
    const list = menuByRestaurant.get(item.restaurant_id) ?? [];
    list.push(item);
    menuByRestaurant.set(item.restaurant_id, list);
  }

  // Staff restaurant ids (self-deal guard)
  const staffRestaurantIds = new Map(); // userId -> Set(restaurantId)
  for (const r of restaurants) {
    const set = staffRestaurantIds.get(r.owner_id) ?? new Set();
    set.add(r.id);
    staffRestaurantIds.set(r.owner_id, set);
  }
  for (const m of restaurant_members) {
    const set = staffRestaurantIds.get(m.user_id) ?? new Set();
    set.add(m.restaurant_id);
    staffRestaurantIds.set(m.user_id, set);
  }

  // --- addresses: 220 across 140 customers (80 with 2, 60 with 1) ---
  const customer_addresses = [];
  for (let i = 0; i < customers.length; i += 1) {
    const cust = customers[i];
    const count = i < 80 ? 2 : 1;
    for (let a = 0; a < count; a += 1) {
      const area = pick(AREAS);
      const lat = GOA.lat + (rand() - 0.5) * 0.15;
      const lng = GOA.lng + (rand() - 0.5) * 0.15;
      customer_addresses.push({
        id: uuidFromKey(`addr:${cust.id}:${a}`),
        customer_id: cust.id,
        label: a === 0 ? 'home' : pick(['work', 'other']),
        nickname: a === 0 ? 'Home' : pick(['Office', 'Parents', 'Weekend']),
        address_line: `H.No ${randInt(1, 400)}, ${pick(['Near Market', 'Beach Road', 'Main Street', 'Ward'])}`,
        area,
        landmark: pick(['Opposite church', 'Near ATM', 'Beside bus stop', null]),
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        is_default: a === 0,
      });
    }
  }
  if (customer_addresses.length !== TARGETS.customer_addresses) {
    throw new Error(`addresses ${customer_addresses.length} !== ${TARGETS.customer_addresses}`);
  }

  const addressesByCustomer = new Map();
  for (const addr of customer_addresses) {
    const list = addressesByCustomer.get(addr.customer_id) ?? [];
    list.push(addr);
    addressesByCustomer.set(addr.customer_id, list);
  }

  // --- order line-count plan summing to 1900 ---
  const lineCounts = Array(TARGETS.orders).fill(2);
  let lines = 2 * TARGETS.orders; // 1500
  let need = TARGETS.order_items - lines; // 400
  let idx = 0;
  while (need > 0) {
    if (lineCounts[idx % TARGETS.orders] < 5) {
      lineCounts[idx % TARGETS.orders] += 1;
      need -= 1;
    }
    idx += 1;
    if (idx > TARGETS.orders * 10) break;
  }
  // Fix remainder by bumping some 2→3 if still short, or trimming if over
  while (lineCounts.reduce((a, b) => a + b, 0) < TARGETS.order_items) {
    const i = randInt(0, TARGETS.orders - 1);
    if (lineCounts[i] < 5) lineCounts[i] += 1;
  }
  while (lineCounts.reduce((a, b) => a + b, 0) > TARGETS.order_items) {
    const i = randInt(0, TARGETS.orders - 1);
    if (lineCounts[i] > 1) lineCounts[i] -= 1;
  }

  const statusList = [];
  for (const [status, count] of Object.entries(ORDER_STATUS_COUNTS)) {
    for (let i = 0; i < count; i += 1) statusList.push(status);
  }
  // shuffle statusList
  for (let i = statusList.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [statusList[i], statusList[j]] = [statusList[j], statusList[i]];
  }

  const orders = [];
  const order_items = [];
  const now = Date.now();

  for (let i = 0; i < TARGETS.orders; i += 1) {
    const status = statusList[i];
    const restaurant = restaurants[i % restaurants.length];

    // pick customer who doesn't staff this restaurant
    let customer = customers[i % customers.length];
    for (let tries = 0; tries < 20; tries += 1) {
      const c = customers[(i + tries * 7) % customers.length];
      const banned = staffRestaurantIds.get(c.id);
      if (!banned || !banned.has(restaurant.id)) {
        customer = c;
        break;
      }
    }

    let rider_id = null;
    if (status === 'out_for_delivery' || status === 'delivered') {
      // riders are never owners of these seed kitchens in role mix, but still avoid staff
      rider_id = riders[i % riders.length].id;
      const banned = staffRestaurantIds.get(rider_id);
      if (banned?.has(restaurant.id)) {
        rider_id = riders[(i + 3) % riders.length].id;
      }
    }

    const addr = pick(addressesByCustomer.get(customer.id));
    const daysAgo = randInt(0, 90);
    const placed_at = new Date(now - daysAgo * 86400000 - randInt(0, 86400000)).toISOString();

    let status_path;
    if (status === 'cancelled') {
      status_path = rand() < 0.5 ? STATUS_PATHS.cancelled_early : STATUS_PATHS.cancelled_mid;
    } else {
      status_path = STATUS_PATHS[status];
    }

    const orderId = uuidFromKey(`order:${i}:${customer.id}:${restaurant.id}`);
    const menu = (menuByRestaurant.get(restaurant.id) || []).filter((m) => m.is_available);
    const pool = menu.length ? menu : menuByRestaurant.get(restaurant.id);
    const nLines = lineCounts[i];
    const chosenItems = [];
    for (let L = 0; L < nLines; L += 1) {
      chosenItems.push(pool[(i + L * 3) % pool.length]);
    }

    let itemsSubtotal = 0;
    for (let L = 0; L < chosenItems.length; L += 1) {
      const item = chosenItems[L];
      const quantity = rand() < 0.85 ? 1 : 2;
      itemsSubtotal += quantity * Number(item.price);
      order_items.push({
        id: uuidFromKey(`oi:${orderId}:${L}`),
        order_id: orderId,
        menu_item_id: item.id,
        item_name: item.name,
        quantity,
        unit_price: item.price,
      });
    }

    const total_amount = Math.round((itemsSubtotal + DELIVERY_FEE) * 100) / 100;
    const delivered_at =
      status === 'delivered'
        ? new Date(new Date(placed_at).getTime() + randInt(35, 90) * 60000).toISOString()
        : null;

    orders.push({
      id: orderId,
      customer_id: customer.id,
      restaurant_id: restaurant.id,
      rider_id,
      status, // final status after walking status_path on import
      status_path,
      total_amount,
      delivery_fee: DELIVERY_FEE,
      delivery_address: `${addr.address_line}, ${addr.area}`,
      delivery_lat: addr.lat,
      delivery_lng: addr.lng,
      delivery_address_id: addr.id,
      notes: rand() < 0.15 ? pick(['Less spicy', 'Extra cutlery', 'Call on arrival', 'No onion']) : null,
      placed_at,
      delivered_at,
      tip_amount: status === 'delivered' && rand() < 0.25 ? pick([10, 20, 30]) : 0,
      bonus_amount: 0,
      rider_earning: rider_id ? pick([35, 40, 45, 50]) : null,
      pickup_km: rider_id ? Number((rand() * 4 + 0.5).toFixed(2)) : null,
      drop_km: rider_id ? Number((rand() * 8 + 1).toFixed(2)) : null,
      eta_minutes: rider_id ? randInt(15, 45) : null,
    });
  }

  if (order_items.length !== TARGETS.order_items) {
    throw new Error(`order_items ${order_items.length} !== ${TARGETS.order_items}`);
  }

  // --- ratings: 450 of delivered ---
  const delivered = orders.filter((o) => o.status === 'delivered');
  const ratings = delivered.slice(0, TARGETS.ratings).map((o, i) => ({
    id: uuidFromKey(`rating:${o.id}`),
    order_id: o.id,
    customer_id: o.customer_id,
    restaurant_id: o.restaurant_id,
    rider_id: o.rider_id,
    food_rating: randInt(3, 5) === 3 && rand() < 0.3 ? randInt(1, 5) : randInt(3, 5),
    delivery_rating: o.rider_id ? randInt(3, 5) : null,
    comment: RATING_COMMENTS[i % RATING_COMMENTS.length],
    created_at: o.delivered_at || o.placed_at,
  }));

  // --- notifications ---
  const notifications = [];
  for (let i = 0; i < TARGETS.notifications; i += 1) {
    const user = auth_users[i % auth_users.length];
    const tmpl = NOTIFICATION_TEMPLATES[i % NOTIFICATION_TEMPLATES.length];
    notifications.push({
      id: uuidFromKey(`notif:${i}:${user.id}`),
      user_id: user.id,
      title: tmpl.title,
      body: `${tmpl.body} ${SEED_TAG}`,
      created_at: new Date(now - randInt(0, 60) * 86400000).toISOString(),
      read_at: rand() < 0.4 ? new Date(now - randInt(0, 30) * 86400000).toISOString() : null,
    });
  }

  // --- home_highlights ---
  const home_highlights = [
    {
      id: uuidFromKey('hl:1'),
      title: 'Goan seafood week',
      subtitle: 'Curries, fry, and sol kadhi',
      image_url: menuTemplates[0].image_url,
      kind: 'offer',
      sort_order: 0,
      is_active: true,
      restaurant_id: restaurants[0].id,
      badge: '20% OFF',
      cta_label: 'Order Now',
    },
    {
      id: uuidFromKey('hl:2'),
      title: 'Sunset Greek plates',
      subtitle: 'Souvlaki & salads',
      image_url: menuTemplates[26].image_url,
      kind: 'offer',
      sort_order: 1,
      is_active: true,
      restaurant_id: restaurants[8].id,
      badge: 'Popular',
      cta_label: 'Explore',
    },
    {
      id: uuidFromKey('hl:3'),
      title: 'Cafe mornings',
      subtitle: 'Croissants & cold brew',
      image_url: menuTemplates[25].image_url,
      kind: 'offer',
      sort_order: 2,
      is_active: true,
      restaurant_id: restaurants[20].id,
      badge: null,
      cta_label: 'Order Now',
    },
    {
      id: uuidFromKey('hl:4'),
      title: 'Pure veg thalis',
      subtitle: 'Navtara & Sanatan picks',
      image_url: menuTemplates[38].image_url,
      kind: 'offer',
      sort_order: 3,
      is_active: true,
      restaurant_id: restaurants[30].id,
      badge: 'Veg',
      cta_label: 'Browse',
    },
    {
      id: uuidFromKey('hl:5'),
      title: 'Kitchen stories',
      subtitle: 'Behind the pass in Goa',
      image_url: menuTemplates[10].image_url,
      kind: 'video',
      sort_order: 4,
      is_active: true,
      restaurant_id: null,
      badge: null,
      cta_label: 'Watch',
    },
    {
      id: uuidFromKey('hl:6'),
      title: 'Beach grill reels',
      subtitle: 'Catch of the day',
      image_url: menuTemplates[2].image_url,
      kind: 'video',
      sort_order: 5,
      is_active: true,
      restaurant_id: restaurants[12].id,
      badge: null,
      cta_label: 'Watch',
    },
  ];

  // --- applications ---
  const applications = [];
  for (let i = 0; i < TARGETS.applications; i += 1) {
    const applicant = customers[i % customers.length];
    const kind = i % 2 === 0 ? 'rider' : 'restaurant_owner';
    const status = i < 8 ? 'pending' : i < 18 ? 'approved' : 'rejected';
    applications.push({
      id: uuidFromKey(`app:${i}:${applicant.id}`),
      applicant_id: applicant.id,
      kind,
      status,
      payload: {
        note: `${SEED_TAG} application`,
        city: pick(AREAS),
      },
      review_note: status === 'pending' ? null : status === 'approved' ? 'Looks good' : 'Incomplete docs',
      reviewed_by: status === 'pending' ? null : admin.id,
      reviewed_at: status === 'pending' ? null : new Date(now - randInt(1, 40) * 86400000).toISOString(),
    });
  }

  // --- manager invites ---
  const manager_invites = [];
  for (let i = 0; i < TARGETS.manager_invites; i += 1) {
    const rest = restaurants[i % restaurants.length];
    const owner = owners.find((o) => o.id === rest.owner_id) ?? owners[0];
    const invitee = managers[i % managers.length];
    manager_invites.push({
      id: uuidFromKey(`invite:${i}:${rest.id}`),
      restaurant_id: rest.id,
      email: invitee.email, // already lowercased
      invited_by: owner.id,
      status: i < 5 ? 'pending' : i < 12 ? 'accepted' : 'revoked',
      accepted_at: i >= 5 && i < 12 ? new Date(now - randInt(1, 20) * 86400000).toISOString() : null,
    });
  }

  // --- cart_items: 40 lines, ~20 customers, one restaurant each ---
  const cart_items = [];
  for (let i = 0; i < 20 && cart_items.length < TARGETS.cart_items; i += 1) {
    const cust = customers[(i * 3) % customers.length];
    const rest = restaurants[(i * 2) % restaurants.length];
    const banned = staffRestaurantIds.get(cust.id);
    if (banned?.has(rest.id)) continue;
    const pool = (menuByRestaurant.get(rest.id) || []).filter((m) => m.is_available).slice(0, 3);
    for (const item of pool) {
      if (cart_items.length >= TARGETS.cart_items) break;
      cart_items.push({
        id: uuidFromKey(`cart:${cust.id}:${item.id}`),
        customer_id: cust.id,
        restaurant_id: rest.id,
        menu_item_id: item.id,
        quantity: randInt(1, 2),
      });
    }
  }
  while (cart_items.length < TARGETS.cart_items) {
    const cust = customers[cart_items.length % customers.length];
    const rest = restaurants[cart_items.length % restaurants.length];
    const item = menuByRestaurant.get(rest.id)[0];
    cart_items.push({
      id: uuidFromKey(`cart:fill:${cart_items.length}:${cust.id}`),
      customer_id: cust.id,
      restaurant_id: rest.id,
      menu_item_id: item.id,
      quantity: 1,
    });
  }

  // --- rider_locations ---
  const rider_locations = riders.slice(0, TARGETS.rider_locations).map((rider, i) => {
    const active = orders.find((o) => o.rider_id === rider.id && o.status === 'out_for_delivery');
    return {
      rider_id: rider.id,
      order_id: active?.id ?? null,
      lat: Number((GOA.lat + (rand() - 0.5) * 0.1).toFixed(6)),
      lng: Number((GOA.lng + (rand() - 0.5) * 0.1).toFixed(6)),
      updated_at: new Date().toISOString(),
    };
  });

  const bundle = {
    meta: {
      generated_at: new Date().toISOString(),
      generator: 'scripts/generate-seed-data.mjs',
      rng_seed: RNG_SEED,
      password_for_all_users: PASSWORD,
      email_domain: EMAIL_DOMAIN,
      delivery_fee: DELIVERY_FEE,
      notes: [
        'Does NOT include order_status_history — importer must walk status_path via UPDATEs.',
        'Does NOT include embeddings — run backfill after push.',
        'Auth: create users with these emails/passwords (Admin API), then grant_role for non-customers.',
        'Additive seed: emails use @quickbite.test so they should not collide with real accounts.',
        'Image URLs are Unsplash with w=1200&q=80 params for lighter downloads.',
      ],
    },
    auth_users,
    restaurants,
    restaurant_members,
    menu_items,
    customer_addresses,
    orders,
    order_items,
    ratings,
    notifications,
    home_highlights,
    applications,
    manager_invites,
    cart_items,
    rider_locations,
  };

  const statusCounts = {};
  for (const o of orders) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;

  const manifest = {
    counts: {
      auth_users: auth_users.length,
      profiles_by_role: Object.fromEntries(
        ['admin', 'restaurant_owner', 'restaurant_manager', 'rider', 'customer'].map((r) => [
          r,
          auth_users.filter((u) => u.role === r).length,
        ]),
      ),
      restaurants: restaurants.length,
      restaurant_members: restaurant_members.length,
      menu_items: menu_items.length,
      menu_unavailable: menu_items.filter((m) => !m.is_available).length,
      customer_addresses: customer_addresses.length,
      orders: orders.length,
      orders_by_status: statusCounts,
      order_items: order_items.length,
      ratings: ratings.length,
      ratings_with_comment: ratings.filter((r) => r.comment).length,
      notifications: notifications.length,
      home_highlights: home_highlights.length,
      applications: applications.length,
      manager_invites: manager_invites.length,
      cart_items: cart_items.length,
      rider_locations: rider_locations.length,
    },
    sample_logins: auth_users.slice(0, 5).map((u) => ({
      email: u.email,
      password: PASSWORD,
      role: u.role,
      full_name: u.full_name,
    })),
    admin_login: { email: admin.email, password: PASSWORD, role: 'admin' },
    targets_ok: {
      profiles: auth_users.length === TARGETS.profiles,
      restaurants: restaurants.length === TARGETS.restaurants,
      menu_items: menu_items.length === TARGETS.menu_items,
      orders: orders.length === TARGETS.orders,
      order_items: order_items.length === TARGETS.order_items,
      ratings: ratings.length === TARGETS.ratings,
      delivered: statusCounts.delivered === ORDER_STATUS_COUNTS.delivered,
    },
  };

  return { bundle, manifest };
}

function main() {
  const { bundle, manifest } = build();
  mkdirSync(OUT_DIR, { recursive: true });

  const bundlePath = join(OUT_DIR, 'seed-bundle.json');
  const manifestPath = join(OUT_DIR, 'manifest.json');
  const csvPath = join(OUT_DIR, 'auth-users.csv');

  writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const csv = [
    'email,password,role,full_name,id',
    ...bundle.auth_users.map(
      (u) => `${u.email},${u.password},${u.role},"${u.full_name}",${u.id}`,
    ),
  ].join('\n');
  writeFileSync(csvPath, csv);

  console.log('Generated seed files (review only — not pushed):');
  console.log(`  ${bundlePath}`);
  console.log(`  ${manifestPath}`);
  console.log(`  ${csvPath}`);
  console.log(JSON.stringify(manifest.counts, null, 2));
  console.log('targets_ok:', manifest.targets_ok);
  console.log(`Admin login: ${manifest.admin_login.email} / ${PASSWORD}`);
}

main();
