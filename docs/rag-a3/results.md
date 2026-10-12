# A3 RAG eval results

Generated: 2026-10-11T09:29:13.377Z
Model: `qwen3-embedding:0.6b` · k=5 · labels=`canonical_key` (slug fallback)
Queries: `docs/rag-a3/eval-queries.json` (73 total, ~50/50 dev/test)
Metrics below are **test split only**. OOC similarity threshold tuned on **dev** only.

## Before / after (test overall)

| Mode | hit@1 | hit@5 | MRR | precision@5 | OOC refusal | p50 | p95 | OOC thr (dev) |
|------|------:|------:|----:|------------:|------------:|----:|----:|--------------:|
| old | 24.2% | 48.5% | 0.347 | 24.8% | 50.0% | 699ms | 1800ms | 0.7375 |
| hybrid | 63.6% | 81.8% | 0.691 | 65.5% | 75.0% | 1146ms | 4030ms | 0.6913 |
| hybrid+filters | 63.6% | 81.8% | 0.691 | 65.5% | 75.0% | 1103ms | 1710ms | 0.6913 |
| hybrid+rerank | 63.6% | 81.8% | 0.695 | 66.7% | 75.0% | 1120ms | 1765ms | 0.6913 |

## Per-bucket (test)

### old

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 0.0% | 40.0% | 0.200 | 20.0% | n/a |
| typo | 8 | 37.5% | 62.5% | 0.469 | 27.5% | n/a |
| intent | 10 | 40.0% | 60.0% | 0.470 | 38.0% | n/a |
| constraint | 5 | 20.0% | 20.0% | 0.200 | 4.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 50.0% |

### hybrid

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 90.0% | 90.0% | 0.900 | 90.0% | n/a |
| typo | 8 | 87.5% | 100.0% | 0.906 | 85.0% | n/a |
| intent | 10 | 40.0% | 70.0% | 0.503 | 44.0% | n/a |
| constraint | 5 | 20.0% | 60.0% | 0.307 | 28.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 75.0% |

### hybrid+filters

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 90.0% | 90.0% | 0.900 | 90.0% | n/a |
| typo | 8 | 87.5% | 100.0% | 0.906 | 85.0% | n/a |
| intent | 10 | 40.0% | 70.0% | 0.503 | 44.0% | n/a |
| constraint | 5 | 20.0% | 60.0% | 0.307 | 28.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 75.0% |

### hybrid+rerank

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 90.0% | 90.0% | 0.900 | 90.0% | n/a |
| typo | 8 | 87.5% | 100.0% | 0.906 | 85.0% | n/a |
| intent | 10 | 40.0% | 80.0% | 0.537 | 50.0% | n/a |
| constraint | 5 | 20.0% | 40.0% | 0.267 | 24.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 75.0% |

## 10 worst failing queries (test)

Mode: **hybrid+rerank** (preferred after = hybrid+rerank → hybrid+filters → hybrid → old).

1. `ex16` _Goan Fish Curry_ — wanted [fish_curry_goan, fish-curry-goan, goan_fish_thali] got [classic_goan_fish_curry, goan_fish_curry_dry, classic_goan_fish_curry]
2. `in02` _tangy drink_ — wanted [mint_soda, mint-soda, lemon_juice] got [dahi_puri_gravy, dahi_puri_gravy, dahi_puri_dry]
3. `in18` _vegan wrap option_ — wanted [paneer_wrap, schezwan_paneer_wrap, butter_paneer_wrap] got [vegan-falafel-wrap, vegan-falafel-wrap, vegan-falafel-wrap]
4. `cn02` _non veg starters_ — wanted [chicken_tikka, butter_chicken_tikka, classic_chicken_tikka] got [rava-fried-chonak, chicken-cafreal, schezwan_veg_sandwich]
5. `cn06` _veg desserts_ — wanted [ukadiche_modak, ukadiche-modak, bebinca] got [serradura, serradura, serradura]
6. `cn08` _veg healthy options_ — wanted [poha, curd_rice, classic_curd_rice] got [avocado-sourdough-toast, vegan-falafel-wrap, quinoa-buddha-bowl]
7. `oc08` _gluten free vegan sushi under 50 rupees_ — OOC leak: returned vegan-falafel-wrap, vegan-falafel-wrap, vegan-falafel-wrap (topSim=0.700)

## Method notes

- Hit = any top-k result’s `canonical_key` ∈ expected (else slugified `menu_items.name`).
- `old` = `match_embeddings`; `hybrid` / `hybrid+filters` / `hybrid+rerank` = `match_embeddings_hybrid` (rerank over-fetches then heuristic blend; RIO also tries LLM re-rank with this fallback).
- Corpus frozen at current menu embeddings (no further synthetic backfill for T4).
- OOC correct = empty result **or** top `vector_similarity` < threshold tuned on **dev** (Youden: OOC TPR − in-catalog FPR).
- Summary line: before=h@1 24.2% · h@5 48.5% · MRR 0.347 · p@5 24.8% · ooc 50.0% · p50 699ms · p95 1800ms; after=h@1 63.6% · h@5 81.8% · MRR 0.695 · p@5 66.7% · ooc 75.0% · p50 1120ms · p95 1765ms.
