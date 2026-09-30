# Assessment 2 — Dev Control Tower submission packet

Use this checklist when uploading to Dev Control Tower. Refresh machine-captured logs with:

```bash
npm run dct:artifacts
```

## Links

| Item | Value |
|------|--------|
| Live dashboard | https://quickbite-nine-phi.vercel.app/ |
| GitHub | https://github.com/sanketrotangar-sji/quickbite-food-delivery-app |
| Supabase ref | `motqehtswgjbbvoazarh` |

## What to attach / paste

1. **Live URL + GitHub** (above).
2. **Demo notes** — agent, automations, RAG, tests: root [`README.md`](../../README.md) + [`docs/architecture.md`](../architecture.md).
3. **RAG evaluation** — [`docs/rag/evaluation-report.md`](../rag/evaluation-report.md) (matching / extreme / noisy). Design notes: [`docs/rag/README.md`](../rag/README.md).
4. **≥70% accuracy** — [`docs/ml/classification-metrics.json`](../ml/classification-metrics.json) (**accuracy 0.974**) + [`docs/ml/confusion_matrix.png`](../ml/confusion_matrix.png). Chat LLM: Groq or Ollama via `llm_config` (not Gemini). Embeddings: Ollama `nomic-embed-text`.
5. **Test run output** — captured here:
   - [`test-run-unit.md`](./test-run-unit.md) — **must be exit 0** (auth, roles, kitchen/rider transitions, RAG helpers)
   - [`test-run-edge.md`](./test-run-edge.md) — Deno `_shared` tests (needs local `deno` or network for `npx deno`)
   - [`test-run-integration.md`](./test-run-integration.md) — service-role order happy path (needs seeded ready/unassigned orders + `SUPABASE_SERVICE_ROLE_KEY`)
   - Index: [`evidence-index.json`](./evidence-index.json)
   - Playwright: `PLAYWRIGHT=1 npm run test:e2e` (login smoke + Google CTA)
6. **Credentials** — sample role logins in [`supabase/seed-data/generated/manifest.json`](../../supabase/seed-data/generated/manifest.json) (`sample_logins`).

## RAG ≥5,000 records (how we meet Track 3)

| Layer | Count (seed contract) |
|-------|----------------------:|
| Domain tables (profiles…orders…history…) | ~6,500–7,000 |
| Embedding corpus after `npm run embeddings:backfill -- --source all` | ~5,650 (menu + ratings + orders + order_items + order_status_history) |

Operator: `supabase db push` (migration `20261001120000_match_embeddings_order_history`) then backfill.

## Demo click-path (COMPLETE features)

1. Customer: browse → cart → checkout → place → track (automation banner if assign/ETA fired).
2. Kitchen: accept → preparing → ready (auto-assign may claim rider).
3. Rider: duty on / active delivery → out_for_delivery → delivered.
4. RIO: craving query → cards → confirm order; or track / escalate complaint.
5. Admin `/admin/ai`: show Groq ↔ Ollama switch (do not flip mid-demo unless both backends live).

## Known gaps (honest)

- Customer rating **submit** UI still missing (schema ready).
- Playwright E2E is login smoke; full UI order path is covered by `tests/integration/order-happy-path.mjs` (service role).
- RAG food hit-rate on the fixed eval set was ~25% historically — regenerate after backfill.
