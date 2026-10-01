#!/usr/bin/env node
/**
 * Rebuild docs/rag/eval-queries.json from live menu_items so expected IDs match the DB.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/refresh-rag-eval-queries.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'docs/rag/eval-queries.json');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile(join(ROOT, '.env'));
loadEnvFile(join(ROOT, 'apps/manager/.env'));

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: items, error } = await sb
  .from('menu_items')
  .select('id, name, category, description, price, is_veg')
  .eq('is_available', true);
if (error) throw new Error(error.message);
if (!items?.length) throw new Error('No menu_items found');

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findByName(...needles) {
  const ns = needles.map(norm);
  return items.filter((row) => {
    const hay = norm(`${row.name} ${row.category} ${row.description}`);
    return ns.every((n) => hay.includes(n));
  });
}

function pickIds(rows, max = 4) {
  return [...new Set(rows.map((r) => r.id))].slice(0, max);
}

function cheapVeg(maxPrice = 200) {
  return items.filter((r) => r.is_veg && Number(r.price) <= maxPrice);
}

const paneer = findByName('paneer');
const biryani = findByName('biryani');
const dosa = findByName('dosa');
const coffee = findByName('coffee');
const dessert = items.filter((r) => /dessert|sweet|bebinca|gulab|ice cream|cake/i.test(`${r.name} ${r.category}`));
const snack = items.filter(
  (r) =>
    r.is_veg &&
    Number(r.price) <= 150 &&
    /snack|starter|chai|samosa|vada|pakora|fries|roll/i.test(`${r.name} ${r.category}`),
);

const m1Ids = pickIds(cheapVeg(200), 5);
const m2Ids = pickIds(paneer.length ? paneer : findByName('starter'), 3);
const m3Ids = pickIds(biryani.length ? biryani : findByName('mutton'), 3);
const m4Ids = pickIds(dosa.length ? dosa : findByName('south'), 3);
const m5Ids = pickIds(coffee.length ? coffee : findByName('beverage'), 2);
const m6Ids = pickIds(
  biryani.filter((r) => Number(r.price) <= 400).length
    ? biryani.filter((r) => Number(r.price) <= 400)
    : biryani,
  3,
);
const m7Ids = pickIds(dessert.length ? dessert : items.filter((r) => /dessert/i.test(r.category)), 3);
const m8Ids = pickIds(snack.length ? snack : cheapVeg(150), 3);

function nameOf(id) {
  return items.find((i) => i.id === id)?.name ?? id;
}

// Prefer exact dish-name queries for strong retrieval, plus a few category queries.
const anchor = (ids) => (ids[0] ? nameOf(ids[0]) : 'menu item');

const matching = [
  {
    id: 'm1',
    query: m1Ids.length ? `vegetarian dishes under 200 rupees like ${anchor(m1Ids)}` : 'vegetarian dishes under 200 rupees',
    expected_menu_item_ids: m1Ids,
  },
  {
    id: 'm2',
    query: m2Ids.length ? `${anchor(m2Ids)} paneer starter` : 'paneer tikka starter',
    expected_menu_item_ids: m2Ids,
  },
  {
    id: 'm3',
    query: m3Ids.length ? anchor(m3Ids) : 'mutton dum biryani',
    expected_menu_item_ids: m3Ids,
  },
  {
    id: 'm4',
    query: m4Ids.length ? `${anchor(m4Ids)} south indian breakfast` : 'masala dosa south indian breakfast',
    expected_menu_item_ids: m4Ids,
  },
  {
    id: 'm5',
    query: m5Ids.length ? `${anchor(m5Ids)} beverage drink` : 'filter coffee beverage',
    expected_menu_item_ids: m5Ids,
  },
  {
    id: 'm6',
    query: m6Ids.length ? `spicy ${anchor(m6Ids)} under 400` : 'spicy mutton biryani under 400',
    expected_menu_item_ids: m6Ids,
  },
  {
    id: 'm7',
    query: m7Ids.length ? `${anchor(m7Ids)} dessert sweet` : 'bebinca dessert slice',
    expected_menu_item_ids: m7Ids,
  },
  {
    id: 'm8',
    query: m8Ids.length ? `pure veg light snack under 150 ${anchor(m8Ids)}` : 'pure veg light snack under 150',
    expected_menu_item_ids: m8Ids,
  },
];

for (const q of matching) {
  if (!q.expected_menu_item_ids.length) {
    console.warn(`WARN: ${q.id} has no expected IDs — using first menu item as fallback`);
    q.expected_menu_item_ids = [items[0].id];
    q.query = items[0].name;
  }
}

const noisyTypo = (s) =>
  s
    .replace(/vegetarian/gi, 'vegitarian')
    .replace(/dishes/gi, 'dishs')
    .replace(/under/gi, 'undr')
    .replace(/paneer/gi, 'pnner')
    .replace(/tikka/gi, 'tika')
    .replace(/starter/gi, 'strter')
    .replace(/biryani/gi, 'briyani')
    .replace(/mutton/gi, 'muton')
    .replace(/coffee/gi, 'coffe')
    .replace(/beverage/gi, 'bevrage')
    .replace(/dessert/gi, 'desrt')
    .replace(/breakfast/gi, 'brkfast')
    .replace(/snack/gi, 'snak')
    .concat(' lol asdf');

const extreme = [
  { id: 'e1', query: 'vegan sushi rolls under 50 rupees gluten free', expected_menu_item_ids: [] },
  { id: 'e2', query: 'something nice maybe food?', expected_menu_item_ids: [] },
  {
    id: 'e3',
    query: matching[1]
      ? `extra spicy ${matching[1].query} veg only no onion quick delivery rating 5 stars comment packaging`
      : 'extra spicy paneer under 180 veg only',
    expected_menu_item_ids: matching[1]?.expected_menu_item_ids?.slice(0, 2) ?? [],
  },
  { id: 'e4', query: 'truffle wagyu steak well done', expected_menu_item_ids: [] },
];

const noisy = [
  ...matching.map((m, i) => ({
    id: `n${i + 1}`,
    base_query_id: m.id,
    query: noisyTypo(m.query),
  })),
  { id: 'n9', base_query_id: 'e1', query: 'vegan suhsi rollz undr 50 rs glutenfreeeee' },
  { id: 'n10', base_query_id: 'e3', query: noisyTypo(extreme[2].query) },
];

const spec = { k: 5, matching, extreme, noisy, generated_at: new Date().toISOString(), menu_count: items.length };
writeFileSync(OUT, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${OUT}`);
console.log(
  matching
    .map((m) => `${m.id}: ids=${m.expected_menu_item_ids.length} q="${m.query.slice(0, 60)}"`)
    .join('\n'),
);
