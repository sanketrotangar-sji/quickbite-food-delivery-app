# Changelog

## 2026-10-07 — Customer performance + image payload

### Fetch / tabs
- Customer orders realtime scoped to `customer_id`; drop global history/location channels from tab layout.
- Live kitchen catalog invalidation only while Home/Explore focused (4s debounce).
- Cart/orders/active-order: `staleTime` 60s, `refetchOnMount: false`; cart mutations stop blanket invalidate storms.
- Home catalog split: `home-shell` then `home-dishes`; ratings via `restaurant_rating_summary` (migration `20261007030000_…`).
- Favorites + restaurant “similar” no longer pull full home catalog; Orders prefetched after shell load.
- Notifications limit 50; RIO trim capped; Careers skips focus refetch when cached.

### Images
- Cart, restaurant hero, promo banner, rider cards use `RemoteImage` + `.sm.webp` thumbs (`hero`/`thumb` slots).
- Removed unused multi‑MB dish PNGs from Expo client assets; manager uploads generate sibling thumbs in-browser; list `<img>` uses thumb rewrite.
- Re-run `npm run images:optimize` for existing Storage objects when needed.

## 2026-10-07 — Production readiness (waves 0–6)

### Wave 0 — Catalog wipe script
- Added [`supabase/scripts/wipe_keep_catalog.sql`](../supabase/scripts/wipe_keep_catalog.sql) (manual; do not run until approved).
- Docs: backup + wipe notes in `12-environments.md`.

### Wave 1 — Fetch + permissions
- Rider home: `mine` + duty-gated `available` only; history via dedicated Earnings query.
- QueryClient stale/gc tuning; location permission helper + `LocationPermissionGate`.
- Duty/claim require foreground GPS; address form uses shared permission helper.

### Wave 2 — RIO cloud threads
- Migration `20261007020000_rio_threads.sql`: `rio_threads` / `rio_messages` + RLS.
- Client `rioChat.ts` + RioScreen hydrate from cloud; AsyncStorage as offline cache; clear on logout.

### Wave 3 — Rider duty + earnings
- Migration `20261007021000_rider_duty_and_earning.sql`: `rider_set_duty` blocks off-duty with active order; claim + auto-assign stamp `rider_earning`.
- Optimistic duty toggle; UI abort when active order; mock earnings constants removed.
- Earnings empty states; pay labeled as rider pay (not customer delivery fee).

### Wave 4 — Profile / settings / status
- Faster profile save (optimistic close); rider personal/vehicle persist to `profiles`.
- Duty status on rider profile; push “Open settings” deep-link; shared `ORDER_STATUS_LABELS`.

### Wave 5 — Dashboard / admin
- Performance loading/empty clarity; admin recent-orders copy after wipe.
- Admin Open/Close kitchens + RLS `20261007022000_admin_restaurant_update.sql`.

### Wave 6 — Release smoke
- Expanded APK + admin smoke checklists in [`12-release-android.md`](./12-release-android.md).

## 2026-10-07 — Phase 4 batch 3 (P3, P13, P16, P17, P21, P23)

### P3 — Indexes / FK audit
- Confirmed FKs: `orders.delivery_address_id`, `home_highlights.restaurant_id`.
- Migration `20261007010000_orders_restaurant_placed_idx.sql`: `(restaurant_id, placed_at desc)` for manager kitchen/history lists.

### P13 — Rider realtime / GPS scope
- Realtime subscription filtered to assigned orders (`rider_id=eq.user`).
- Pool refresh: 20s interval while online (no global orders channel).
- `restoreRiderTracking` requires `isOnline: true`; offline riders stop GPS.

### P16 — Unified DB types
- `npm run types:manager` + `npm run types:gen` (client + manager).
- Regenerated both type files from cloud schema; README docs updated.

### P17 — home-catalog rename
- Renamed `apps/client/src/lib/home-mock.ts` → `home-catalog.ts`; updated imports.
- Removed empty `apps/client/app/(tabs)/`; manager `supabase/README.md` clarifies tooling stub.

### P21 — Errors / logging
- Client `userFacingMessage` for consistent Alert copy (cart/add/rider mutations).
- RIO + notify-new-order logs use short `requestId` (no PII). Manager auth-gate already correct.

### P23 — Quarantine / backup
- `_delivery_quarantine/README.md` tracked; gitignore keeps bulky artifacts out.
- Backup/PITR/`pg_dump` section in `docs/12-environments.md`; FAQ + Phase status updated.

## 2026-10-06 — Phase 4 batch 2 (P11, P12, P15, P18, P19, P22)

### P11 — Query hygiene
- Client/manager APIs: replace `select('*')` with explicit columns on profiles, addresses, applications, menu create, restaurant update, invites.
- Home dish fetch limit 240→96; kitchen orders 200→100; performance orders 2000→500; restaurant stats 500→200.

### P12 — RIO empty-query guard
- `searchRestaurantsUncached`: empty query without veg/max_price returns `QUERY_REQUIRED` instead of dumping ≤40 kitchens.
- Docs: `docs/06-rio-assistant.md` tool bounds updated.

### P15 — Theme tokens
- Added `primarySoftMid`, `primaryWash`, `primaryTintBorder`, `stepTrack`/`stepTrackBorder`/`stepLine` to shared brand tokens + client theme.
- Replaced stray peach/grey hexes in OrderTracking, Rio, Notifications, Cart screens.

### P18 — Environments / migrations SoT
- New [`docs/12-environments.md`](./12-environments.md): local vs cloud, env files, no service role in `EXPO_PUBLIC_*` / `VITE_*`.
- `docs/03-database.md`: new migrations = schema/RPC/RLS only (seed is the data path).
- Links from `docs/README.md` and `docs/setup.md`; seed path already in `config.toml`.

### P19 — Integration / RLS / RAG smoke
- New `tests/integration/rls-rag-smoke.mjs` (wired into `npm run test:integration`): cross-customer order RLS when seed users exist; `match_embeddings` must not return `delivery_address`; `notification_dispatch_log` duplicate claim → unique violation.
- Happy-path skips cleanly when no order fixture; P5 full webhook still manual.

### P22 — Android / EAS release
- New [`docs/12-release-android.md`](./12-release-android.md): package `com.sjinnovation.quickbite`, EAS profiles (dev/preview APK, production AAB), env + FCM, smoke checklist.
- Linked from `docs/README.md` and `docs/setup.md`.

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
