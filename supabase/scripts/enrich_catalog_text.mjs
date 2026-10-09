#!/usr/bin/env node
/**
 * UPDATE-only catalog text enrichment for RAG quality.
 * Never deletes restaurants / menu_items / orders / profiles.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/scripts/enrich_catalog_text.mjs
 *   Add --dry-run to print planned updates only.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const dryRun = process.argv.includes('--dry-run');

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv(join(ROOT, '.env'));
loadEnv(join(ROOT, 'apps/manager/.env'));
loadEnv(join(ROOT, 'apps/client/.env'));

const url = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  ''
).replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

const empty = (v) => v == null || String(v).trim() === '';

function stripSeedTag(text) {
  return String(text || '')
    .replace(/\s*\[seed\]\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function restaurantDescription(row) {
  const name = row.name?.trim() || 'This kitchen';
  const cuisine = stripSeedTag(row.cuisine) || 'local';
  const current = stripSeedTag(row.description);
  if (current.length >= 60 && !/^[A-Za-z ·,&/-]+$/.test(current)) {
    return current;
  }
  // Tag-only or very short blurbs → full sentence for RAG.
  if (current.length < 60) {
    return `${name} serves ${cuisine} favourites for Goa delivery — clear flavours, portioned for sharing, ready when you are hungry.`;
  }
  return current;
}

function menuDescription(row) {
  const name = row.name?.trim() || 'Dish';
  const category = row.category?.trim() || 'Mains';
  const current = stripSeedTag(row.description);
  const repeatsName = current.toLowerCase() === name.toLowerCase();
  if (!empty(current) && current.length >= 40 && !repeatsName) {
    return current;
  }
  return `${name} from the ${category} menu — aromatic, kitchen-fresh, and made for delivery without losing flavour.`;
}

async function fetchAll(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if ((data || []).length < 1000) break;
  }
  return rows;
}

const restaurants = await fetchAll(
  'restaurants',
  'id, name, cuisine, description',
);
const menu = await fetchAll('menu_items', 'id, name, category, description');

let restUpdated = 0;
let menuUpdated = 0;

for (const row of restaurants) {
  const next = restaurantDescription(row);
  const prev = stripSeedTag(row.description);
  if (next === prev) continue;
  console.log(`restaurant ${row.name}: "${prev.slice(0, 50)}" → "${next.slice(0, 70)}…"`);
  if (!dryRun) {
    const { error } = await db.from('restaurants').update({ description: next }).eq('id', row.id);
    if (error) throw new Error(error.message);
  }
  restUpdated += 1;
}

for (const row of menu) {
  const next = menuDescription(row);
  const prev = stripSeedTag(row.description);
  if (next === prev) continue;
  if (!dryRun) {
    const { error } = await db.from('menu_items').update({ description: next }).eq('id', row.id);
    if (error) throw new Error(error.message);
  } else if (menuUpdated < 8) {
    console.log(`menu ${row.name}: "${prev}" → "${next}"`);
  }
  menuUpdated += 1;
}

console.log(
  `${dryRun ? 'DRY-RUN ' : ''}done. restaurants_updated=${restUpdated} menu_updated=${menuUpdated}`,
);
