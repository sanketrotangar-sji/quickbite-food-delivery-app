# RAG retrieval evaluation

Fixed query sets live in [`eval-queries.json`](./eval-queries.json). Labels were chosen **before** running retrieval (menu item UUIDs from the seed bundle that satisfy each query). Eval filters to `menu_items` so food-recommendation hit-rate stays comparable even after order-history rows join the index.

## Corpus (Assessment 2)

| Layer | What | Target |
|-------|------|--------|
| Domain seed | All QuickBite tables | ≥5,000 rows (~6.5k–7k in [`../seed-data-spec.md`](../seed-data-spec.md)) |
| RAG index | `embeddings` over menu + ratings + **order history** (`orders`, `order_items`, `order_status_history`) | ≥5,000 vectors after `npm run embeddings:backfill -- --source all` |

RIO `retrieve_context` searches all five sources; live order status still also uses RPCs/tables for exact answers.

## Metrics

| Metric | Meaning |
|--------|---------|
| **hit-rate@k** | 1 if any labeled ID appears in the top-k retrieved rows, else 0 (averaged per set). |
| **precision@k** | \|retrieved ∩ labeled\| / k — how much of the shortlist is actually on-target. |

Noisy queries reuse the same labels as their `base_query_id` entry; the report compares clean vs noisy averages to show embedding robustness.

## Regenerate the report

Requires Ollama `nomic-embed-text`, embeddings backfill (at least `menu_items`), and Supabase credentials:

```bash
npm run embeddings:backfill -- --source all
npm run rag:eval
```

Output: [`evaluation-report.md`](./evaluation-report.md) — **link this file from the README** instead of copying numbers by hand.
