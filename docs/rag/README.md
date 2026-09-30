# RAG retrieval evaluation

Fixed query sets live in [`eval-queries.json`](./eval-queries.json). Labels were chosen **before** running retrieval (menu item UUIDs from the seed bundle that satisfy each query).

## Metrics

| Metric | Meaning |
|--------|---------|
| **hit-rate@k** | 1 if any labeled ID appears in the top-k retrieved rows, else 0 (averaged per set). |
| **precision@k** | \|retrieved ∩ labeled\| / k — how much of the shortlist is actually on-target. |

Noisy queries reuse the same labels as their `base_query_id` entry; the report compares clean vs noisy averages to show embedding robustness.

## Regenerate the report

Requires Ollama `nomic-embed-text`, embeddings backfill, and Supabase credentials:

```bash
npm run rag:eval
```

Output: [`evaluation-report.md`](./evaluation-report.md) — **link this file from the README** instead of copying numbers by hand.
