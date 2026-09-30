# Implementation notes

## Done (Parts 1–2)

- Seed generate/push (`npm run seed:generate` / `seed:push`) + embeddings backfill
- Admin `/admin/ai` + `llm_config` / `callLLM`
- RIO: RAG `retrieve_context`, `check_delivery_status`, `escalate_complaint` → `support_tickets`
- Automations: auto rider on `ready`, kitchen-load ETA via `pg_cron`
- Offline menu-category classifier → `docs/ml/`

## Still open

- Part 3 dashboard UI for automation feed
- Manager “suggest category” wiring from classifier
- Agent suite expansion (restaurant ops assistant beyond RIO)
- RIO / orders polish UI