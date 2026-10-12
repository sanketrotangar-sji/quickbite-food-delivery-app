#!/usr/bin/env node
/**
 * A3 RAG eval harness.
 *
 * Modes:
 *   old              → match_embeddings (vector only)
 *   hybrid           → match_embeddings_hybrid
 *   hybrid+filters   → hybrid + is_veg/category when present on the query
 *   hybrid+rerank    → hybrid over-fetch + heuristic re-rank (same blend as Edge)
 *
 * Labels = canonical_key. Hit = any top-k menu_item's canonical_key matches
 * (or slugified name when canonical_key is null).
 *
 * Threshold for out-of-catalog refusal is tuned on the **dev** split only;
 * metrics in the report are on the **test** split.
 *
 * Usage:
 *   node scripts/eval-rag.mjs [--mode=old|hybrid|hybrid+filters|hybrid+rerank] [--all-modes]
 *   npm run rag:eval -- --all-modes
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const QUERIES_PATH = join(ROOT, 'docs/rag-a3/eval-queries.json');
const RESULTS_MD = join(ROOT, 'docs/rag-a3/results.md');
const RESULTS_JSON = join(ROOT, 'docs/rag-a3/results.json');
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const MODES = ['old', 'hybrid', 'hybrid+filters', 'hybrid+rerank'];
const RERANK_FETCH = 20;

/** Keep in sync with supabase/functions/_shared/embeddings.ts heuristicRerank. */
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function heuristicRerank(query, rows, topK) {
  if (!rows.length) return [];
  if (rows.length <= 1) return rows.slice(0, topK);

  const qTokens = new Set(tokenize(query));
  const scores = rows.map((r) => Number(r.score) || 0);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const span = maxS - minS;

  return rows
    .map((r) => {
      const norm = span > 1e-9 ? (Number(r.score) - minS) / span : 1;
      const previewTokens = tokenize(r.preview || '');
      let overlap = 0;
      if (qTokens.size && previewTokens.length) {
        let hit = 0;
        for (const t of previewTokens) {
          if (qTokens.has(t)) hit += 1;
        }
        overlap = hit / qTokens.size;
      }
      return { row: r, blend: 0.55 * norm + 0.45 * Math.min(1, overlap) };
    })
    .sort((a, b) => b.blend - a.blend || b.row.score - a.row.score)
    .slice(0, topK)
    .map((x) => x.row);
}

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

function argValue(flag) {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (hit) return hit.slice(prefix.length);
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

/** Slugify dish name → provisional canonical_key for rows without one. */
function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

/** Normalize canonical_key for comparison (underscore ↔ hyphen). */
function normalizeKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Dish stem: strip style prefixes / plating suffixes so classic_chicken_biryani
 * matches expected chicken_biryani. Do not strip butter- from butter-chicken
 * (prefix only removed when remainder is multi-token).
 */
function dishStem(key) {
  let k = normalizeKey(key).replace(/-(dry|gravy|strong)$/, '');
  const m = k.match(/^(classic|loaded|butter|schezwan|spicy|mini)-(.+)$/);
  if (m && m[2].includes('-')) return m[2];
  return k;
}

function keyMatchesExpected(gotKey, expectedKeys) {
  if (!gotKey || !expectedKeys?.length) return false;
  const gNorm = normalizeKey(gotKey);
  const gStem = dishStem(gotKey);
  for (const exp of expectedKeys) {
    const eNorm = normalizeKey(exp);
    const eStem = dishStem(exp);
    if (gNorm === eNorm) return true;
    if (gStem && eStem && gStem === eStem) return true;
  }
  return false;
}

function pct(n) {
  if (n == null || Number.isNaN(n)) return 'n/a';
  return `${(n * 100).toFixed(1)}%`;
}

function avg(nums) {
  const vals = nums.filter((n) => n != null && !Number.isNaN(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function percentile(sortedAsc, p) {
  if (!sortedAsc.length) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, idx)];
}

function reciprocalRankMatched(keys, expectedKeys) {
  for (let i = 0; i < keys.length; i++) {
    if (keyMatchesExpected(keys[i], expectedKeys)) return 1 / (i + 1);
  }
  return 0;
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) {
  console.error('Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const spec = JSON.parse(readFileSync(QUERIES_PATH, 'utf8'));
const K = spec.k ?? 5;

function ollamaBase() {
  return (process.env.OLLAMA_BASE_URL || 'https://ollama.buildyourai.consulting').replace(/\/+$/, '');
}

/** Batch embed via Ollama /api/embed (same model as RIO). */
async function embedBatch(texts) {
  if (!texts.length) return [];
  const res = await fetch(`${ollamaBase()}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = await res.json();
  let vectors = null;
  if (Array.isArray(body?.embeddings) && body.embeddings.length === texts.length) {
    vectors = body.embeddings;
  } else if (texts.length === 1 && Array.isArray(body?.embedding)) {
    vectors = [body.embedding];
  }
  if (!vectors || vectors.length !== texts.length) {
    throw new Error(`Expected ${texts.length} embeddings, got ${vectors?.length ?? 0}`);
  }
  return vectors;
}

async function embed(text) {
  const [vector] = await embedBatch([text]);
  if (!Array.isArray(vector)) throw new Error('bad embed response');
  return vector;
}

/**
 * Pre-embed all queries once so modes share vectors.
 * Returns { vectors: Map<id, number[]>, embedMs: Map<id, number> }.
 */
async function preEmbedQueries(queries, batchSize = 8) {
  const vectors = new Map();
  const embedMs = new Map();
  for (let i = 0; i < queries.length; i += batchSize) {
    const chunk = queries.slice(i, i + batchSize);
    const t0 = Date.now();
    const batch = await embedBatch(chunk.map((q) => q.query));
    const elapsed = Date.now() - t0;
    const per = Math.round(elapsed / chunk.length);
    for (let j = 0; j < chunk.length; j++) {
      vectors.set(chunk[j].id, batch[j]);
      embedMs.set(chunk[j].id, per);
    }
    console.log(
      `  embedded ${Math.min(i + batchSize, queries.length)}/${queries.length} (${elapsed}ms, ~${per}ms/q)`,
    );
  }
  return { vectors, embedMs };
}

async function loadMenuIndex() {
  const byId = new Map();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from('menu_items')
      .select('id, name, category, is_veg, canonical_key')
      .order('id')
      .range(from, from + PAGE - 1);
    let { data, error } = await q;
    if (error && /canonical_key/.test(error.message || '')) {
      ({ data, error } = await sb
        .from('menu_items')
        .select('id, name, category, is_veg')
        .order('id')
        .range(from, from + PAGE - 1));
    }
    if (error) throw new Error(`menu_items: ${error.message}`);
    const page = data || [];
    for (const row of page) {
      const ck = row.canonical_key || slugifyName(row.name);
      byId.set(String(row.id), {
        id: String(row.id),
        name: row.name,
        category: row.category,
        is_veg: row.is_veg,
        canonical_key: ck,
        has_canonical_column: Boolean(row.canonical_key),
      });
    }
    if (page.length < PAGE) break;
  }
  return byId;
}

async function retrieve(mode, queryRow, vector) {
  if (mode === 'old') {
    const { data, error } = await sb.rpc('match_embeddings', {
      query_embedding: `[${vector.join(',')}]`,
      match_count: K,
      filter_source: ['menu_items'],
    });
    if (error) throw new Error(`match_embeddings: ${error.message}`);
    return (data ?? []).map((r) => ({
      source_id: String(r.source_id),
      vector_similarity: Number(r.similarity ?? 0),
      score: Number(r.similarity ?? 0),
    }));
  }

  const wantRerank = mode === 'hybrid+rerank';
  const args = {
    query_text: queryRow.query,
    query_embedding: `[${vector.join(',')}]`,
    match_count: wantRerank ? RERANK_FETCH : K,
  };
  if (mode === 'hybrid+filters') {
    if (typeof queryRow.is_veg === 'boolean') args.filter_is_veg = queryRow.is_veg;
    if (queryRow.category) args.filter_category = queryRow.category;
  }

  const { data, error } = await sb.rpc('match_embeddings_hybrid', args);
  if (error) throw new Error(`match_embeddings_hybrid: ${error.message}`);
  const mapped = (data ?? []).map((r) => ({
    source_id: String(r.source_id),
    vector_similarity: Number(r.vector_similarity ?? 0),
    score: Number(r.score ?? r.vector_similarity ?? 0),
    preview: String(r.content ?? ''),
  }));
  if (!wantRerank) return mapped.slice(0, K);
  return heuristicRerank(queryRow.query, mapped, K);
}

function scoreRow(queryRow, retrieved, menuById, oocThreshold) {
  const expected = queryRow.expected_canonical_keys ?? [];
  const isOoc = expected.length === 0;
  const keys = retrieved.map((r) => menuById.get(r.source_id)?.canonical_key).filter(Boolean);
  const topSim = retrieved.length ? Number(retrieved[0].vector_similarity ?? 0) : 0;

  if (isOoc) {
    const refused =
      retrieved.length === 0 || (oocThreshold != null && topSim < oocThreshold);
    return {
      hitAt1: null,
      hitAt5: null,
      mrr: null,
      precisionAt5: null,
      oocCorrect: refused ? 1 : 0,
      refused,
      topSim,
      keys,
      expected,
    };
  }

  const hitAt1 = keys[0] && keyMatchesExpected(keys[0], expected) ? 1 : 0;
  const hitAt5 = keys.slice(0, K).some((k) => keyMatchesExpected(k, expected)) ? 1 : 0;
  const mrr = reciprocalRankMatched(keys.slice(0, K), expected);
  const precisionAt5 =
    keys.slice(0, K).filter((k) => keyMatchesExpected(k, expected)).length / K;
  return {
    hitAt1,
    hitAt5,
    mrr,
    precisionAt5,
    oocCorrect: null,
    refused: false,
    topSim,
    keys,
    expected,
  };
}

/**
 * Tune OOC refusal threshold on **dev** only.
 * Maximize Youden J = TPR_ooc − FPR_in_catalog so thr=1.0 cannot game the metric
 * (match_embeddings always returns k rows with sim ≪ 1).
 */
function tuneOocThreshold(devOocRows, devLabeledRows) {
  if (!devOocRows.length) return { threshold: 0.35, devRate: null, youden: null };
  const candidates = new Set([0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
  for (const r of [...devOocRows, ...devLabeledRows]) {
    candidates.add(Number(r.topSim.toFixed(4)));
    candidates.add(Number((r.topSim + 1e-4).toFixed(4)));
  }
  let best = { threshold: 0.35, rate: 0, youden: -Infinity, fpr: 1 };
  for (const t of [...candidates].sort((a, b) => a - b)) {
    if (t <= 0 || t >= 1) continue;
    const tpr =
      devOocRows.filter((r) => r.retrievedCount === 0 || r.topSim < t).length /
      devOocRows.length;
    const fpr = devLabeledRows.length
      ? devLabeledRows.filter((r) => r.retrievedCount > 0 && r.topSim < t).length /
        devLabeledRows.length
      : 0;
    const youden = tpr - fpr;
    if (
      youden > best.youden ||
      (youden === best.youden && tpr > best.rate) ||
      (youden === best.youden && tpr === best.rate && t < best.threshold)
    ) {
      best = { threshold: t, rate: tpr, youden, fpr };
    }
  }
  return { threshold: best.threshold, devRate: best.rate, youden: best.youden };
}

function aggregate(rows, bucketFilter = null) {
  const subset = bucketFilter ? rows.filter((r) => r.bucket === bucketFilter) : rows;
  const labeled = subset.filter((r) => r.hitAt5 != null);
  const ooc = subset.filter((r) => r.oocCorrect != null);
  const lats = subset.map((r) => r.latencyMs).filter((n) => n != null).sort((a, b) => a - b);
  return {
    n: subset.length,
    hitAt1: avg(labeled.map((r) => r.hitAt1)),
    hitAt5: avg(labeled.map((r) => r.hitAt5)),
    mrr: avg(labeled.map((r) => r.mrr)),
    precisionAt5: avg(labeled.map((r) => r.precisionAt5)),
    oocRefusalRate: avg(ooc.map((r) => r.oocCorrect)),
    p50Ms: percentile(lats, 50),
    p95Ms: percentile(lats, 95),
  };
}

async function runMode(mode, queries, menuById, embedCache) {
  console.log(`\n=== mode=${mode} · ${queries.length} queries · model=${EMBEDDING_MODEL} ===`);
  const raw = [];
  const vectors = embedCache?.vectors;
  const embedMs = embedCache?.embedMs;

  for (const q of queries) {
    const t0 = Date.now();
    let retrieved = [];
    let err = null;
    let embedCost = embedMs?.get(q.id) ?? 0;
    try {
      let vector = vectors?.get(q.id);
      if (!vector) {
        const e0 = Date.now();
        vector = await embed(q.query);
        embedCost = Date.now() - e0;
      }
      retrieved = await retrieve(mode, q, vector);
    } catch (e) {
      err = e.message || String(e);
    }
    // End-to-end = amortized embed + retrieval RPC
    const latencyMs = embedCost + (Date.now() - t0);
    const topSim = retrieved.length ? Number(retrieved[0].vector_similarity ?? 0) : 0;
    raw.push({
      ...q,
      retrieved,
      retrievedCount: retrieved.length,
      topSim,
      latencyMs,
      error: err,
    });
    const mark = err ? 'ERR' : 'ok';
    console.log(`  [${mark}] ${q.id} ${q.split}/${q.bucket} ${latencyMs}ms topSim=${topSim.toFixed(3)}`);
    if (err) throw new Error(`${mode} failed on ${q.id}: ${err}`);
  }

  const devOoc = raw.filter((r) => r.split === 'dev' && (r.expected_canonical_keys ?? []).length === 0);
  const devLabeled = raw.filter(
    (r) => r.split === 'dev' && (r.expected_canonical_keys ?? []).length > 0,
  );
  const { threshold, devRate, youden } = tuneOocThreshold(devOoc, devLabeled);

  const scored = raw.map((r) => {
    const m = scoreRow(r, r.retrieved, menuById, threshold);
    const cause = failCause(r, m);
    return {
      id: r.id,
      query: r.query,
      bucket: r.bucket,
      split: r.split,
      latencyMs: r.latencyMs,
      topSim: r.topSim,
      retrievedKeys: m.keys,
      expected: m.expected,
      hitAt1: m.hitAt1,
      hitAt5: m.hitAt5,
      mrr: m.mrr,
      precisionAt5: m.precisionAt5,
      oocCorrect: m.oocCorrect,
      cause,
    };
  });

  const testRows = scored.filter((r) => r.split === 'test');
  const buckets = [...new Set(queries.map((q) => q.bucket))];
  const byBucket = {};
  for (const b of buckets) byBucket[b] = aggregate(testRows, b);

  return {
    mode,
    oocThreshold: threshold,
    oocDevRefusalRate: devRate,
    oocDevYouden: youden,
    test: {
      overall: aggregate(testRows),
      byBucket,
    },
    dev: {
      overall: aggregate(scored.filter((r) => r.split === 'dev')),
    },
    rows: scored,
  };
}

function failCause(queryRow, m) {
  const expected = queryRow.expected_canonical_keys ?? [];
  if (expected.length === 0) {
    if (m.oocCorrect) return null;
    return `OOC leak: returned ${m.keys.slice(0, 3).join(', ') || 'hits'} (topSim=${m.topSim.toFixed(3)})`;
  }
  if (m.hitAt5) return null;
  if (!m.keys.length) return 'empty retrieval';
  return `wanted [${expected.slice(0, 3).join(', ')}] got [${m.keys.slice(0, 3).join(', ')}]`;
}

function worstFails(modeResult, n = 10) {
  const test = modeResult.rows.filter((r) => r.split === 'test');
  const fails = test.filter((r) => {
    if (r.oocCorrect != null) return r.oocCorrect === 0;
    return r.hitAt5 === 0;
  });
  fails.sort((a, b) => {
    const ra = a.mrr == null ? 0 : a.mrr;
    const rb = b.mrr == null ? 0 : b.mrr;
    return ra - rb;
  });
  return fails.slice(0, n);
}

function fmtMs(n) {
  return n == null ? 'n/a' : `${Math.round(n)}ms`;
}

function metricCell(m) {
  if (!m) return 'n/a';
  return [
    `h@1 ${pct(m.hitAt1)}`,
    `h@5 ${pct(m.hitAt5)}`,
    `MRR ${m.mrr == null ? 'n/a' : m.mrr.toFixed(3)}`,
    `p@5 ${pct(m.precisionAt5)}`,
    `ooc ${pct(m.oocRefusalRate)}`,
    `p50 ${fmtMs(m.p50Ms)}`,
    `p95 ${fmtMs(m.p95Ms)}`,
  ].join(' · ');
}

function writeReport(resultsByMode) {
  mkdirSync(dirname(RESULTS_MD), { recursive: true });
  const modes = MODES.filter((m) => resultsByMode[m]);
  const primaryAfter =
    resultsByMode['hybrid+rerank'] ||
    resultsByMode['hybrid+filters'] ||
    resultsByMode.hybrid ||
    null;
  const before = resultsByMode.old;

  const md = [];
  md.push('# A3 RAG eval results');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Model: \`${EMBEDDING_MODEL}\` · k=${K} · labels=\`canonical_key\` (slug fallback)`);
  md.push(`Queries: \`${QUERIES_PATH.replace(ROOT + '/', '')}\` (${spec.queries.length} total, ~50/50 dev/test)`);
  md.push('Metrics below are **test split only**. OOC similarity threshold tuned on **dev** only.');
  md.push('');

  md.push('## Before / after (test overall)');
  md.push('');
  md.push('| Mode | hit@1 | hit@5 | MRR | precision@5 | OOC refusal | p50 | p95 | OOC thr (dev) |');
  md.push('|------|------:|------:|----:|------------:|------------:|----:|----:|--------------:|');
  for (const mode of modes) {
    const r = resultsByMode[mode];
    const o = r.test.overall;
    md.push(
      `| ${mode} | ${pct(o.hitAt1)} | ${pct(o.hitAt5)} | ${o.mrr == null ? 'n/a' : o.mrr.toFixed(3)} | ${pct(o.precisionAt5)} | ${pct(o.oocRefusalRate)} | ${fmtMs(o.p50Ms)} | ${fmtMs(o.p95Ms)} | ${r.oocThreshold.toFixed(4)} |`,
    );
  }
  if (!primaryAfter) {
    md.push('');
    md.push(
      '_Note: hybrid RPC not available in this run — after column limited to modes that succeeded. Apply `20261009010000_rag_hybrid_a3.sql` then re-run `--all-modes`._',
    );
  }
  md.push('');

  md.push('## Per-bucket (test)');
  md.push('');
  for (const mode of modes) {
    const r = resultsByMode[mode];
    md.push(`### ${mode}`);
    md.push('');
    md.push('| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |');
    md.push('|--------|--:|------:|------:|----:|----:|----:|');
    for (const [b, m] of Object.entries(r.test.byBucket)) {
      md.push(
        `| ${b} | ${m.n} | ${pct(m.hitAt1)} | ${pct(m.hitAt5)} | ${m.mrr == null ? 'n/a' : m.mrr.toFixed(3)} | ${pct(m.precisionAt5)} | ${pct(m.oocRefusalRate)} |`,
      );
    }
    md.push('');
  }

  const failSource = primaryAfter || before;
  if (failSource) {
    md.push('## 10 worst failing queries (test)');
    md.push('');
    md.push(
      `Mode: **${failSource.mode}** (preferred after = hybrid+rerank → hybrid+filters → hybrid → old).`,
    );
    md.push('');
    const worst = worstFails(failSource, 10);
    if (!worst.length) {
      md.push('_No test failures._');
    } else {
      worst.forEach((w, i) => {
        md.push(`${i + 1}. \`${w.id}\` _${w.query}_ — ${w.cause}`);
      });
    }
    md.push('');
  }

  md.push('## Method notes');
  md.push('');
  md.push('- Hit = any top-k result’s `canonical_key` ∈ expected (else slugified `menu_items.name`).');
  md.push(
    '- `old` = `match_embeddings`; `hybrid` / `hybrid+filters` / `hybrid+rerank` = `match_embeddings_hybrid` (rerank over-fetches then heuristic blend; RIO also tries LLM re-rank with this fallback).',
  );
  md.push('- Corpus frozen at current menu embeddings (no further synthetic backfill for T4).');
  md.push('- OOC correct = empty result **or** top `vector_similarity` < threshold tuned on **dev** (Youden: OOC TPR − in-catalog FPR).');
  md.push(`- Summary line: before=${before ? metricCell(before.test.overall) : 'n/a'}; after=${primaryAfter ? metricCell(primaryAfter.test.overall) : 'n/a'}.`);
  md.push('');

  writeFileSync(RESULTS_MD, md.join('\n'), 'utf8');
  writeFileSync(
    RESULTS_JSON,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        embedding_model: EMBEDDING_MODEL,
        k: K,
        modes: resultsByMode,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nWrote ${RESULTS_MD}`);
  console.log(`Wrote ${RESULTS_JSON}`);
}

async function main() {
  const allModes = hasFlag('--all-modes');
  const modeArg = argValue('--mode') || 'old';
  const modes = allModes ? MODES : [modeArg];
  for (const m of modes) {
    if (!MODES.includes(m)) {
      console.error(`Unknown mode ${m}. Use: ${MODES.join(' | ')}`);
      process.exit(1);
    }
  }

  console.log(`Loading menu index…`);
  const menuById = await loadMenuIndex();
  console.log(`menu_items indexed: ${menuById.size}`);

  const queries = spec.queries;
  console.log(`Pre-embedding ${queries.length} queries (qwen3, shared across modes)…`);
  const embedCache = await preEmbedQueries(queries);
  const resultsByMode = {};

  for (const mode of modes) {
    try {
      resultsByMode[mode] = await runMode(mode, queries, menuById, embedCache);
      const o = resultsByMode[mode].test.overall;
      console.log(
        `TEST ${mode}: hit@1=${pct(o.hitAt1)} hit@5=${pct(o.hitAt5)} MRR=${o.mrr?.toFixed(3)} p@5=${pct(o.precisionAt5)} ooc=${pct(o.oocRefusalRate)} thr=${resultsByMode[mode].oocThreshold.toFixed(4)}`,
      );
    } catch (e) {
      console.error(`Mode ${mode} aborted: ${e.message}`);
      if (!allModes) throw e;
    }
  }

  if (Object.keys(resultsByMode).length) writeReport(resultsByMode);
  else process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
