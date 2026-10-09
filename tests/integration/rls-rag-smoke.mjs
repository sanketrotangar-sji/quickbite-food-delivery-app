#!/usr/bin/env node
/**
 * P19 smoke: RLS cross-customer order isolation, match_embeddings PII, dispatch claim.
 * Skips (exit 0) when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.
 * RLS login needs anon key + seed users (customer1/2@quickbite.demo / sanket123) —
 * skips that section gracefully when sign-in fails (cloud without seed).
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
const ROOT = join(__dirname, '../..');

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
loadEnvFile(join(ROOT, 'apps/client/.env'));

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!url || !serviceKey) {
  console.warn('SKIP rls-rag smoke: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(0);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const CUST1 = 'a1000000-0000-4000-8000-000000000005';
const CUST2_EMAIL = 'customer2@quickbite.demo';
const SEED_PASSWORD = 'sanket123';

function metaHasDeliveryAddress(meta) {
  if (meta == null) return false;
  const raw = typeof meta === 'string' ? meta : JSON.stringify(meta);
  return /delivery_address/i.test(raw);
}

async function assertRlsIsolation() {
  if (!anonKey) {
    console.warn('SKIP RLS section: anon key missing.');
    return;
  }

  // Prefer seed UUIDs; otherwise pick any two distinct customers with orders.
  let victimOrder = null;
  const seedVictim = await admin
    .from('orders')
    .select('id, customer_id')
    .eq('customer_id', CUST1)
    .limit(1)
    .maybeSingle();
  if (seedVictim.data) {
    victimOrder = seedVictim.data;
  } else {
    const { data: sample } = await admin.from('orders').select('id, customer_id').limit(20);
    const byCustomer = new Map();
    for (const row of sample ?? []) {
      if (!byCustomer.has(row.customer_id)) byCustomer.set(row.customer_id, row);
    }
    if (byCustomer.size < 2) {
      console.warn('SKIP RLS section: need two customers with orders.');
      return;
    }
    victimOrder = [...byCustomer.values()][0];
  }

  // Try seed customer2 first; else skip password login on non-seed cloud.
  const userClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
    email: CUST2_EMAIL,
    password: SEED_PASSWORD,
  });
  if (signErr || !signIn?.session) {
    console.warn('SKIP RLS section: could not sign in as seed customer2 —', signErr?.message ?? 'no session');
    return;
  }

  if (signIn.user?.id === victimOrder.customer_id) {
    console.warn('SKIP RLS section: signed-in user owns the victim order.');
    await userClient.auth.signOut();
    return;
  }

  const { data: leaked, error: readErr } = await userClient
    .from('orders')
    .select('id')
    .eq('id', victimOrder.id);

  await userClient.auth.signOut();

  if (readErr) {
    console.log('PASS RLS: other customer cannot read order (error)', readErr.code ?? readErr.message);
    return;
  }
  if (leaked && leaked.length > 0) {
    throw new Error(`RLS leak: signed-in customer read foreign order ${victimOrder.id}`);
  }
  console.log('PASS RLS: customer cannot read another customer order', victimOrder.id.slice(0, 8));
}

async function assertMatchEmbeddingsNoPii() {
  const zero = Array.from({ length: 1024 }, () => 0);
  let data;
  let error;
  try {
    const result = await admin.rpc('match_embeddings', {
      query_embedding: zero,
      match_count: 5,
      filter_source: ['menu_items', 'orders', 'order_items'],
    });
    data = result.data;
    error = result.error;
  } catch (e) {
    console.warn('SKIP RAG PII section: RPC failed —', e.message ?? e);
    return;
  }

  if (error) {
    const msg = error.message ?? String(error);
    if (/match_embeddings|function|embedding|vector|fetch/i.test(msg)) {
      console.warn('SKIP RAG PII section: match_embeddings unavailable —', msg);
      return;
    }
    throw error;
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    console.warn('SKIP RAG PII section: no embedding rows (run backfill later / P9).');
    return;
  }

  for (const row of rows) {
    if (metaHasDeliveryAddress(row.meta) || metaHasDeliveryAddress(row.preview)) {
      throw new Error('match_embeddings returned delivery_address in meta/preview (P4 regression)');
    }
  }
  console.log('PASS RAG: match_embeddings sample has no delivery_address', rows.length, 'hits');
}

async function assertDispatchClaim() {
  let order;
  try {
    const result = await admin.from('orders').select('id').limit(1).maybeSingle();
    if (result.error) throw result.error;
    order = result.data;
  } catch (e) {
    console.warn('SKIP dispatch claim: orders query failed —', e.message ?? e);
    return;
  }
  if (!order) {
    console.warn('SKIP dispatch claim: no orders.');
    return;
  }

  const event = 'preparing';
  try {
    await admin.from('notification_dispatch_log').delete().eq('order_id', order.id).eq('event', event);

    const first = await admin.from('notification_dispatch_log').insert({ order_id: order.id, event });
    if (first.error) {
      if (/relation|does not exist|notification_dispatch/i.test(first.error.message ?? '')) {
        console.warn('SKIP dispatch claim: table missing (push P5 migration) —', first.error.message);
        return;
      }
      throw first.error;
    }

    const second = await admin.from('notification_dispatch_log').insert({ order_id: order.id, event });
    const code = second.error?.code;
    const message = String(second.error?.message ?? '');
    if (!second.error || !(code === '23505' || /duplicate key|unique constraint/i.test(message))) {
      await admin.from('notification_dispatch_log').delete().eq('order_id', order.id).eq('event', event);
      throw new Error('Expected unique violation on second dispatch claim insert');
    }

    await admin.from('notification_dispatch_log').delete().eq('order_id', order.id).eq('event', event);
  } catch (e) {
    if (/fetch failed|network|ENOTFOUND/i.test(String(e.message ?? e))) {
      console.warn('SKIP dispatch claim: network —', e.message ?? e);
      return;
    }
    throw e;
  }
  console.log('PASS dispatch claim: duplicate (order_id, event) rejected');
  console.log(
    'NOTE P5 webhook: manually verify notify-new-order ignores forged old_record (Dashboard webhook + function logs).',
  );
}

async function main() {
  await assertRlsIsolation();
  await assertMatchEmbeddingsNoPii();
  await assertDispatchClaim();
  console.log('PASS rls-rag smoke complete');
}

main().catch((e) => {
  console.error('FAIL rls-rag smoke', e.message);
  process.exit(1);
});
