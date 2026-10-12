#!/usr/bin/env node
/**
 * Backfill null restaurant / menu_item image_url with stable Unsplash food photos
 * keyed by cuisine / category. Also replaces known-dead Unsplash ids.
 *
 *   node scripts/backfill-food-images.mjs
 *   node scripts/backfill-food-images.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function loadEnv(path) {
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

loadEnv(join(ROOT, '.env'));
loadEnv(join(ROOT, 'apps/client/.env'));
loadEnv(join(ROOT, 'apps/manager/.env'));

const u = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

/** Cuisine → Unsplash photo path (photo-…) */
const CUISINE_IMAGES = {
  goan: u('photo-1559847844-5315695dadae'),
  seafood: u('photo-1559847844-5315695dadae'),
  south_indian: u('photo-1630383249896-424e482df921'),
  north_indian: u('photo-1585937421612-70a008356fbe'),
  indian: u('photo-1585937421612-70a008356fbe'),
  maharashtrian: u('photo-1606491956689-2ea866880067'),
  chinese: u('photo-1525755662778-989d0524687a'),
  asian: u('photo-1525755662778-989d0524687a'),
  italian: u('photo-1513104890138-7c749659a591'),
  continental: u('photo-1544025162-d76694265947'),
  mexican: u('photo-1565299585323-38d6b0865b47'),
  thai: u('photo-1562565652-a0d8f0c59eb4'),
  cafe: u('photo-1495474472287-4d71bcdd2085'),
  healthy: u('photo-1512621776951-a57141f2eefd'),
  multi: u('photo-1504674900247-0877df9cc836'),
  default: u('photo-1504674900247-0877df9cc836'),
};

const CATEGORY_IMAGES = {
  main: u('photo-1546069901-ba9599a7e63c'),
  mains: u('photo-1546069901-ba9599a7e63c'),
  breakfast: u('photo-1533089860892-a7c6f0a88666'),
  snack: u('photo-1626082927389-6cd097cdc6ec'),
  side: u('photo-1540189549336-e6e99c3679fe'),
  dessert: u('photo-1551024601-bec78aea704b'),
  desserts: u('photo-1551024601-bec78aea704b'),
  beverage: u('photo-1544145945-f90425340c7e'),
  beverages: u('photo-1544145945-f90425340c7e'),
  drink: u('photo-1544145945-f90425340c7e'),
  starter: u('photo-1626082927389-6cd097cdc6ec'),
  starters: u('photo-1626082927389-6cd097cdc6ec'),
  indian: u('photo-1585937421612-70a008356fbe'),
  asian: u('photo-1525755662778-989d0524687a'),
  cafe: u('photo-1495474472287-4d71bcdd2085'),
  healthy: u('photo-1512621776951-a57141f2eefd'),
  default: u('photo-1546069901-ba9599a7e63c'),
};

/** Known 404 / dead Unsplash ids seen in seed data */
const DEAD_FRAGMENTS = [
  'photo-1621996346565-e3d5d6281216',
];

function cuisineImage(cuisine) {
  const key = String(cuisine || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return CUISINE_IMAGES[key] || CUISINE_IMAGES.default;
}

function categoryImage(category) {
  const key = String(category || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return CATEGORY_IMAGES[key] || CATEGORY_IMAGES.default;
}

function isDead(url) {
  if (!url) return true;
  return DEAD_FRAGMENTS.some((frag) => url.includes(frag));
}

async function main() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.error('Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let restUpdated = 0;
  let menuUpdated = 0;

  // Restaurants — page through null/empty/dead
  let start = 0;
  for (;;) {
    const { data, error } = await sb
      .from('restaurants')
      .select('id, cuisine, image_url')
      .range(start, start + 999);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;

    const need = rows.filter((r) => !r.image_url || isDead(r.image_url));
    for (const r of need) {
      const image_url = cuisineImage(r.cuisine);
      if (dryRun) {
        restUpdated += 1;
        continue;
      }
      const { error: upErr } = await sb.from('restaurants').update({ image_url }).eq('id', r.id);
      if (upErr) console.error('rest update', r.id, upErr.message);
      else restUpdated += 1;
    }
    if (rows.length < 1000) break;
    start += 1000;
  }

  // Menu items — batch by category for speed
  const categories = Object.keys(CATEGORY_IMAGES).filter((k) => k !== 'default');
  for (const cat of categories) {
    const image_url = categoryImage(cat);
    if (dryRun) {
      const { count } = await sb
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .is('image_url', null)
        .ilike('category', cat);
      menuUpdated += count || 0;
      console.log(`dry menu category=${cat} would update ~${count}`);
      continue;
    }
    // Supabase JS can't UPDATE WHERE null in one shot without filter — page ids
    let mStart = 0;
    for (;;) {
      const { data, error } = await sb
        .from('menu_items')
        .select('id')
        .is('image_url', null)
        .ilike('category', cat)
        .range(mStart, mStart + 499);
      if (error) throw error;
      const ids = (data || []).map((r) => r.id);
      if (!ids.length) break;
      const { error: upErr } = await sb.from('menu_items').update({ image_url }).in('id', ids);
      if (upErr) console.error('menu update', cat, upErr.message);
      else menuUpdated += ids.length;
      if (ids.length < 500) break;
      // keep mStart at 0 — rows no longer match is.null after update
    }
  }

  // Catch-all null category / unmatched
  if (!dryRun) {
    let mStart = 0;
    for (;;) {
      const { data, error } = await sb
        .from('menu_items')
        .select('id, category')
        .is('image_url', null)
        .range(0, 499);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) break;
      // group by resolved URL
      const byUrl = new Map();
      for (const r of rows) {
        const image_url = categoryImage(r.category);
        if (!byUrl.has(image_url)) byUrl.set(image_url, []);
        byUrl.get(image_url).push(r.id);
      }
      for (const [image_url, ids] of byUrl) {
        const { error: upErr } = await sb.from('menu_items').update({ image_url }).in('id', ids);
        if (upErr) console.error('menu catchall', upErr.message);
        else menuUpdated += ids.length;
      }
      if (rows.length < 500) break;
    }
  }

  // Replace dead URLs on menu too
  for (const frag of DEAD_FRAGMENTS) {
    let again = true;
    while (again && !dryRun) {
      const { data, error } = await sb
        .from('menu_items')
        .select('id, category')
        .like('image_url', `%${frag}%`)
        .limit(500);
      if (error) throw error;
      const rows = data || [];
      if (!rows.length) {
        again = false;
        break;
      }
      for (const r of rows) {
        const image_url = categoryImage(r.category);
        await sb.from('menu_items').update({ image_url }).eq('id', r.id);
        menuUpdated += 1;
      }
    }
  }

  console.log(
    dryRun
      ? `dry-run restaurants≈${restUpdated} menu≈${menuUpdated}`
      : `updated restaurants=${restUpdated} menu=${menuUpdated}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
