#!/usr/bin/env node
/**
 * Batch-embed curated rows into public.embeddings via Ollama qwen3-embedding:0.6b (1024-d).
 *
 *   OLLAMA_BASE_URL=https://ollama.buildyourai.consulting \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/backfill-embeddings.mjs --source all
 *
 * Flags: --source menu_items|ratings|all  --force  --limit N  --concurrency N
 * Menu text: buildMenuItemText (restaurant · dish · category · Veg|Non-veg · tags · description).
 * Ratings: non-empty comments only.
 * Writes content, content_hash, metadata, embedding. Skips unchanged hash unless --force.
 * Resume-safe: upsert only after each Ollama batch succeeds.
 */

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { buildMenuItemText } from '../supabase/functions/_shared/ragText.mjs';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const EMBEDDING_DIMENSIONS = 1024;
const SOURCES = ['menu_items', 'ratings'];
const DEFAULT_CONCURRENCY = 2;
const BATCH_SIZE = 16;

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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function hashContent(text) {
  return createHash('sha256').update(text).digest('hex');
}

function ratingText(row) {
  return row.comment?.trim() || '';
}

function menuMetadata(row) {
  return {
    restaurant_id: row.restaurant_id ?? null,
    category: row.category ?? null,
    is_veg: row.is_veg === true,
    canonical_key: row.canonical_key ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    is_available: row.is_available !== false,
  };
}

function ollamaBase() {
  return (process.env.OLLAMA_BASE_URL || 'https://ollama.buildyourai.consulting').replace(/\/+$/, '');
}

/** Batch embed via Ollama /api/embed with array input. Returns vectors in input order. */
async function embedBatch(texts) {
  if (texts.length === 0) return [];
  const response = await fetch(`${ollamaBase()}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama embed failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const body = await response.json();
  let vectors = null;
  if (Array.isArray(body?.embeddings) && body.embeddings.length === texts.length) {
    vectors = body.embeddings;
  } else if (texts.length === 1 && Array.isArray(body?.embedding)) {
    vectors = [body.embedding];
  }
  if (!vectors || vectors.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${vectors?.length ?? 0}`);
  }
  return vectors.map((vector, i) => {
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-d vector at [${i}], got ${Array.isArray(vector) ? vector.length : 'none'}`,
      );
    }
    return vector.map(Number);
  });
}

const PAGE_SIZE = 1000;

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(error.message);
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadRows(db, source) {
  if (source === 'menu_items') {
    const rows = await fetchAllPages(() =>
      db
        .from('menu_items')
        .select(
          'id, name, category, description, is_veg, is_available, tags, canonical_key, restaurant_id, restaurants(name)',
        )
        .order('id'),
    );
    return {
      rows,
      textOf: (row) => buildMenuItemText(row, row.restaurants),
      metaOf: menuMetadata,
    };
  }
  if (source === 'ratings') {
    const rows = await fetchAllPages(() =>
      db.from('ratings').select('id, comment, food_rating, restaurant_id').order('id'),
    );
    return {
      rows: rows.filter((r) => String(r.comment || '').trim().length > 0),
      textOf: ratingText,
      metaOf: (row) => ({
        restaurant_id: row.restaurant_id ?? null,
        food_rating: row.food_rating ?? null,
      }),
    };
  }
  throw new Error(`Unknown source ${source}`);
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function backfillSource(db, source, opts) {
  const existingRows = await fetchAllPages(() =>
    db.from('embeddings').select('source_id, content_hash').eq('source_table', source).order('source_id'),
  );
  const existing = new Map(existingRows.map((r) => [String(r.source_id), r.content_hash]));

  let { rows, textOf, metaOf } = await loadRows(db, source);
  if (opts.limit != null && opts.limit > 0) {
    rows = rows.slice(0, opts.limit);
  }

  const work = [];
  let skipped = 0;
  for (const row of rows) {
    const text = textOf(row);
    if (!text) {
      skipped += 1;
      continue;
    }
    const contentHash = hashContent(text);
    const sourceId = String(row.id);
    if (!opts.force && existing.get(sourceId) === contentHash) {
      skipped += 1;
      continue;
    }
    work.push({
      sourceId,
      text,
      contentHash,
      metadata: metaOf(row),
    });
  }

  console.log(
    `Backfilling ${source}: candidates=${rows.length} to_embed=${work.length} skipped=${skipped} concurrency=${opts.concurrency}`,
  );

  // Chunk into batches of BATCH_SIZE, then run up to concurrency batches in flight.
  const batches = [];
  for (let i = 0; i < work.length; i += BATCH_SIZE) {
    batches.push(work.slice(i, i + BATCH_SIZE));
  }

  let upserted = 0;
  await mapPool(batches, opts.concurrency, async (batch) => {
    const vectors = await embedBatch(batch.map((b) => b.text));
    for (let i = 0; i < batch.length; i += 1) {
      const item = batch[i];
      const embedding = vectors[i];
      const { error } = await db.from('embeddings').upsert(
        {
          source_table: source,
          source_id: item.sourceId,
          content: item.text,
          content_hash: item.contentHash,
          metadata: item.metadata,
          embedding: `[${embedding.join(',')}]`,
        },
        { onConflict: 'source_table,source_id' },
      );
      if (error) throw new Error(error.message);
      upserted += 1;
    }
    if (upserted % 32 === 0 || upserted === work.length) {
      console.log(`  upserted ${upserted}/${work.length}…`);
    }
  });

  console.log(`Done ${source}. total=${rows.length} upserted=${upserted} skipped=${skipped}`);
  return { total: rows.length, upserted, skipped };
}

const sourceArg = argValue('--source') || 'all';
const sources = sourceArg === 'all' ? SOURCES : [sourceArg];
for (const s of sources) {
  if (!SOURCES.includes(s)) {
    console.error(`Usage: --source ${SOURCES.join('|')}|all [--force] [--limit N] [--concurrency N]`);
    process.exit(1);
  }
}

const force = hasFlag('--force');
const limitRaw = argValue('--limit');
const limit = limitRaw != null ? Number(limitRaw) : null;
if (limitRaw != null && (!Number.isFinite(limit) || limit < 1)) {
  console.error('--limit must be a positive number');
  process.exit(1);
}
const concurrencyRaw = argValue('--concurrency');
const concurrency = concurrencyRaw != null ? Number(concurrencyRaw) : DEFAULT_CONCURRENCY;
if (!Number.isFinite(concurrency) || concurrency < 1) {
  console.error('--concurrency must be a positive number');
  process.exit(1);
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

const opts = { force, limit, concurrency };
const t0 = Date.now();
let grand = { total: 0, upserted: 0, skipped: 0 };
for (const source of sources) {
  const result = await backfillSource(db, source, opts);
  grand.total += result.total;
  grand.upserted += result.upserted;
  grand.skipped += result.skipped;
}
const elapsedMs = Date.now() - t0;
const elapsedSec = elapsedMs / 1000;
console.log(
  `Elapsed ${elapsedSec.toFixed(1)}s for ${grand.upserted} upserted / ${grand.total} candidates (skipped ${grand.skipped}).`,
);
if (grand.upserted > 0) {
  const perItem = elapsedMs / grand.upserted;
  const est20kSec = (perItem * 20000) / 1000;
  const est20kMin = est20kSec / 60;
  console.log(
    `Estimate for 20,000 items: ~${est20kMin.toFixed(1)} min (${est20kSec.toFixed(0)}s) at ${(1000 / perItem).toFixed(2)} items/s.`,
  );
}
if (sources.length > 1) {
  console.log(`All sources. total=${grand.total} upserted=${grand.upserted} skipped=${grand.skipped}`);
}
