# Changelog

## 2026-10-06 — Phase 4 batch 2 (in progress)

### P11 — Query hygiene
- Client/manager APIs: replace `select('*')` with explicit columns on profiles, addresses, applications, menu create, restaurant update, invites.
- Home dish fetch limit 240→96; kitchen orders 200→100; performance orders 2000→500; restaurant stats 500→200.

### P12 — RIO empty-query guard
- `searchRestaurantsUncached`: empty query without veg/max_price returns `QUERY_REQUIRED` instead of dumping ≤40 kitchens.
- Docs: `docs/06-rio-assistant.md` tool bounds updated.

## 2026-10-06 — Phase 4 batch 1 (P4, P5, P6, P20, P8)

### P4 — RAG PII
- Migration `20261006220000_match_embeddings_scope_pii.sql`: strip `delivery_address`; scope order-history embeddings to `auth.uid()` owner.
- RIO `retrieve_context` limited to `menu_items` + `ratings`.

### P5 — Order push webhook
- Migration `20261006221000_notification_dispatch_log.sql`.
- `notify-new-order` claims dedupe rows and ignores forged `old_record` transitions.

### P6 — Secrets hygiene
- `npm run check:secrets` (`scripts/check-secrets-hygiene.mjs`) wired into `npm test`.
- Stronger `client.server.ts` warnings; Assessment credentials marked DEV ONLY.

### P20 — Kitchen accept timeout
- Migration `20261006222000_order_accept_timeout.sql`: cancel `placed` orders older than 30 minutes (configurable); `pg_cron` every 5 minutes.

### P8 — Demo seed
- `supabase/seed.sql` idempotent `@quickbite.demo` dataset for local `db reset` (not applied to cloud in this batch).
