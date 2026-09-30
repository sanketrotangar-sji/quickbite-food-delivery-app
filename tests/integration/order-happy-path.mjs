#!/usr/bin/env node
/**
 * Service-role integration: order → ready → auto rider → delivered → rating.
 * Skips (exit 0) when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing.
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

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.warn('SKIP integration: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for full happy-path test.');
  process.exit(0);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: order } = await sb
    .from('orders')
    .select('id, customer_id, restaurant_id, status, rider_id')
    .is('rider_id', null)
    .in('status', ['placed', 'preparing'])
    .limit(1)
    .maybeSingle();

  if (!order) {
    throw new Error('No suitable order fixture');
  }

  const { data: rest } = await sb.from('restaurants').select('lat, lng').eq('id', order.restaurant_id).single();
  const { data: rider } = await sb.from('profiles').select('id').eq('role', 'rider').limit(1).maybeSingle();
  if (!rider || !rest?.lat) throw new Error('Missing rider or restaurant coordinates');

  await sb.from('profiles').update({ is_online: true }).eq('id', rider.id);
  await sb.from('orders').update({ rider_id: null }).eq('rider_id', rider.id).in('status', ['preparing', 'ready', 'out_for_delivery']);
  await sb.from('rider_locations').upsert(
    { rider_id: rider.id, lat: rest.lat, lng: rest.lng, updated_at: new Date().toISOString() },
    { onConflict: 'rider_id' },
  );

  if (order.status !== 'preparing') {
    await sb.from('orders').update({ status: 'preparing', rider_id: null }).eq('id', order.id);
  } else {
    await sb.from('orders').update({ rider_id: null }).eq('id', order.id);
  }

  const { error: readyErr } = await sb.from('orders').update({ status: 'ready' }).eq('id', order.id);
  if (readyErr) throw readyErr;

  const { data: afterReady } = await sb.from('orders').select('rider_id, status').eq('id', order.id).single();
  if (!afterReady?.rider_id) throw new Error('Auto-assign did not set rider_id');

  const { data: assignEvent } = await sb
    .from('automation_events')
    .select('kind')
    .eq('order_id', order.id)
    .eq('kind', 'rider_assigned')
    .limit(1)
    .maybeSingle();
  if (!assignEvent) throw new Error('Missing rider_assigned automation event');

  await sb.from('orders').update({ status: 'out_for_delivery' }).eq('id', order.id);
  await sb.from('orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', order.id);

  const { error: ratingErr } = await sb.from('ratings').upsert(
    {
      order_id: order.id,
      customer_id: order.customer_id,
      restaurant_id: order.restaurant_id,
      food_rating: 5,
      delivery_rating: 5,
      comment: 'Integration test rating',
    },
    { onConflict: 'order_id' },
  );
  if (ratingErr) throw ratingErr;

  const { data: notices } = await sb
    .from('notifications')
    .select('title')
    .eq('user_id', order.customer_id)
    .ilike('title', '%Rider assigned%')
    .limit(1);
  if (!notices?.length) throw new Error('Customer did not receive rider assigned notification');

  console.log('PASS integration order happy path', order.id.slice(0, 8));
}

main().catch((e) => {
  console.error('FAIL integration', e.message);
  process.exit(1);
});
