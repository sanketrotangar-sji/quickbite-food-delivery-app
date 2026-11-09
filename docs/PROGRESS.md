# QuickBite — Progress

Update this file after every meaningful task. Status as of **2026-11-09**.

---

## Done

### Assessment 4 — Option 2: Find-dishes-by-photo + AI auto-tags (Vision) — 2026-11-09
- [x] `@quickbite/domain` (`packages/domain/src/vision.ts` + `vision.test.ts`): canonical tag taxonomy (`CANONICAL_FOOD_TAGS`), category normalizer, image data-URL validator, search query builder, and pure Tag P/R/F1 & Hit@K/MRR scorers
- [x] Edge `supabase/functions/vision-food` + `_shared/vision.ts` (+ Deno tests): Groq Vision (`qwen/qwen3.8-27b`) + Cloud Ollama Vision failover, `NOT_FOOD_IMAGE` guard, `qwen3-embedding:0.6b` hybrid pgvector search, and 8 km range filter — deployed live to cloud Supabase (`motqehtswgjbbvoazarh`)
- [x] `@quickbite/api` (`packages/api/src/vision.ts` + `dashboard/menu.ts`): `searchDishesByPhoto` (supports both base64 `imageDataUrl` and remote `imageUrl`), `suggestDishTagsFromPhoto`, `updateMenuItemReview`, and `tags` persistence on `menu_items`
- [x] Manager `/menu` (`apps/manager/src/features/kitchen/screens/MenuPage.tsx`): photo upload auto-trigger, "Auto-tag with AI" button, interactive Owner Review/Correct tag chips (`tags[]`, `category`, `is_veg`), and save flow
- [x] Customer Explore (`apps/client` `HomeSearch`, `ExploreScreen`, `PhotoSearchSheet`, `photo-search.ts` + `photo-search.test.ts`): camera icon in search bar, photo scan sheet with AI food badges, live catalog food photo strip, MMKV JSI startup guard (`storage.ts`), and 1-tap Add to Cart for nearby matching dishes
- [x] Android EAS preview APK build queued (`2212e39b-1407-4f7d-9c9a-e21212514611`)
- [x] Backfilled all **389 real (`is_synthetic = false`) `menu_items`** in cloud Supabase with normalized canonical food tags (`scripts/backfill-menu-tags.mjs`)
- [x] Evaluation harness (`scripts/eval-vision.mjs` → `docs/dct/vision-eval-results.json` & `docs/dct/ASSESSMENT4_REPORT.md`): scaled to **172 evaluation queries** (**160 canonical dishes** across 7 cuisines + **12 non-food/OOC negatives**, plus live verification against **15,998 cloud `pgvector` embeddings**):
  - Photo Search Retrieval: Baseline (`Hit@1 65.0%` / `Hit@5 89.4%` / `MRR 0.749`) → Vector-Only (`Hit@1 99.4%` / `Hit@5 100.0%` / `MRR 0.997`) → Vision + Hybrid RRF (`Hit@1 100.0%` / `Hit@5 100.0%` / `MRR 1.000`), Live Cloud `match_embeddings_hybrid` RPC **90.0%**, Non-Food/OOC Refusal **100.0% (`12/12`)**
  - Auto-Tagging (`n=160`): **Veg Acc 100.0% (`160/160`)**, **Category Acc 99.4% (`159/160`)**, **Cuisine Acc 96.9% (`155/160`)**, **Multi-label Tag Macro F1 80.1%** (Precision `87.5%`, Recall `74.4%`, Micro F1 `79.8%`)

### Product foundation
- [x] Monorepo: `apps/client` (Expo), `apps/manager` (dashboard), `apps/landing`, `packages/shared`, `supabase/`
- [x] Auth: email/password + Google; signup → `customer` profile
- [x] Roles: customer, rider, restaurant_manager, restaurant_owner, admin (single-role)
- [x] Order RPC chain: `place_order` → kitchen status → claim/auto-assign → rider deliver → rate
- [x] RLS + browse views + redacted rider pool
- [x] Realtime kitchen / tracking; push webhook (`notify-new-order`) with dedupe
- [x] Owner invite managers; admin applications for riders/owners
- [x] Dashboard live on Vercel; migrations pushed to cloud Supabase

### Phase 4 / production readiness (batches 1–3 + waves)
- [x] RAG PII scope on `match_embeddings`; RIO retrieve menu/ratings only
- [x] Order accept timeout (30 min default, `pg_cron`)
- [x] Secrets hygiene check in `npm test`
- [x] Local demo seed `@quickbite.demo` in `supabase/seed.sql`
- [x] Query hygiene, theme tokens, unified `types:gen`
- [x] Rider duty/earnings RPCs; GPS scoped to online + assigned
- [x] RIO cloud threads (`rio_threads` / `rio_messages`)
- [x] Customer fetch/image performance pass
- [x] Android EAS package `com.sjinnovation.quickbite` documented

### Truth layer (A–E) — 2026-10-08
- [x] **A** — Offers + `discount_amount` in `place_order`; drop/pickup km; Goa geo script; Near me ≤8 km default; range guards on add/checkout
- [x] **B** — Manager prep avg, cancel confirm, rider panel, Quiet/Normal/Busy capacity
- [x] **C** — Performance Today/7d/30d, AOV, prep SLA; rider rating on profile
- [x] **D** — `admin_audit_log`, capacity threshold, refund fields; admin tickets/orders/riders + restaurant ops RPCs
- [x] **E** — RIO cart/confirm parity with checkout fees + range; track/support grounding

### RIO pipeline (Phases 1–8) — 2026-10-08
- [x] `rio_snapshot` (+ taste from delivered orders)
- [x] Streaming final answer + NDJSON progress
- [x] Server thread history (last 8); client sends latest user text
- [x] `cartHash` on confirm (CART_CHANGED guard)
- [x] Tools: browse_themes, find_offers, verify_dish (+ find_food alias), get_menu, cart, checkout, order_status, report_issue, reorder_last, save_prefs
- [x] `rio_events` + LLM failover retry
- [x] Client split: `useRioThread` / `useRioChat` / `RioMessageList`
- [x] Discovery + smart seller + resilience (theme→kitchen→menu; conflict early-exit; calm errors; `distanceKm` on cards)

### Docs cleanup — 2026-10-08
- [x] Consolidated to `README.md`, `docs/REQUIREMENTS.md`, `docs/PROGRESS.md`, `.cursor/rules/project.mdc`
- [x] Pre-submission backlog in `docs/PLAN.md`

### Catalog + curated RAG — 2026-10-08
- [x] Enriched short restaurant/menu descriptions (UPDATE only; no entity deletes)
- [x] **P9** — wiped junk embeddings; migrated to `qwen3-embedding:0.6b` **1024-d**
- [x] Curated backfill: 388 `menu_items` (comment ratings when present); no orders/history junk
- [x] `OLLAMA_BASE_URL=https://ollama.buildyourai.consulting`; `rio` redeployed; dosa smoke OK
- [x] Chat LLM unchanged (`llm_config` Groq / Ollama)
- [x] Admin `/admin/ai`: Cloud Ollama chat card + fixed RAG panel (host/model/dims; secrets stay in Edge)
- [x] RIO: hide model reasoning from UI; durable `profiles.rio_memory` + `save_prefs`; clarify-first prompt; keep more cards

### Synthetic corpus scale-up — 2026-10-09
- [x] `scripts/datagen/`: vocab + 160-base catalog → 669 expanded dishes → **250** synthetic restaurants × **82** items = **20,500** menu rows
- [x] Deterministic UUIDv5 + seeded PRNG; validator green; CSVs/report in `scripts/datagen/out/` (gitignored)
- [x] Loaded to cloud (dry-run → `--limit 200` → full); upsert `onConflict id`; real (`is_synthetic=false`) rows untouched
- [x] One synthetic owner `synthetic-owner@quickbite.synthetic` (UUIDv5) owns all synthetic restaurants

### A3-T4 hybrid RPC + backfill — 2026-10-09
- [x] Applied `20261009010000_rag_hybrid_a3.sql` on cloud: `content`/`metadata`/`fts`, `match_embeddings_hybrid` (live menu filters; real cosine; word_similarity; OR tsquery)
- [x] `buildMenuItemText` in `supabase/functions/_shared/ragText.{mjs,ts}`; both backfill scripts use it
- [x] Backfill flags `--force --source --limit --concurrency`; batch Ollama `/api/embed`; writes content + hash + metadata
- [x] Timed 200 menu upserts ≈ **113.5s** → estimate **~189 min** for 20,000 (~1.76 items/s)
- [x] Smoke: hybrid returns rows; veg filter zero non-veg; `is_available=false` hides hit then restored
- [x] Eval harness rebuilt: 73 queries (`canonical_key`, 50/50 dev/test, 5 buckets); modes old / hybrid / hybrid+filters; OOC thr tuned on **dev** (Youden)
- [x] Test report `docs/rag-a3/results.md`: **old hit@5 → hybrid(+filters) 81.8%**; OOC refusal 50%→75%

### A3-T4 closeout — 2026-10-11
- [x] **Corpus frozen** — no further synthetic embed backfill for T4
- [x] `retrieveContext` → `match_embeddings_hybrid` (over-fetch) + LLM listwise re-rank with heuristic fallback
- [x] RIO `retrieve_context` uses hybrid+rerank; hydrates `menu_items` meta for restaurant diversify
- [x] Eval mode `hybrid+rerank`; report refreshed: old hit@5 **48.5%** → hybrid+rerank **81.8%** (MRR 0.695, p@5 66.7%)
- [x] Smoke: `masala dosa` hybrid hits + menu hydrate OK

### A3-T3 multi-agent + guardrails — 2026-10-11
- [x] Supervisor routes to **order** / **dispatch** / **support** / **clarify** (keyword + active-order bias; low-confidence → clarify)
- [x] Guardrails: `redactPii`, `validateToolArgs`, clarify helpers (+ Deno tests)
- [x] Specialists with tool subsets; shared memory via threads + `rio_memory` / snapshot
- [x] Dispatch `estimate_eta` (ORS → OSRM → haversine fallback); no customer claim/assign RPCs
- [x] `rio_events.tools` logs `route:{agent}:{confidence}`; cards/stream UX unchanged
- [x] Unit tests green; route smoke OK; `rio` redeployed

### A3-T1 third-party (Twilio + Stripe) — 2026-10-11
- [x] Migration `20261011160000_t1_payments_and_sms.sql` — payment columns + SMS dispatch events + nullable audit actor
- [x] Edge `send-order-sms` (Twilio outbound; `WEBHOOK_SECRET`; dedupe via `notification_dispatch_log`)
- [x] Edge `create-payment-intent` (JWT; Stripe Checkout test) + `stripe-webhook` (`Stripe-Signature` verify)
- [x] Client: optional **Pay with card (test)** on order tracking; cash remains default
- [x] `.env.example` placeholders for `TWILIO_*` / `STRIPE_*`
- [x] Ops: migration applied; secrets set; DB trigger `send-order-sms` on `orders`; Stripe webhook endpoint live; three functions deployed
- [x] Twilio trial workaround: Messaging Body blocked (572006) → outbound via **Verify SMS** (`TWILIO_VERIFY_SERVICE_SID`)
- [x] Client: selectable Card (test) in PaymentSheet → checkout navigates to tracking + auto Stripe Checkout
- [x] E2E smoke: Twilio Verify SMS + Stripe test pay confirmed on device

### A3-T2 custom CRM — 2026-10-11
- [x] Migration `20261011180000_t2_crm_campaigns.sql` — campaigns, enrollments, segments view, admin RPCs, `place_order` redemption
- [x] Manager `/admin/crm` — segment counts/members, create/launch/end campaign, stats
- [x] Cloud `db push` applied; CRM RPCs live

### A3-T6 CI / observability / security — 2026-10-11
- [x] `.github/workflows/ci.yml` — secrets + unit + edge on push/PR; optional integration/e2e via secrets
- [x] Optional Sentry (manager `VITE_SENTRY_DSN`, client `EXPO_PUBLIC_SENTRY_DSN`, Edge `SENTRY_DSN`) — no SDK, envelope ingest
- [x] RIO per-user rate limit (`_shared/rateLimit.ts`; defaults 40/min)
- [x] Directions TTL cache (`_shared/ttlCache.ts`); RIO tools already use `_toolCache`
- [x] Advisor/RLS checklist documented in REQUIREMENTS; no schema change this track
- [x] Redeploy `rio` + `directions` after merge so Edge helpers go live

### A3-T5 cancel-risk model — 2026-10-11
- [x] `scripts/cancel_risk.py` + `npm run ml:cancel-risk` (place-time features; no schema)
- [x] Cloud closed orders: **5** cancelled + **1** delivered → augmented with **3000** synthetic rows (documented in `docs/ml/`)
- [x] Held-out: **precision 0.867 / recall 0.825 / F1 0.845** (random_forest); accuracy 0.877
- [x] Artifacts: `docs/ml/cancel-risk-metrics.json`, `cancel-risk-confusion.png`, `cancel-risk-dataset-summary.json`
- [ ] Bonus Modelfile / LoRA for RIO chat — deferred (optional pts)

### A3-T7 docs + final report — 2026-10-12
- [x] Final Assessment 3 report: `docs/dct/ASSESSMENT3_REPORT.md` + `.html` (arch SVG, tracks 1–7, scoring checklist)
- [x] RAG numbers aligned to `docs/rag-a3/results.md`: rebound old hit@5 **48.5%** → hybrid+rerank **81.8%** (A2 **37.5%** footnote)
- [x] Cancel-risk P/R/F1 from `docs/ml/cancel-risk-metrics.json`
- [x] Companion architecture: `docs/dct/PROJECT_ARCHITECTURE_REPORT.html`
- [x] PLAN tracks T1–T7 marked done; DCT tag **`assessment-3`**

### Engineering contract — 2026-11-02
- [x] `docs/STANDARDS.md` + `AGENTS.md` + `.cursor/rules` (product vs how-to-write)
- [x] Cursor `beforeShellExecution` shell-guard (deny destructive git/docker/db; ask for writes)
- [x] Git pre-commit: block `.env` / secret files + `check:secrets`

### Structure migration — 2026-11-03
- [x] `packages/domain`, `packages/db`, `packages/api` (+ `@quickbite/shared` re-export)
- [x] One landing (`apps/landing`); manager copy quarantined; logout → `/login`
- [x] Expo `src/features/<name>/`; manager `features/{auth,kitchen,admin}` with thin routes
- [x] Dead duplicates moved to `_structure_quarantine/` then **deleted** (2026-11-04 schema hardening)

### Admin Ops monitoring — 2026-11-04
- [x] Pure aggregators in `@quickbite/domain` (`ops-metrics`) + Vitest
- [x] `loadOpsMetrics` in `@quickbite/api` (orders / `rio_events` / automation / audit; 24h)
- [x] Manager **`/admin/ops`** page + nav (self-explanatory section blurbs)
- [x] Sentry envelopes include `release` (`VITE_APP_RELEASE` / `EXPO_PUBLIC_APP_RELEASE` / `SENTRY_RELEASE`)
- [x] Edge `_shared/requestLog.ts` wired into `rio` + `stripe-webhook`
- [x] Metrics URL: local `npm run dashboard` → `/admin/ops` (Vite often `http://localhost:8080/admin/ops`); prod after deploy `https://quickbite-nine-phi.vercel.app/admin/ops` (admin role)

### Schema hardening P0–P5 — 2026-11-04
- [x] **P0** — Drop `user_roles`; `private.grant_role` writes `profiles.role` only; quarantine deleted; types hand-synced
- [x] **P1** — `restaurant_browse` + CRM segments fence `is_synthetic` (corpus kept)
- [x] **P2** — `private.resolve_checkout_offer` + thin `place_order`; domain `resolveCheckoutOffer` + Vitest
- [x] **P3** — `order_payments` + backfill + sync trigger from `orders` payment columns (mirrors kept)
- [x] **P4** — `notification_jobs` outbox + Edge enqueue/mark on SMS/push paths
- [x] **P5** — `rider_profiles` + `customer_preferences` dual-write with profile columns
- [x] Docs: REQUIREMENTS / STANDARDS / PLAN / AGENTS / README updated
- [ ] Cloud `db push` for `2026110401*`–`2026110406*` (needs `supabase login` / `SUPABASE_ACCESS_TOKEN`)

### Client rebuild (data → RIO → screens → UI → state) — 2026-11-06
- [x] **Data** — new local Goa seed `supabase/seeds/goa_demo.sql` (Margao kitchens, real pins, hours, cost for two, bestsellers, live + expired offers, wrap-past-midnight and out-of-range cases); old `seed.sql` untouched; synthetic kept but fenced from every product read
- [x] **Schema** `20261106010000_catalog_ux_fields` — offer windows on `home_highlights`, kitchen hours / `cost_for_two` / `is_pure_veg`, `menu_categories` + `menu_items.category_id` (trigger dual-write) + `is_bestseller`, open-now helper
- [x] **RPCs** `20261106020000_customer_screen_rpcs` — `home_feed`, `browse_restaurants` (filters + keyset paging + server range), `restaurant_detail`, `order_tracking`; wrappers in `@quickbite/api/mobile/catalog`
- [x] **RIO grounding** — tools read `browse_restaurants` / `restaurant_detail` (same rows as the app); every direct read filters `is_synthetic=false`; embeddings backfill skips synthetic unless `--include-synthetic`
- [x] **Entry flow** — single splash (no second loader) → login with Skip → location explainer (GPS / area search / Margao fallback + "Change" banner) → Home; riders land on rider tabs; `resolveEntryRoute` + tests
- [x] **Screens** — Home on `home_feed` (FlashList, sticky filters, veg toggle remembered), Explore on paged `browse_restaurants`, Restaurant on `restaurant_detail`, Checkout inline range check + coded failure actions, push permission asked after first order
- [x] **UI system** — type scale + motion tokens; `Sheet` (gorhom) for address / note / payment / filter / customize; `PressableScale` + haptics; `Skeleton` + `QueryView`; `sonner-native` toasts + `showDialog` replace `Alert`; FlashList on Home / Orders / Notifications; `RemoteImage` branded placeholder (no stock photo); `LoadingSkeleton` / `LogoLoader` deleted
- [x] **Lint** — `apps/client/eslint.config.mjs` + `npm run lint` (bans RN `Animated` / `FlatList` / `SectionList` / `Alert`, Supabase imports in screens; warns hex / `fontSize` literals) — 0 errors
- [x] **State** — all query keys in `src/lib/query-keys.ts`; zustand + MMKV for location, auth prefs, browse prefs, last role, hearts; NetInfo `onlineManager`; order realtime only while an order is active; live-kitchen invalidation fixed (was hitting retired keys)
- [x] Docs: STANDARDS §3a/§3b, `.cursor/rules/ui.mdc`, REQUIREMENTS tables + screen RPCs

### Ponytail audit fixes (steps 1–9) — 2026-11-07
- [x] **1. Sign-up trigger** — `20261107010000_fix_handle_new_user.sql` removes the dropped `user_roles` insert from `public.handle_new_user()`
- [x] **2. Dead Home fetchers** — removed `fetchHomeCatalog`, `fetchHomeShell`, `fetchHomeDishes` (+ unused helpers) from `packages/api/src/mobile/home.ts`
- [x] **3. Dead package & scripts** — deleted `packages/shared` and `scripts/{migrate-client-features,migrate-packages-api,extract-manager-pages}.mjs`
- [x] **4. Admin overview & paging** — `20261107020000_admin_overview.sql` adds `public.admin_overview()` count RPC; `dashboard/admin.ts` paginates list queries with `.range(0, pageSize - 1)` and scopes restaurant profile/member lookups
- [x] **5. Menu image upload** — moved `menu-images` storage upload to `uploadMenuThumb` in `packages/api/src/dashboard/menu.ts` + Vitest
- [x] **6. Kitchen status test** — added full `nextKitchenStatus` transition Vitest in `apps/manager/src/api/orders.test.ts`
- [x] **7. RIO file split** — split `supabase/functions/rio/index.ts` into `index.ts` (HTTP), `turn.ts` (model loop + follow-ups), `stream.ts` (NDJSON stream)
- [x] **8. One-line api shims** — deleted 24 one-line re-export shims under `apps/{client,manager}/src/api/` and pointed imports directly at `@quickbite/api/*`
- [x] **9. Style warnings in touched files** — replaced literal `fontSize` with `AppText variant` in touched client components/screens

### Client UI/UX Pro Max pass (steps 1–7) — 2026-11-07
- [x] **Metro watcher scope** — narrowed `watchFolders` in `apps/client/metro.config.js` and blocked `apps/manager`, `apps/landing`, and `node_modules/**/android/build/**` to avoid Linux `ENOSPC` watcher exhaustion
- [x] **1. Warm contrast tokens** — raised `brandHex.textMuted` to `#6E675F` (≥4.5:1 on warm/white) and `Button` primary fill to `colors.primaryDark` (`#D44812`) with prior hex commented
- [x] **2. Touch targets** — enlarged `QuantityStepper` (`34×34` + `hitSlop={10}`), tab bars (`minHeight: 48`), and heart/favorite controls (`hitSlop={12}` + descriptive accessibility labels)
- [x] **3. Form & error a11y** — wired `accessibilityLabel` on `TextField` and `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"` on inline address errors
- [x] **4. Non-color dietary signal** — added `accessibilityRole="image"` and `Vegetarian` / `Non-vegetarian` label on `VegMark`
- [x] **5. Sheet primitives** — replaced raw slide `Modal` in `NearbyOrderCard` and `AddressEditorModal` with `@/components/Sheet`
- [x] **6. List virtualization** — converted `ExploreScreen` and `FavoritesScreen` vertical feeds from `ScrollView` + `.map` to `@shopify/flash-list`
- [x] **7. Dynamic Type resilience** — added `maxFontSizeMultiplier={1.35}` default on `AppText` so largest system font scales cleanly without clipping
- [x] **8. RIO assistant redesign** — full-width runtime-safe `RioCards` (kitchen/menu headers, receipt cart with savings banner & settled pill, urgency ticket badge), 2×2 starter grid, markdown list/bold rendering, latest-turn-only follow-up chips, Reanimated thinking pill (`ReduceMotion.System`), `primaryDark` contrast, MMKV thread cache, and 0 lint warnings across all RIO files

---

## In progress

| Item | Notes |
|------|--------|
| Cloud apply schema hardening | Run `supabase db push` after CLI auth; then `npm run types:gen` |
| Cloud apply client rebuild | `supabase db push` for `20261106010000` + `20261106020000`, deploy `rio`, re-run embeddings backfill, then `npm run types:gen` — until then Home / Explore / Restaurant / RIO error against cloud |
| Dev client rebuild | New native modules (MMKV, bottom-sheet, gesture-handler, haptics, netinfo, flash-list) need a fresh EAS / `expo run` dev build; Expo Go and old dev clients will crash |
| Android APK distribution | Prefer EAS cloud preview; local `build-*.apk` files are gitignored artifacts only |
| Hosted Auth redirects | Confirm email + Google redirects for Vercel + `quickbite://` |
| Maps secret | Set `OPENROUTESERVICE_API_KEY` in Supabase secrets if directions must avoid OSRM fallback |
| Landing deploy | Optional separate Vercel project for `apps/landing` |

---

## Next

| Priority | Item |
|----------|------|
| Ops | `supabase db push` + `types:gen` for P0–P5 migrations |
| **Now** | Run `npm run types:gen` after applied `20261107*` migrations + deployed `rio` |
| Client | Wire recent searches UI; clear ~278 hex / `fontSize` lint warnings; unused splash images in `assets/images/splash/` |
| Types | Pre-existing `packages/api/src/mobile/profiles.ts` error (`rio_memory` missing from generated `Profile`) — clears after `types:gen` |
| DCT | Create git tag `assessment-3`, paste green CI URL + report links on Dev Control Tower |
| Ops | Auth redirects, ORS key, EAS APK, optional landing deploy |
| Later | Drop legacy payment/rider/`rio_memory` mirror columns after dual-write proves stable; **P7** clean demo seed; optional T5 Modelfile bonus |

---

## Decisions made

| ID | Decision |
|----|----------|
| ADR-001 | Monorepo: client + manager + landing + shared |
| ADR-002 | Supabase = Auth + Postgres + RLS + Realtime + Edge |
| ADR-003 | **Cloud Supabase** is day-to-day DB SoT; local Docker optional |
| ADR-004 | **Single `profiles.role` forever** — two accounts if two jobs |
| ADR-005 | Multi-capability on one login — **rejected** |
| ADR-006 | Order writes **only via RPCs** |
| ADR-007 | Customers browse via `restaurant_browse`, not full restaurant rows |
| ADR-008 | Rider unclaimed pool via **redacted** `list_rider_delivery_pool` |
| ADR-009 | RIO on Edge with **user JWT** (RLS applies to tools) |
| ADR-010 | Chat provider switchable (`llm_config`); embeddings fixed to Ollama `qwen3-embedding:0.6b` **1024-d** |
| ADR-011 | RAG curated rebuild done (menu + comment ratings); Assessment junk corpus cleared |
| ADR-012 | Order accept timeout — **implemented** (default 30 min) |
| ADR-013 | Android package `com.sjinnovation.quickbite`; ship via EAS |
| ADR-014 | Manager service-role helper must not ship to browser; dashboard uses anon + JWT |
| ADR-016 | OK to wipe/rebuild seed later with care for admin |
| ADR-017 | Engineering contract: `docs/STANDARDS.md` + `AGENTS.md` + Cursor/git hooks |
| ADR-018 | Structure: `packages/{domain,db,api}`, one landing app, feature folders in client/manager; quarantine deleted 2026-11-04 |
| ADR-019 | Schema hardening: side tables + dual-write (`order_payments`, `notification_jobs`, `rider_profiles`, `customer_preferences`); fence synthetic from product browse; single checkout offer resolver |
| ADR-020 | Customer screens read through screen-shaped RPCs (`home_feed`, `browse_restaurants`, `restaurant_detail`, `order_tracking`); range / ETA / open-now computed server-side; anon may browse |
| ADR-021 | Entry: splash → login (skippable) → location (GPS / search / Margao fallback) → Home. No diet question at onboarding; Home veg toggle is remembered |
| ADR-022 | Client libraries: reanimated, flash-list, gorhom bottom-sheet, sonner-native, MMKV + zustand, netinfo, expo-haptics. Device prefs on MMKV; server data only in React Query |
| ADR-023 | Synthetic corpus stays in base tables, excluded from every product + RIO read; local demo uses `seeds/goa_demo.sql` |
| A3-001 | Assessment 3 track order was **T4 → T3 → T1 → T2 → T5 → T6 → T7**; see A3-010 |
| A3-010 | Live order: **T6 before T5** (CI/observability before cancel-risk) |
| A3-011 | T5 cancel-risk: offline sklearn only (no live score column); synthetic corpus OK when real closed orders ≪ train size |
| A3-002 | A2 RAG baseline locked at **37.5%** hit-rate for before/after reports |
| A3-003 | T1 vendors: **Twilio** outbound SMS + **Stripe** test inbound webhook (sig verify); ORS/Maps supporting |
| A3-004 | T2: custom Supabase CRM (not HubSpot) |
| A3-006 | Synthetic catalog owner: **one** `restaurant_owner` profile (`e12406d9-382d-5d96-9ef8-b2ffbf46c116`); all synthetic restaurants share `owner_id` — FK kept intact |
| A3-007 | T4 corpus **frozen** at current menu embeddings; skip remaining ≥20k embed backfill |
| A3-008 | RIO RAG = `match_embeddings_hybrid` + LLM re-rank (heuristic fallback); eval `hybrid+rerank` uses same heuristic |
| A3-009 | T3: single `rio` Edge entry; internal supervisor → specialists; customer JWT never calls claim/assign or admin refund RPCs |

---

## Changelog (compressed)

- **2026-11-07** — Ponytail skills in `.cursor/skills/`; always-on rule `.cursor/rules/ponytail.mdc`; completed all 9 Ponytail audit fixes (`handle_new_user`, dead Home fetchers, deleted `packages/shared` + 3 one-off scripts, `admin_overview` RPC + paged admin lists, `uploadMenuThumb` in `@quickbite/api` + Vitest, `nextKitchenStatus` Vitest, `rio` split into `index`/`turn`/`stream`, 24 api shims removed, `AppText variant` in touched client files)
- **2026-11-06** — Client rebuild: Goa seed, catalog UX schema + screen RPCs, RIO grounding, new entry flow, screens on RPCs, UI system (sheets / toasts / FlashList / tokens / lint), state (query keys, MMKV stores, scoped realtime). Cloud push + dev-client rebuild pending
- **2026-11-04** — Schema hardening P0–P5: drop `user_roles`, fence synthetic browse, `resolve_checkout_offer`, `order_payments`, notification outbox, profile side tables; quarantine deleted; unit+edge green (cloud `db push` pending CLI auth)
- **2026-11-04** — Admin Ops: `/admin/ops` metrics page, domain aggregators + tests, Sentry release tags, Edge requestLog
- **2026-11-03** — Structure migration: domain/db/api packages, feature folders, one landing, quarantine (later deleted)
- **2026-11-02** — Engineering standards: `docs/STANDARDS.md`, `AGENTS.md`, `.cursor/rules`, Cursor shell-guard hook, git pre-commit (secrets / `.env`)
- **2026-11-02** — Docs: architecture diagrams use native size + larger fonts; Markdown preview zoom controls always on
- **2026-11-02** — Docs: `docs/architecture.md` — C4 containers, order lifecycle, and module map from the current monorepo
- **2026-10-12** — Manager: Vercel Ready — `vercel.json` `rm -rf node_modules && bun install` so cache cannot keep Start **1.168.32** beside patched **1.168.61**
- **2026-10-12** — Manager: regenerate `apps/manager/bun.lock` + clear stale lock pins so Start resolves to **1.168.61** (CVE-2026-102989 Vercel deploy gate)
- **2026-10-12** — Manager: bump `@tanstack/react-start` to **1.168.61** (CVE-2026-102989 XSS gate on Vercel)
- **2026-10-12** — Fix RIO HTTP 503: removed duplicate `const specialist` (BOOT_ERROR); redeployed `rio`
- **2026-10-12** — A3-T7 **done**: final `ASSESSMENT3_REPORT.{md,html}` + PLAN/PROGRESS sync  
- **2026-10-12** — Images: backfilled 251 restaurants + 20.5k menu `image_url`s; RemoteImage fallback; RIO no longer returns opaque HTTP 503 on soft failures  
- **2026-10-12** — RIO continuity: featuredDishId on offer cards; "order that/proceed" fast-path; place_order tool; card digests in thread history  
- **2026-10-12** — RIO: less wizard/theme funnel; clear dish → find_offers; softer clarify; more tool steps  
- **2026-10-12** — Checkout UX: gated splash; order-placed success screen; Stripe `openAuthSessionAsync` + app deep-link return + retry  
- **2026-10-11** — A3-T5 **done**: cancel-risk F1 **0.845** (P 0.867 / R 0.825); Next = T7  
- **2026-10-11** — A3-T6 **done**: GHA CI, optional Sentry, RIO rate-limit, directions cache; Next = T5  
- **2026-10-11** — A3-T3 **done**: supervisor → order/dispatch/support; guardrails; `estimate_eta`; Next = T1  
- **2026-10-11** — A3-T4 **done**: RIO on hybrid + re-rank; corpus frozen; eval hybrid+rerank hit@5 **81.8%**  

- **2026-10-09** — A3-T4: fixed + applied hybrid migration; `match_embeddings_hybrid` smoke OK; backfill writes content/hash/metadata; 200 timed (~189 min / 20k est)

- **2026-10-09** — Synthetic datagen loaded: **250** restaurants + **20,500** menu_items (`is_synthetic=true`); one synthetic owner; scripts in `scripts/datagen/`  
- **2026-10-09** — A3-T4 eval rebuild: 73 canonical_key queries + modes; old test hit@5 **48.5%** / OOC 50% (`docs/rag-a3/results.md`); hybrid blocked pending migration apply  
- **2026-10-09** — A3-T4 Phase **1**: drafted hybrid migration + `match_embeddings_hybrid` (not applied); review in `docs/rag-a3/01-phase1-review.md`  

- **2026-10-09** — A3-T4 Phase **0b**: rebound eval gold by dish name; baseline-v0 matching **50%** / precision **20%** (qwen, 388 rows); A2 37.5% footnote only  
- **2026-10-09** — A3-T4 Phase **0a**: restored `docs/rag/`; cloud probe (388 embeddings, dirty gold IDs); audit in `docs/rag-a3/00-audit.md`  
- **2026-10-09** — `docs/PLAN.md` rewritten for Assessment 3; A2 work archived as baseline; Next = T4 first  
- **2026-10-08** — RIO discovery (`browse_themes` / `find_offers` / `verify_dish`) + two-order seller + graceful degradation; catalog RAG; truth layer A–E; docs + PLAN.md  
- **2026-10-07** — Production waves 0–6; customer perf; Phase 4 batches 2–3  
- **2026-10-06** — Phase 4 batch 1 (PII, webhook, secrets, timeout, seed)  
- **2026-10-01** — Delivery handoff: migrations/functions/dashboard smoke; quarantine local noise  
