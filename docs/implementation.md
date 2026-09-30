# Implementation notes

## Done (Parts 1–2 + Assessment 2 polish)

- Seed generate/push (`npm run seed:generate` / `seed:push`) + embeddings backfill (`--source all` → menu, ratings, **order history**)
- Admin `/admin/ai` + `llm_config` / `callLLM`
- RIO: RAG `retrieve_context` (incl. order history sources), `check_delivery_status`, `escalate_complaint` → `support_tickets`
- Automations: auto rider on `ready`, kitchen-load ETA via `pg_cron`
- Offline menu-category classifier → `docs/ml/`
- DCT packet: `docs/dct/` + `npm run dct:artifacts`

## Still open

- Part 3 dashboard UI for automation feed
- Manager “suggest category” wiring from classifier
- Agent suite expansion (restaurant ops assistant beyond RIO)
- Customer rating submit UI
- Full Playwright order lifecycle E2E (integration happy-path covers DB flow)