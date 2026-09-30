#!/usr/bin/env node
/**
 * Batch-embed rows into public.embeddings via Ollama nomic-embed-text.
 *
 *   OLLAMA_BASE_URL=http://127.0.0.1:11434 \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/backfill-embeddings.mjs --source menu_items
 *
 *   node scripts/backfill-embeddings.mjs --source ratings
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

const source = argValue('--source') || 'menu_items';
if (source !== 'menu_items' && source !== 'ratings') {
  console.error('Usage: --source menu_items|ratings');
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

const { data: existingRows, error: exErr } = await db
  .from('embeddings')
  .select('source_id, content_hash')
  .eq('source_table', source);
if (exErr) throw new Error(exErr.message);
const existing = new Map((existingRows || []).map((r) => [r.source_id, r.content_hash]));

let rows = [];
if (source === 'menu_items') {
  const { data, error } = await db.from('menu_items').select('id, name, category, description');
  if (error) throw new Error(error.message);
  rows = data || [];
} else {
  const { data, error } = await db.from('ratings').select('id, comment, food_rating');
  if (error) throw new Error(error.message);
  rows = data || [];
}

console.log(`Backfilling ${source}: ${rows.length} rows…`);
let upserted = 0;
let skipped = 0;

for (const row of rows) {
  const text = source === 'menu_items' ? menuText(row) : ratingText(row);
  if (!text) {
    skipped += 1;
    continue;
  }
  const contentHash = hashContent(text);
  if (existing.get(row.id) === contentHash) {
    skipped += 1;
    continue;
  }
  const embedding = await embedText(text);
  const { error } = await db.from('embeddings').upsert(
    {
      source_table: source,
      source_id: row.id,
      content_hash: contentHash,
      embedding: `[${embedding.join(',')}]`,
    },
    { onConflict: 'source_table,source_id' },
  );
  if (error) throw new Error(error.message);
  upserted += 1;
  if (upserted % 25 === 0) console.log(`  upserted ${upserted}…`);
}

console.log(`Done. total=${rows.length} upserted=${upserted} skipped=${skipped}`);
