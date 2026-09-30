#!/usr/bin/env node
/**
 * Batch-embed rows into public.embeddings via Ollama nomic-embed-text.
 *
 *   OLLAMA_BASE_URL=http://127.0.0.1:11434 \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/backfill-embeddings.mjs --source menu_items
 *
 * Sources: menu_items | ratings | orders | order_items | order_status_history | all
 *
 * Seed targets ≈ 350 + 450 + 750 + 1900 + ~2200 ≈ 5,650 embedding rows (Assessment 2 RAG ≥5k).
 */

import { createHash } from 'node:crypto';
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
const EMBEDDING_MODEL = 'nomic-embed-text';
const EMBEDDING_DIMENSIONS = 768;

const SOURCES = ['menu_items', 'ratings', 'orders', 'order_items', 'order_status_history'];

function loadEnvFile(path) {
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

loadEnvFile(join(ROOT, '.env'));
loadEnvFile(join(ROOT, 'apps/manager/.env'));
loadEnvFile(join(ROOT, 'apps/client/.env'));

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function hashContent(text) {
  return createHash('sha256').update(text).digest('hex');
}

function menuText(row) {
  return [row.name, row.category, row.description].filter(Boolean).join(' · ').trim();
}

function ratingText(row) {
  const comment = row.comment?.trim();
  if (comment) return comment;
  return `Food rating ${row.food_rating}/5`;
}

function orderText(row) {
  const kitchen = row.restaurants?.name ?? row.restaurant_name ?? '';
  return [
    `Order ${String(row.id).replace(/-/g, '').slice(0, 6)}`,
    row.status,
    kitchen,
    row.delivery_address,
    row.notes,
  ]
    .filter(Boolean)
    .join(' · ')
    .trim();
}

function orderItemText(row) {
  const kitchen = row.orders?.restaurants?.name ?? row.restaurant_name ?? '';
  const status = row.orders?.status ?? '';
  return [row.item_name, `x${row.quantity}`, `₹${row.unit_price}`, kitchen, status]
    .filter(Boolean)
    .join(' · ')
    .trim();
}

function statusHistoryText(row) {
  const kitchen = row.orders?.restaurants?.name ?? '';
  const when = row.changed_at ? String(row.changed_at).slice(0, 16) : '';
  return [`Status ${row.status}`, kitchen, when].filter(Boolean).join(' · ').trim();
}

async function embedText(text) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const response = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama embed failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const body = await response.json();
  const vector = Array.isArray(body?.embeddings?.[0])
    ? body.embeddings[0]
    : Array.isArray(body?.embedding)
      ? body.embedding
      : null;
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-d vector, got ${Array.isArray(vector) ? vector.length : 'none'}`);
  }
  return vector.map(Number);
}

async function loadRows(db, source) {
  if (source === 'menu_items') {
    const { data, error } = await db.from('menu_items').select('id, name, category, description');
    if (error) throw new Error(error.message);
    return { rows: data || [], textOf: menuText };
  }
  if (source === 'ratings') {
    const { data, error } = await db.from('ratings').select('id, comment, food_rating');
    if (error) throw new Error(error.message);
    return { rows: data || [], textOf: ratingText };
  }
  if (source === 'orders') {
    const { data, error } = await db
      .from('orders')
      .select('id, status, delivery_address, notes, restaurants(name)');
    if (error) throw new Error(error.message);
    return { rows: data || [], textOf: orderText };
  }
  if (source === 'order_items') {
    const { data, error } = await db
      .from('order_items')
      .select('id, item_name, quantity, unit_price, orders(status, restaurants(name))');
    if (error) throw new Error(error.message);
    return { rows: data || [], textOf: orderItemText };
  }
  if (source === 'order_status_history') {
    const { data, error } = await db
      .from('order_status_history')
      .select('id, status, changed_at, orders(restaurants(name))');
    if (error) throw new Error(error.message);
    return { rows: data || [], textOf: statusHistoryText };
  }
  throw new Error(`Unknown source ${source}`);
}

async function backfillSource(db, source) {
  const { data: existingRows, error: exErr } = await db
    .from('embeddings')
    .select('source_id, content_hash')
    .eq('source_table', source);
  if (exErr) throw new Error(exErr.message);
  const existing = new Map((existingRows || []).map((r) => [String(r.source_id), r.content_hash]));

  const { rows, textOf } = await loadRows(db, source);
  console.log(`Backfilling ${source}: ${rows.length} rows…`);
  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const text = textOf(row);
    if (!text) {
      skipped += 1;
      continue;
    }
    const contentHash = hashContent(text);
    const sourceId = String(row.id);
    if (existing.get(sourceId) === contentHash) {
      skipped += 1;
      continue;
    }
    const embedding = await embedText(text);
    const { error } = await db.from('embeddings').upsert(
      {
        source_table: source,
        source_id: sourceId,
        content_hash: contentHash,
        embedding: `[${embedding.join(',')}]`,
      },
      { onConflict: 'source_table,source_id' },
    );
    if (error) throw new Error(error.message);
    upserted += 1;
    if (upserted % 25 === 0) console.log(`  upserted ${upserted}…`);
  }

  console.log(`Done ${source}. total=${rows.length} upserted=${upserted} skipped=${skipped}`);
  return { total: rows.length, upserted, skipped };
}

const sourceArg = argValue('--source') || 'menu_items';
const sources = sourceArg === 'all' ? SOURCES : [sourceArg];
for (const s of sources) {
  if (!SOURCES.includes(s)) {
    console.error(`Usage: --source ${SOURCES.join('|')}|all`);
    process.exit(1);
  }
}

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

let grand = { total: 0, upserted: 0, skipped: 0 };
for (const source of sources) {
  const result = await backfillSource(db, source);
  grand.total += result.total;
  grand.upserted += result.upserted;
  grand.skipped += result.skipped;
}
if (sources.length > 1) {
  console.log(`All sources. total=${grand.total} upserted=${grand.upserted} skipped=${grand.skipped}`);
}
