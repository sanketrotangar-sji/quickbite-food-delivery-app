#!/usr/bin/env node
/**
 * Load synthetic restaurants + menu_items into Supabase (upsert by id).
 * Never deletes. Only writes is_synthetic rows from datagen output.
 *
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/datagen/load.mjs --dry-run
 *   node scripts/datagen/load.mjs --limit 200
 *   node scripts/datagen/load.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { SYNTHETIC_OWNER_EMAIL, SYNTHETIC_OWNER_ID } from './lib/ids.mjs';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT_DIR = join(__dirname, 'out');
const BATCH = 500;
const OWNER_PASSWORD = process.env.SYNTHETIC_OWNER_PASSWORD || 'sanket123';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(join(ROOT, '.env'));
loadEnvFile(join(ROOT, 'apps/manager/.env'));
loadEnvFile(join(ROOT, 'apps/client/.env'));

const url =
  process.env.SUPABASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.VITE_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const DRY = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit'));
let LIMIT = null;
if (limitArg) {
  const eq = limitArg.includes('=') ? limitArg.split('=')[1] : null;
  const idx = process.argv.indexOf('--limit');
  LIMIT = Number(eq || process.argv[idx + 1]);
  if (!Number.isFinite(LIMIT) || LIMIT <= 0) {
    console.error('Invalid --limit');
    process.exit(1);
  }
}

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { transport: WebSocket },
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function ensureOwner() {
  console.log(`Ensuring synthetic owner ${SYNTHETIC_OWNER_EMAIL} (${SYNTHETIC_OWNER_ID})…`);
  if (DRY) {
    console.log('[dry-run] skip auth/profile create');
    return;
  }

  const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  let user = listed?.users?.find((u) => u.id === SYNTHETIC_OWNER_ID || u.email === SYNTHETIC_OWNER_EMAIL);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      id: SYNTHETIC_OWNER_ID,
      email: SYNTHETIC_OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Synthetic Catalog Owner', synthetic: true },
    });
    if (error) {
      // Retry without explicit id if provider rejects custom ids
      const retry = await supabase.auth.admin.createUser({
        email: SYNTHETIC_OWNER_EMAIL,
        password: OWNER_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: 'Synthetic Catalog Owner', synthetic: true },
      });
      if (retry.error) throw new Error(`createUser: ${error.message}; retry: ${retry.error.message}`);
      user = retry.data.user;
      console.warn(
        `WARNING: created owner with id ${user.id} (wanted ${SYNTHETIC_OWNER_ID}). Updating restaurant owner_ids to match.`,
      );
    } else {
      user = data.user;
    }
  }

  const ownerId = user.id;
  const { error: profErr } = await supabase.from('profiles').upsert(
    {
      id: ownerId,
      email: SYNTHETIC_OWNER_EMAIL,
      full_name: 'Synthetic Catalog Owner',
      role: 'restaurant_owner',
    },
    { onConflict: 'id' },
  );
  if (profErr) throw new Error(`profiles upsert: ${profErr.message}`);
  return ownerId;
}

async function upsertBatches(table, rows, onConflict) {
  if (!rows.length) return;
  let done = 0;
  for (const part of chunk(rows, BATCH)) {
    if (DRY) {
      done += part.length;
      console.log(`[dry-run] ${table} would upsert ${part.length} (total ${done}/${rows.length})`);
      continue;
    }
    const { error } = await supabase.from(table).upsert(part, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    done += part.length;
    console.log(`${table}: ${done}/${rows.length}`);
  }
}

function loadJson(name) {
  const p = join(OUT_DIR, name);
  if (!existsSync(p)) {
    console.error(`Missing ${p} — run generate.mjs first`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(p, 'utf8'));
}

async function main() {
  let restaurants = loadJson('restaurants.json');
  let menuItems = loadJson('menu_items.json');

  // Sanity: only synthetic
  restaurants = restaurants.filter((r) => r.is_synthetic === true);
  menuItems = menuItems.filter((m) => m.is_synthetic === true);

  if (LIMIT != null) {
    menuItems = menuItems.slice(0, LIMIT);
    const need = new Set(menuItems.map((m) => m.restaurant_id));
    restaurants = restaurants.filter((r) => need.has(r.id));
    console.log(`--limit ${LIMIT}: ${menuItems.length} menu_items, ${restaurants.length} restaurants`);
  }

  const ownerId = await ensureOwner();
  if (ownerId && ownerId !== SYNTHETIC_OWNER_ID) {
    restaurants = restaurants.map((r) => ({ ...r, owner_id: ownerId }));
  }

  // Strip non-table fields; keep DB columns only
  const restRows = restaurants.map((r) => ({
    id: r.id,
    owner_id: r.owner_id,
    name: r.name,
    description: r.description,
    cuisine: r.cuisine,
    address: r.address,
    phone: r.phone,
    image_url: r.image_url,
    is_open: r.is_open,
    branch_name: r.branch_name,
    lat: r.lat,
    lng: r.lng,
    offer_percent: r.offer_percent,
    prep_minutes: r.prep_minutes,
    capacity_threshold: r.capacity_threshold ?? 8,
    is_synthetic: true,
  }));

  const menuRows = menuItems.map((m) => ({
    id: m.id,
    restaurant_id: m.restaurant_id,
    name: m.name,
    description: m.description,
    price: m.price,
    image_url: m.image_url,
    is_available: m.is_available !== false,
    category: m.category,
    is_veg: !!m.is_veg,
    tags: m.tags,
    canonical_key: m.canonical_key,
    is_synthetic: true,
  }));

  console.log(
    `${DRY ? '[dry-run] ' : ''}Upserting ${restRows.length} restaurants, ${menuRows.length} menu_items (batch ${BATCH})…`,
  );

  await upsertBatches('restaurants', restRows, 'id');
  await upsertBatches('menu_items', menuRows, 'id');

  console.log(DRY ? 'Dry-run complete.' : 'Load complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
