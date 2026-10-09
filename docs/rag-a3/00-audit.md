# A3 RAG — Phase 0a audit

**Date:** 2026-10-09  
**Scope:** read-only code + cloud DB probe. No index/schema/data changes.  
**DB:** cloud Supabase (day-to-day SoT).  
**Restored:** `docs/rag/` from git HEAD (was missing on disk after docs cleanup).

---

## Snapshot (live cloud)

| Metric | Value |
|--------|--------|
| `menu_items` | **388** |
| `restaurants` | **43** |
| `embeddings` total | **388** |
| `embeddings` where `source_table='menu_items'` | **388** |
| `embeddings` where `source_table='ratings'` | **0** |
| Eval label UUIDs in `eval-queries.json` | **19** unique |
| Labels found in `menu_items` | **19 / 19** (0 dead) |
| `embeddings.content` / `metadata` / `fts` | **missing** (`column embeddings.content does not exist`) |
| `menu_items` id+name checksum (sha256) | `0b4f66fb933b73c60b06708dcc6bc31756ae72505d0ac87c63f784eca5a34e0a` |
| Embedding rows `created_at` sample | 2026-10-08 (post qwen migration backfill) |

Gold **name** coverage (ilike `%…%` on `menu_items.name`):

| Query fragment | Count |
|----------------|------:|
| Masala Dosa | 5 |
| Chicken Biryani | 1 |
| Chilli paneer | 1 |
| Filter Coffee | 9 |
| Ukadiche Modak | 1 |
| Kothimbir Vadi | 1 |
| Margherita | 7 |
| Kingfish | 1 |

---

## Code map (what retrieval actually does)

### `public.embeddings`

Defined in `supabase/migrations/20260929140000_llm_config_and_embeddings.sql`; vector widened to **1024** in `20261008130000_embeddings_qwen_1024.sql`.

Columns today: `id`, `source_table`, `source_id`, `content_hash`, `embedding vector(1024)`, `created_at`. Unique `(source_table, source_id)`. RLS on; **no** anon/authenticated policies; service_role + `match_embeddings` only.

HNSW index: **`embeddings_embedding_hnsw`** already exists (cosine ops). Do **not** create a second HNSW in Phase 5.

### `match_embeddings(query_embedding vector(1024), match_count int, filter_source text[])`

- `security definer`, `search_path = public, extensions`
- Grants: `authenticated`, `service_role`
- Caps `match_count` at **20**
- **Vector-only** cosine (`<=>`); over-fetches `match_count * 4` then joins live `menu_items` / `ratings`
- Returns: `source_table`, `source_id`, `similarity`, `preview`, `meta` (jsonb with name, category, price, is_veg, is_available, restaurant_*, cuisine for menu)
- Curated sources only in join filter: `menu_items` + comment `ratings` (no orders / addresses)

### Backfill — `scripts/backfill-embeddings.mjs`

- Model: **`qwen3-embedding:0.6b`**, 1024-d
- Menu text: `restaurants.name · name · category · description` (**no** veg/tags/intent)
- Ratings: comment only if non-empty
- Idempotent on `content_hash`; upsert on `(source_table, source_id)`
- Does **not** store `content` or `metadata` on the row

### Eval — `scripts/eval-rag.mjs` + `docs/rag/eval-queries.json`

- Embeds query with **qwen3** (script was updated; A2 **report** still says nomic)
- Calls `match_embeddings` with `filter_source: ['menu_items']`, **k=5**
- Hit = any top-k `source_id` ∈ `expected_menu_item_ids`
- Empty expected (out-of-catalog): current code always scores **hitRate 0** even if retrieval returns noise — cannot reward refusal

### RIO — `retrieveContextTool` in `supabase/functions/rio/tools.ts`

- Args: `{ query, top_k }` only (no `is_veg` / `category` filters)
- Fetches up to `min(top_k*2, 20)` via `retrieveContext` → `match_embeddings` with `['menu_items','ratings']`
- Post-filters **unavailable** menu items; diversifies max **2** dishes per restaurant; returns up to `top_k` (default 8, cap 12)
- No low-confidence / empty-corpus refusal path beyond “No RAG hits” instruction when count=0

---

## Label quality (live names for matching set)

UUIDs exist, but many gold IDs are **not the queried dish**:

| ID | Query | Expected rows (live names) | Verdict |
|----|-------|----------------------------|---------|
| m1 | Masala Dosa | Masala Dosa, **Bharli Vangi + Bhakri**, **Zunka Bhakri** | 2/3 wrong |
| m2 | Chicken Biryani | Chicken Biryani | OK |
| m3 | Chilli paneer dry | Chilli paneer dry, **Kothimbir Vadi**, **Chicken Tikka** | 2/3 wrong |
| m4 | Filter Coffee | Filter Coffee, Cold Brew Coffee ×2 | loose |
| m5 | Ukadiche Modak | Ukadiche Modak, **Tiramisu cup**, **Bebinca slice** | 2/3 wrong |
| m6 | Kothimbir Vadi | Kothimbir Vadi, **Chicken Tikka**, **Solantulem salad** | 2/3 wrong |
| m7 | Margherita | Margherita, **Pepperoni** | 1/2 wrong |
| m8 | Kingfish curry | Kingfish curry, **Chicken manchurian**, **Prawn recheado** | 2/3 wrong |

So A2 “misses” on exact dish names can be **scoring artifacts** (wrong gold IDs) and/or true retrieval misses — Phase 0b must re-bind before trusting a before-number.

---

## I1–I8 verdicts

| # | Issue | Verdict | Evidence |
|---|--------|---------|----------|
| **I1** | 37.5% may not be a true retrieval number | **CONFIRMED (with nuance)** | A2 report: `nomic-embed-text` (`docs/rag/evaluation-report.md`). Live index: qwen3 1024-d (migration + backfill 2026-10-08). Labels: **0 dead UUIDs**, but **majority of multi-ID gold sets include wrong dishes**. Model mismatch + dirty labels both inflate/deflate hit-rate. |
| **I2** | Single-UUID / fixed-UUID gold breaks at 20K | **CONFIRMED** | Already multiple Masala Dosa (5) / Margherita (7) / Filter Coffee (9). UUID-set scoring cannot scale; need **`canonical_key`** (Phase 3/5). |
| **I3** | Embedded text lacks intent signal | **CONFIRMED** | Builder only kitchen·name·category·description (`backfill-embeddings.mjs` `menuText`). No veg/tags/mood words. |
| **I4** | Vector-only search | **CONFIRMED** | `match_embeddings` orders solely by `embedding <=> query`. No FTS/trigram. |
| **I5** | No metadata filters in retrieval RPC | **PARTIALLY CONFIRMED** | RPC returns `is_veg`/`category`/`is_available` in `meta` but does not filter. RIO post-filters **availability** only (`tools.ts`). No veg/category args on the tool. |
| **I6** | Restaurant/cuisine not first-class in index | **PARTIALLY CONFIRMED** | `restaurants.cuisine` exists and is in RPC `meta`, but **no** `source_table='restaurants'` embeddings. “Chinese places” depends on menu text / join meta, not a restaurant chunk. |
| **I7** | No stored content; no FTS/trgm | **CONFIRMED** | Select of `content` fails. No `pg_trgm` / `tsvector` usage on embeddings in migrations. HNSW **does** exist (brief was wrong to imply zero ANN index). |
| **I8** | No out-of-catalog handling | **CONFIRMED** | Zero-vector smoke still returns top-2 menu previews. Eval empty-label queries always count as miss; no score threshold / empty return contract. |

---

## Conflicts with the Cursor brief (carry into later phases)

1. **HNSW already present** — Phase 5 = `ANALYZE` / optional `REINDEX`, not a second index name.
2. **`menu_items_restaurant_idx` already exists** — skip recreating.
3. **Phase 0a vs 0b** — this file is audit only; baseline rebind + eval is **0b**.
4. **Labels are live but dirty** — 0b must fix gold by **dish name → current IDs** (or provisional canonical keys), not assume dead-UUID problem.
5. **Owner FK for synthetics** — `owner_id` NOT NULL; one-owner-many-restaurants OK (`restaurants_one_per_owner` dropped). Still need a real `profiles` row + non-null `address`.

---

## Recommended Phase 0b (do not run until you say go)

1. Re-bind `matching` / `e3` expected IDs: for each query, take live `menu_items` whose `name` matches the dish (case-insensitive / normalized), optionally limit to exact name for gold dishes.
2. Keep extreme empty-label queries as out-of-catalog **but note** current metric cannot score refusal correctly — document as limitation until Phase 5 eval rewrite.
3. Run `npm run rag:eval` against **unchanged** 388-row qwen index.
4. Save machine-readable output to `docs/rag-a3/baseline-v0.json` (and leave A2 37.5% as historical footnote).

---

## Phase 0b follow-up (done)

- A2 labels archived: `docs/rag-a3/eval-queries.a2-labels.bak.json`
- Rebind report: `docs/rag-a3/rebind-0b-report.json`
- Honest baseline: **`docs/rag-a3/baseline-v0.json`**
- Matching hit@5 on rebound labels + unchanged qwen index: **50.0%** (precision@5 **20.0%**). A2 37.5% kept as historical footnote only.

---

## STOP

Phase **0a** + **0b** complete for baseline. Waiting for **`go Phase 1`** (migration SQL review only).
