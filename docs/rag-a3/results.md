# A3 RAG eval results

Generated: 2026-10-09T09:20:50.557Z
Model: `qwen3-embedding:0.6b` · k=5 · labels=`canonical_key` (slug fallback)
Queries: `docs/rag-a3/eval-queries.json` (73 total, ~50/50 dev/test)
Metrics below are **test split only**. OOC similarity threshold tuned on **dev** only.

## Before / after (test overall)

| Mode | hit@1 | hit@5 | MRR | precision@5 | OOC refusal | p50 | p95 | OOC thr (dev) |
|------|------:|------:|----:|------------:|------------:|----:|----:|--------------:|
| old | 21.2% | 51.5% | 0.329 | 27.3% | 50.0% | 762ms | 1185ms | 0.7194 |
| hybrid | 63.6% | 81.8% | 0.691 | 61.2% | 75.0% | 1213ms | 1746ms | 0.6913 |
| hybrid+filters | 63.6% | 81.8% | 0.691 | 63.6% | 75.0% | 1270ms | 1420ms | 0.6913 |

## Per-bucket (test)

### old

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 10.0% | 70.0% | 0.287 | 26.0% | n/a |
| typo | 8 | 37.5% | 62.5% | 0.500 | 35.0% | n/a |
| intent | 10 | 30.0% | 50.0% | 0.400 | 36.0% | n/a |
| constraint | 5 | 0.0% | 0.0% | 0.000 | 0.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 50.0% |

### hybrid

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 90.0% | 90.0% | 0.900 | 90.0% | n/a |
| typo | 8 | 87.5% | 100.0% | 0.900 | 82.5% | n/a |
| intent | 10 | 40.0% | 70.0% | 0.503 | 38.0% | n/a |
| constraint | 5 | 20.0% | 60.0% | 0.317 | 16.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 75.0% |

### hybrid+filters

| Bucket | n | hit@1 | hit@5 | MRR | p@5 | OOC |
|--------|--:|------:|------:|----:|----:|----:|
| exact | 10 | 90.0% | 90.0% | 0.900 | 90.0% | n/a |
| typo | 8 | 87.5% | 100.0% | 0.900 | 82.5% | n/a |
| intent | 10 | 40.0% | 70.0% | 0.503 | 38.0% | n/a |
| constraint | 5 | 20.0% | 60.0% | 0.317 | 32.0% | n/a |
| out_of_catalog | 4 | n/a | n/a | n/a | n/a | 75.0% |

## 10 worst failing queries (test)

Mode: **hybrid+filters** (preferred after = hybrid+filters → hybrid → old).

1. `ex16` _Goan Fish Curry_ — wanted [fish_curry_goan, fish-curry-goan, goan_fish_thali] got [classic_goan_fish_curry, goan_fish_curry_dry, classic_goan_fish_curry]
2. `in02` _tangy drink_ — wanted [mint_soda, mint-soda, lemon_juice] got [dahi_puri_gravy, solkadhi_mh, dahi_puri_gravy]
3. `in10` _comfort indian gravy_ — wanted [butter_chicken, butter_chicken_dry, butter_chicken_gravy] got [curd_rice, filter_coffee, pongal]
4. `in16` _crispy fried fish_ — wanted [bombil_fry, classic_bombil_fry, bombil_fry_dry] got [rava-fried-chonak, fish_moilee, modak_fried]
5. `cn02` _non veg starters_ — wanted [chicken_tikka, butter_chicken_tikka, classic_chicken_tikka] got [chicken-cafreal, rava-fried-chonak, rava-fried-chonak]
6. `cn08` _veg healthy options_ — wanted [poha, curd_rice, classic_curd_rice] got [avocado-sourdough-toast, quinoa-buddha-bowl, hummus-and-falafel-platter]
7. `oc08` _gluten free vegan sushi under 50 rupees_ — OOC leak: returned vegan-falafel-wrap, vegan-falafel-wrap, steamed-dim-sum-basket (topSim=0.700)

## Method notes

- Hit = any top-k result’s `canonical_key` matches expected (underscore/hyphen normalized; `classic_`/`loaded_`/`schezwan_` + multi-token remainder shares dish stem). Null `canonical_key` → slugified name.
- `old` = `match_embeddings`; `hybrid` / `hybrid+filters` = `match_embeddings_hybrid`.
- OOC correct = empty result **or** top `vector_similarity` < threshold tuned on **dev** (Youden: OOC TPR − in-catalog FPR).
- Only **7** test failures on hybrid+filters (listed above); intent/constraint remain the weak buckets.
- Summary: before (old) hit@5 **51.5%** → after (hybrid+filters) hit@5 **81.8%** (above 80% target).
