# Phase 1 — migration review (not applied yet)

**File:** `supabase/migrations/20261009010000_rag_hybrid_a3.sql`  
**Status:** drafted only — **not applied** to local or cloud.

## What it does

| Change | Notes |
|--------|--------|
| `menu_items.tags text[]` | default `{}` |
| `menu_items.canonical_key text` | nullable until datagen/backfill |
| `menu_items.is_synthetic boolean` | default `false` (real rows stay false) |
| `restaurants.is_synthetic boolean` | default `false` |
| `embeddings.content text` | nullable until Phase 2 re-backfill |
| `embeddings.metadata jsonb` | default `{}` |
| `embeddings.fts` | generated `tsvector` from `content` |
| GIN indexes | `fts`, trigram on `content`, `metadata` |
| `menu_items_canonical_idx` | new |
| **`match_embeddings_hybrid`** | new RPC; **`match_embeddings` untouched** |

## Intentionally skipped (repo already has them)

- `embeddings_embedding_hnsw` (Phase 5 = ANALYZE / optional REINDEX after 20K)
- `menu_items_restaurant_idx`

## RLS / security

- Additive columns only — existing RLS policies unchanged.
- `embeddings` still has **no** anon/authenticated policies (service_role + RPC only).
- Hybrid RPC: `security definer`, `search_path = public, extensions`, grants mirror `match_embeddings` (`authenticated`, `service_role`).
- Returns only `source_table, source_id, score, vector_similarity, content` — no addresses.

## Pre-backfill behavior

Until Phase 2 fills `content` / `metadata`:

- **Vector** branch still works (existing 1024-d vectors).
- **FTS / trigram** contribute little (empty/`null` content).
- Filters use **metadata with `menu_items` fallback** so veg/category/available still work on today’s 388 rows.

## Ask before apply

1. Reply **`apply Phase 1 local`** — `supabase db push` / migration against local only, then smoke `match_embeddings_hybrid`.  
2. Reply **`apply Phase 1 cloud`** — only after local OK (explicit).  
3. Or request SQL edits first.
