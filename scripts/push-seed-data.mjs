#!/usr/bin/env node
/**
 * Push generated seed bundle into Supabase (additive, resumable).
 *
 * Skips the seed admin user — uses the existing profiles.role = 'admin' for
 * applications.reviewed_by instead.
 *
 * Requires:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run seed:push
 *   npm run seed:push -- --resume     # skip auth recreate; finish remaining rows
 *   npm run seed:push -- --dry-run
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
const DEFAULT_BUNDLE = join(ROOT, 'supabase/seed-data/generated/seed-bundle.json');

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
const bundlePath = process.env.SEED_BUNDLE?.trim() || DEFAULT_BUNDLE;
const DRY = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');
const CONCURRENCY = Number(process.env.SEED_CONCURRENCY || (RESUME ? 2 : 3));

if (!url || !serviceKey) {
  console.error(`Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY`);
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransient(err) {
  const msg = String(err?.message || err || '');
  return /522|521|520|timeout|fetch failed|ECONNRESET|ETIMEDOUT|503|502|429|<!DOCTYPE html>/i.test(
    msg,
  );
}

async function withRetry(label, fn, attempts = 6) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === attempts) throw err;
      const wait = Math.min(30000, 1000 * 2 ** (i - 1));
      console.warn(`  retry ${i}/${attempts} ${label} after ${wait}ms — ${String(err.message || err).slice(0, 80)}`);
      await sleep(wait);
    }
  }
  throw last;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function upsertBatches(table, rows, onConflict, batchSize = 80) {
  if (!rows.length) return;
  for (const part of chunk(rows, batchSize)) {
    await withRetry(`${table} upsert`, async () => {
      const { error } = await supabase.from(table).upsert(part, { onConflict, ignoreDuplicates: false });
      if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    });
  }
}

/** Insert rows; on unique violation, fall back to per-row upsert/skip. */
async function insertOrSkipBatches(table, rows, conflictCols, batchSize = 80) {
  if (!rows.length) return;
  for (const part of chunk(rows, batchSize)) {
    const { error } = await supabase.from(table).insert(part);
    if (!error) continue;
    if (!/duplicate|unique|already exists|23505/i.test(error.message)) {
      throw new Error(`${table} insert failed: ${error.message}`);
    }
    // Resume path: upsert one-by-one / small batches
    await upsertBatches(table, part, conflictCols, Math.min(25, part.length));
  }
}

async function ensureAuthUser(user) {
  const { data, error } = await supabase.auth.admin.createUser({
    id: user.id,
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      full_name: user.full_name,
      role: 'customer',
    },
  });

  if (!error) return { id: data.user.id, created: true };

  const msg = error.message || String(error);
  if (/already|registered|exists/i.test(msg)) {
    const { data: listed, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw new Error(`listUsers after conflict for ${user.email}: ${listErr.message}`);
    const found = (listed?.users || []).find((u) => u.email?.toLowerCase() === user.email.toLowerCase());
    if (!found) throw new Error(`User ${user.email} exists but could not be listed.`);
    if (found.id !== user.id) {
      throw new Error(
        `Email ${user.email} already exists with id ${found.id}, but seed expects ${user.id}.`,
      );
    }
    return { id: found.id, created: false };
  }

  throw new Error(`createUser ${user.email}: ${msg}`);
}

async function syncProfile(user) {
  const patch = {
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    is_online: Boolean(user.is_online),
    vehicle_label: user.vehicle_label,
    plate: user.plate,
  };
  await withRetry(`profile ${user.email}`, async () => {
    const { error } = await supabase.from('profiles').upsert({ id: user.id, ...patch }, { onConflict: 'id' });
    if (error) throw new Error(`profiles upsert ${user.email}: ${error.message}`);
  });

  await supabase.from('user_roles').delete().eq('user_id', user.id);
  const { error: urErr } = await supabase.from('user_roles').insert({
    user_id: user.id,
    role: user.role,
  });
  if (urErr && !/duplicate|23505/i.test(urErr.message)) {
    throw new Error(`user_roles ${user.email}: ${urErr.message}`);
  }
}

async function walkOrderStatus(order) {
  const path = order.status_path?.length ? order.status_path : [order.status];

  const { data: current, error: readErr } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', order.id)
    .maybeSingle();
  if (readErr) throw new Error(`order read ${order.id}: ${readErr.message}`);
  if (!current) throw new Error(`order missing ${order.id}`);

  let startIdx = path.indexOf(current.status);
  if (startIdx < 0) startIdx = 0;
  // If already at final, done.
  if (current.status === path[path.length - 1]) return;

  for (let i = startIdx + 1; i < path.length; i += 1) {
    const status = path[i];
    const patch = { status };
    if (status === 'out_for_delivery' || status === 'delivered') {
      if (order.rider_id) patch.rider_id = order.rider_id;
    }
    if (status === 'delivered') {
      patch.delivered_at = order.delivered_at;
      if (order.rider_earning != null) patch.rider_earning = order.rider_earning;
      if (order.tip_amount != null) patch.tip_amount = order.tip_amount;
      if (order.bonus_amount != null) patch.bonus_amount = order.bonus_amount;
      if (order.pickup_km != null) patch.pickup_km = order.pickup_km;
      if (order.drop_km != null) patch.drop_km = order.drop_km;
      if (order.eta_minutes != null) patch.eta_minutes = order.eta_minutes;
    }
    await withRetry(`order ${order.id} → ${status}`, async () => {
      const { error } = await supabase.from('orders').update(patch).eq('id', order.id);
      if (error) throw new Error(`order status ${order.id} → ${status}: ${error.message}`);
    });
    await sleep(15); // gentle pacing against gateway timeouts
  }
}

async function main() {
  console.log(`Loading ${bundlePath}`);
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));

  const seedAdmin = (bundle.auth_users || []).find((u) => u.role === 'admin');
  const users = (bundle.auth_users || []).filter((u) => u.role !== 'admin');
  console.log(
    `Users: ${users.length} (skipped seed admin${seedAdmin ? ` ${seedAdmin.email}` : ''})${RESUME ? ' [resume]' : ''}`,
  );

  const { data: existingAdmins, error: adminErr } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'admin')
    .limit(5);
  if (adminErr) throw new Error(`Could not load existing admin: ${adminErr.message}`);
  if (!existingAdmins?.length) {
    throw new Error('No existing admin profile found (profiles.role = admin).');
  }
  const existingAdmin = existingAdmins[0];
  console.log(`Using existing admin: ${existingAdmin.email || existingAdmin.id}`);

  if (DRY) {
    console.log('--dry-run: stopping before writes');
    return;
  }

  // Auto-resume if seed restaurants already present
  let resume = RESUME;
  if (!resume) {
    const sampleId = bundle.restaurants[0]?.id;
    if (sampleId) {
      const { data } = await supabase.from('restaurants').select('id').eq('id', sampleId).maybeSingle();
      if (data?.id) {
        resume = true;
        console.log('Detected existing seed restaurants — continuing in resume mode.');
      }
    }
  }

  if (!resume) {
    console.log('Creating auth users…');
    let created = 0;
    let reused = 0;
    await mapPool(users, CONCURRENCY, async (user) => {
      const result = await withRetry(`auth ${user.email}`, () => ensureAuthUser(user));
      if (result.created) created += 1;
      else reused += 1;
      await syncProfile(user);
      if ((created + reused) % 20 === 0) {
        console.log(`  auth progress ${created + reused}/${users.length}`);
      }
    });
    console.log(`Auth done. created=${created} reused=${reused}`);
  } else {
    console.log('Resume: syncing profile roles only…');
    await mapPool(users, CONCURRENCY, async (user) => {
      await syncProfile(user);
    });
  }

  console.log('Upserting restaurants…');
  await upsertBatches('restaurants', bundle.restaurants, 'id', 40);

  console.log('Upserting restaurant_members…');
  await upsertBatches(
    'restaurant_members',
    bundle.restaurant_members,
    'restaurant_id,user_id',
    40,
  );

  console.log('Upserting menu_items…');
  await upsertBatches('menu_items', bundle.menu_items, 'id', 80);

  console.log('Upserting customer_addresses…');
  await upsertBatches('customer_addresses', bundle.customer_addresses, 'id', 80);

  console.log('Upserting orders (initial / existing)…');
  const orderRows = bundle.orders.map((o) => {
    const first = o.status_path?.[0] || 'placed';
    return {
      id: o.id,
      customer_id: o.customer_id,
      restaurant_id: o.restaurant_id,
      // Do not force rider/status backward on resume — walkOrderStatus advances.
      status: first,
      total_amount: o.total_amount,
      delivery_fee: o.delivery_fee,
      delivery_address: o.delivery_address,
      delivery_lat: o.delivery_lat,
      delivery_lng: o.delivery_lng,
      delivery_address_id: o.delivery_address_id,
      notes: o.notes,
      placed_at: o.placed_at,
      tip_amount: o.tip_amount ?? 0,
      bonus_amount: o.bonus_amount ?? 0,
    };
  });
  // On resume, upsert would reset status to 'placed' — only insert-or-skip.
  await insertOrSkipBatches('orders', orderRows, 'id', 50);

  console.log('Upserting order_items…');
  await upsertBatches(
    'order_items',
    bundle.order_items.map((oi) => ({
      id: oi.id,
      order_id: oi.order_id,
      menu_item_id: oi.menu_item_id,
      item_name: oi.item_name,
      quantity: oi.quantity,
      unit_price: oi.unit_price,
    })),
    'id',
    100,
  );

  console.log('Walking order statuses…');
  let walked = 0;
  await mapPool(bundle.orders, CONCURRENCY, async (order) => {
    await walkOrderStatus(order);
    walked += 1;
    if (walked % 50 === 0) console.log(`  status progress ${walked}/${bundle.orders.length}`);
  });

  console.log('Upserting ratings…');
  await upsertBatches('ratings', bundle.ratings, 'id', 80);

  console.log('Upserting notifications…');
  const notifications = (bundle.notifications || []).filter(
    (n) => !seedAdmin || n.user_id !== seedAdmin.id,
  );
  await upsertBatches('notifications', notifications, 'id', 80);

  console.log('Upserting home_highlights…');
  await upsertBatches('home_highlights', bundle.home_highlights, 'id', 20);

  console.log('Upserting applications…');
  const applications = (bundle.applications || []).map((a) => ({
    ...a,
    reviewed_by:
      a.reviewed_by && seedAdmin && a.reviewed_by === seedAdmin.id
        ? existingAdmin.id
        : a.reviewed_by,
  }));
  await upsertBatches('applications', applications, 'id', 40);

  console.log('Upserting manager_invites…');
  await upsertBatches('manager_invites', bundle.manager_invites, 'id', 40);

  console.log('Upserting cart_items…');
  await upsertBatches('cart_items', bundle.cart_items, 'id', 40);

  console.log('Upserting rider_locations…');
  await upsertBatches('rider_locations', bundle.rider_locations, 'rider_id', 40);

  // Verify seed order status distribution
  const seedOrderIds = bundle.orders.map((o) => o.id);
  const statusCounts = {};
  for (const part of chunk(seedOrderIds, 100)) {
    const { data, error } = await supabase.from('orders').select('status').in('id', part);
    if (error) throw new Error(`verify orders: ${error.message}`);
    for (const row of data || []) {
      statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    }
  }

  const { count: ratingCount } = await supabase
    .from('ratings')
    .select('id', { count: 'exact', head: true })
    .in(
      'id',
      bundle.ratings.slice(0, 200).map((r) => r.id),
    );

  console.log(`
Seed push complete.
  auth users (non-admin): ${users.length}
  restaurants: ${bundle.restaurants.length}
  menu_items: ${bundle.menu_items.length}
  orders: ${bundle.orders.length}
  seed order statuses: ${JSON.stringify(statusCounts)}
  ratings sample present: ${ratingCount ?? 0}
  existing admin kept: ${existingAdmin.email || existingAdmin.id}
  sample owner login: aarav@quickbite.test / sanket123
`);
}

main().catch((err) => {
  console.error('\nSeed push failed:', err.message || err);
  process.exit(1);
});
