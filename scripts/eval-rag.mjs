#!/usr/bin/env node
/**
 * RAG retrieval evaluation — matching / extreme / noisy query sets.
 * Writes docs/rag/evaluation-report.md (regenerate; do not hand-edit metrics in README).
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'docs/rag/evaluation-report.md');
const QUERIES_PATH = join(ROOT, 'docs/rag/eval-queries.json');

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

const spec = JSON.parse(readFileSync(QUERIES_PATH, 'utf8'));
const K = spec.k ?? 5;

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

async function embed(text) {
  const base = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
  const res = await fetch(`${base}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', input: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}`);
  const body = await res.json();
  const vector = body?.embeddings?.[0] || body?.embedding;
  if (!Array.isArray(vector)) throw new Error('bad embed response');
  return vector;
}

async function retrieve(query) {
  const vector = await embed(query);
  const { data, error } = await sb.rpc('match_embeddings', {
    query_embedding: `[${vector.join(',')}]`,
    match_count: K,
    filter_source: ['menu_items'],
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => String(r.source_id));
}

function metrics(retrieved, expected) {
  const exp = new Set(expected);
  if (exp.size === 0) {
    const hit = retrieved.length === 0 ? 0 : 0;
    return { hitRate: hit, precisionAtK: null, hits: 0 };
  }
  const top = retrieved.slice(0, K);
  const hitsInTop = top.filter((id) => exp.has(id)).length;
  const anyHit = top.some((id) => exp.has(id)) ? 1 : 0;
  return {
    hitRate: anyHit,
    precisionAtK: hitsInTop / K,
    hits: hitsInTop,
  };
}

function avg(rows, key) {
  const vals = rows.map((r) => r[key]).filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

async function evalSet(name, rows, labelLookup) {
  const out = [];
  for (const row of rows) {
    const expected = labelLookup(row);
    const retrieved = await retrieve(row.query);
    const m = metrics(retrieved, expected);
    out.push({ id: row.id, query: row.query, ...m, retrieved: retrieved.slice(0, K), expected });
  }
  return {
    name,
    rows: out,
    avgHitRate: avg(out, 'hitRate'),
    avgPrecision: avg(
      out.filter((r) => r.precisionAtK != null),
      'precisionAtK',
    ),
  };
}

async function main() {
  const byId = new Map(spec.matching.map((q) => [q.id, q]));
  const matching = await evalSet('matching', spec.matching, (r) => r.expected_menu_item_ids);
  const extreme = await evalSet('extreme', spec.extreme, (r) => r.expected_menu_item_ids);
  const noisyRows = spec.noisy.map((n) => ({
    ...n,
    expected_menu_item_ids: byId.get(n.base_query_id)?.expected_menu_item_ids ?? [],
  }));
  const noisy = await evalSet('noisy', noisyRows, (r) => r.expected_menu_item_ids);

  const md = [];
  md.push('# RAG evaluation report');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Model: nomic-embed-text · k=${K}`);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Set | Avg hit-rate@k | Avg precision@k |');
  md.push('|-----|----------------|-----------------|');
  for (const block of [matching, extreme, noisy]) {
    md.push(
      `| ${block.name} | ${(block.avgHitRate * 100).toFixed(1)}% | ${
        block.avgPrecision == null ? 'n/a' : `${(block.avgPrecision * 100).toFixed(1)}%`
      } |`,
    );
  }
  md.push('');
  md.push('## Clean vs noisy delta');
  md.push('');
  md.push(
    `- Matching: hit-rate ${(matching.avgHitRate * 100).toFixed(1)}% → noisy ${(noisy.avgHitRate * 100).toFixed(1)}% (noisy set includes matching-derived queries)`,
  );
  md.push(
    `- Matching precision: ${matching.avgPrecision == null ? 'n/a' : `${(matching.avgPrecision * 100).toFixed(1)}%`} vs noisy ${noisy.avgPrecision == null ? 'n/a' : `${(noisy.avgPrecision * 100).toFixed(1)}%`}`,
  );
  md.push('');
  for (const block of [matching, extreme, noisy]) {
    md.push(`## ${block.name}`);
    md.push('');
    for (const row of block.rows) {
      md.push(`### ${row.id}`);
      md.push(`Query: ${row.query}`);
      md.push(`Hit: ${row.hitRate ? 'yes' : 'no'} · precision@${K}: ${row.precisionAtK == null ? 'n/a' : row.precisionAtK.toFixed(3)}`);
      md.push('');
    }
  }

  writeFileSync(OUT, md.join('\n'), 'utf8');
  console.log(`Wrote ${OUT}`);
  console.log(
    `matching hit=${(matching.avgHitRate * 100).toFixed(1)}% precision=${matching.avgPrecision == null ? 'n/a' : (matching.avgPrecision * 100).toFixed(1) + '%'}`,
  );
  if (matching.avgHitRate < 0.6) {
    console.warn('WARN: matching hit-rate below 60% — refresh labels in docs/rag/eval-queries.json if seed/DB changed');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
