#!/usr/bin/env node
/**
 * Part 2 verification checklist (service_role + local Ollama for RAG).
 *
 *   node scripts/verify-intelligence.mjs
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

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

async function embed(text) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const body = await res.json();
  const vector = body?.embeddings?.[0] || body?.embedding;
  if (!Array.isArray(vector) || vector.length !== 768) throw new Error('bad embedding dims');
  return vector;
}

async function verifyRag() {
  const query = 'spicy chicken biryani under 400';
  const vector = await embed(query);
  const { data, error } = await sb.rpc('match_embeddings', {
    query_embedding: `[${vector.join(',')}]`,
    match_count: 5,
    filter_source: ['menu_items'],
  });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data) || data.length === 0) throw new Error('no matches');
  const top = data[0];
  const preview = String(top.preview || '');
  const metaName = top.meta?.name ? String(top.meta.name) : '';
  pass(
    'RAG match_embeddings',
    `top=${metaName || preview.slice(0, 60)} sim=${Number(top.similarity).toFixed(3)} n=${data.length}`,
  );
  return data;
}

async function verifyTicket() {
  const { data: order, error: oErr } = await sb
    .from('orders')
    .select('id, customer_id, status')
    .not('customer_id', 'is', null)
    .limit(1)
    .maybeSingle();
  if (oErr || !order) throw new Error(oErr?.message || 'no orders');

  const { data: ticket, error } = await sb
    .from('support_tickets')
    .insert({
      order_id: order.id,
      customer_id: order.customer_id,
      issue_type: 'never_arrived',
      description: 'Order never arrived and items are missing from the bag.',
      status: 'open',
      urgency: 'high',
    })
    .select('id, urgency, status')
    .single();
  if (error) throw new Error(error.message);
  if (ticket.urgency !== 'high') throw new Error(`expected high urgency, got ${ticket.urgency}`);
  pass('support_tickets insert', `id=${ticket.id} urgency=${ticket.urgency}`);
  return ticket;
}

async function verifyAutoAssign() {
  // Prefer an order we can safely flip: preparing or placed, no rider.
  let { data: order } = await sb
    .from('orders')
    .select('id, status, restaurant_id, rider_id, customer_id')
    .is('rider_id', null)
    .in('status', ['preparing', 'placed'])
    .limit(1)
    .maybeSingle();

  if (!order) {
    // Create a temporary preparing order from an existing one by cloning fields via update on a delivered/cancelled seed if needed — fall back to any without rider.
    const { data: any } = await sb
      .from('orders')
      .select('id, status, restaurant_id, rider_id, customer_id')
      .is('rider_id', null)
      .limit(1)
      .maybeSingle();
    order = any;
  }
  if (!order) throw new Error('no unassigned order found');

  // Ensure at least one online rider with a location near the restaurant.
  const { data: rest } = await sb
    .from('restaurants')
    .select('id, lat, lng')
    .eq('id', order.restaurant_id)
    .maybeSingle();
  if (!rest?.lat || !rest?.lng) throw new Error('restaurant missing lat/lng');

  const { data: rider } = await sb
    .from('profiles')
    .select('id')
    .eq('role', 'rider')
    .limit(1)
    .maybeSingle();
  if (!rider) throw new Error('no rider profile');

  await sb.from('profiles').update({ is_online: true }).eq('id', rider.id);
  // Clear this rider from open assignments so eligibility holds.
  await sb
    .from('orders')
    .update({ rider_id: null })
    .eq('rider_id', rider.id)
    .in('status', ['preparing', 'ready', 'out_for_delivery']);

  await sb.from('rider_locations').upsert(
    {
      rider_id: rider.id,
      lat: rest.lat,
      lng: rest.lng,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'rider_id' },
  );

  // Move to preparing first if needed, then ready (trigger fires on ready transition).
  if (order.status !== 'preparing' && order.status !== 'ready') {
    const { error: e1 } = await sb.from('orders').update({ status: 'preparing' }).eq('id', order.id);
    if (e1) throw new Error(`prep: ${e1.message}`);
  }
  if (order.status === 'ready') {
    // Force a non-ready → ready transition.
    await sb.from('orders').update({ status: 'preparing', rider_id: null }).eq('id', order.id);
  } else {
    await sb.from('orders').update({ rider_id: null }).eq('id', order.id);
  }

  const { error: e2 } = await sb.from('orders').update({ status: 'ready' }).eq('id', order.id);
  if (e2) throw new Error(`ready: ${e2.message}`);

  const { data: after } = await sb
    .from('orders')
    .select('id, rider_id, status')
    .eq('id', order.id)
    .single();

  const { data: ev } = await sb
    .from('automation_events')
    .select('kind, payload')
    .eq('order_id', order.id)
    .eq('kind', 'rider_assigned')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!after?.rider_id) {
    const { data: skip } = await sb
      .from('automation_events')
      .select('kind, payload')
      .eq('order_id', order.id)
      .ilike('kind', 'rider_assign%')
      .order('created_at', { ascending: false })
      .limit(1);
    throw new Error(`rider_id still null; events=${JSON.stringify(skip)}`);
  }
  pass(
    'auto_assign on ready',
    `order=${after.id.slice(0, 8)} rider=${after.rider_id.slice(0, 8)} event=${ev?.kind || 'missing'}`,
  );
}

async function verifyKitchenLoad() {
  // Temporarily lower threshold so seed volume can fire, then restore.
  const { data: prev } = await sb
    .from('automation_config')
    .select('value')
    .eq('key', 'kitchen_open_order_threshold')
    .maybeSingle();

  await sb.from('automation_config').upsert({ key: 'kitchen_open_order_threshold', value: 1 });
  await sb.from('automation_config').upsert({ key: 'kitchen_load_cooldown_minutes', value: 0 });

  // Delete recent cooldown events so the runner is not blocked.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await sb
    .from('automation_events')
    .delete()
    .eq('kind', 'kitchen_load_eta_bump')
    .gte('created_at', since);

  const { data, error } = await sb.rpc('run_kitchen_load_alerts');
  if (error) throw new Error(error.message);

  // Restore config
  if (prev?.value != null) {
    await sb.from('automation_config').upsert({
      key: 'kitchen_open_order_threshold',
      value: prev.value,
    });
  } else {
    await sb.from('automation_config').upsert({ key: 'kitchen_open_order_threshold', value: 8 });
  }
  await sb.from('automation_config').upsert({ key: 'kitchen_load_cooldown_minutes', value: 30 });

  const bumped = data?.orders_bumped ?? 0;
  if (bumped < 1 && (data?.kitchens ?? 0) < 1) {
    throw new Error(`no kitchens bumped: ${JSON.stringify(data)}`);
  }
  pass('kitchen_load ETA bump', JSON.stringify(data));
}

async function main() {
  try {
    await verifyRag();
  } catch (e) {
    fail('RAG match_embeddings', e.message);
  }
  try {
    await verifyTicket();
  } catch (e) {
    fail('support_tickets insert', e.message);
  }
  try {
    await verifyAutoAssign();
  } catch (e) {
    fail('auto_assign on ready', e.message);
  }
  try {
    await verifyKitchenLoad();
  } catch (e) {
    fail('kitchen_load ETA bump', e.message);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
