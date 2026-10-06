# 02 — Repo map (“where do I find X?”)

Paths are from the repo root. Prefer changing the listed file; do not duplicate logic elsewhere without updating this table later.

---

## Apps & entry

| I want to… | Go here |
|------------|---------|
| Start mobile app | `apps/client/` → `npx expo start` or root `npm run client` |
| Mobile root layout / providers | `apps/client/app/_layout.tsx` |
| Mobile role redirect after login | `apps/client/app/index.tsx` |
| Customer tab routes | `apps/client/app/(customer)/(tabs)/` |
| Rider tab routes | `apps/client/app/(rider)/(tabs)/` |
| Auth screens (login/signup) | `apps/client/src/screens/auth/` + `app/(auth)/` |
| Start dashboard | `apps/manager/` → root `npm run dashboard` |
| Dashboard auth gate / role routing | `apps/manager/src/components/auth-gate.tsx` |
| Dashboard routes | `apps/manager/src/routes/` |
| Admin pages | `apps/manager/src/routes/admin/` + `features/admin/` |
| Marketing landing | `apps/landing/` → `npm run landing` |
| Shared brand colours | `packages/shared/src/brand-tokens.ts` |
| Shared order/role helpers | `packages/shared/src/index.ts` (re-exports `supabase/functions/_shared/rules.ts`) |

---

## Auth

| I want to… | Go here |
|------------|---------|
| Client email / Google sign-in | `apps/client/src/api/auth.ts` |
| Client session + profile context | `apps/client/src/hooks/useAuth.tsx` |
| Manager email / Google sign-in | `apps/manager/src/api/auth.ts` |
| Profile row creation on signup | Migration `supabase/migrations/20260919144816_auth_trigger.sql` (final always-customer body in `20260921133100_roles_and_applications.sql`) |
| Block self role change | `20260919181927_helpers_and_guards.sql` + `20260922154000_single_role_column.sql` |
| Apply as rider / owner | Client careers/settings → `apps/client/src/api/applications.ts` → RPC `submit_application` |
| Admin approve applications | Manager admin + RPC `admin_review_application` (`20260921133300_roles_rpcs.sql`) |
| Owner invite manager | RPC `owner_invite_manager` / `accept_manager_invite` |

---

## Customer ordering

| I want to… | Go here |
|------------|---------|
| Home / browse data | `apps/client/src/api/home.ts`, `restaurants.ts` |
| Restaurant detail UI | `apps/client/src/screens/customer/RestaurantDetailScreen.tsx` |
| Cart API | `apps/client/src/api/cart.ts` |
| Cart rules (one restaurant) | Trigger `enforce_cart_rules` — `20260919182625_cart_rules.sql` |
| Checkout / place order | Checkout screen → RPC `place_order` (latest body in delivery-fee / foundations migrations) |
| Orders list / tracking | `apps/client/src/api/orders.ts`, `order-tracking.ts`, `hooks/useOrderTracking.ts` |
| Saved addresses | `apps/client/src/api/addresses.ts` + table `customer_addresses` |
| Ratings | Insert into `ratings` (RLS) from order UI |
| Theme colours (mobile) | `apps/client/src/constants/theme.ts` → brand tokens |
| Order status badge colours | `apps/client/src/constants/orderStatus.ts` |
| Delivery fee constant (app side) | `apps/client/src/constants/pricing.ts` (+ SQL `standard_delivery_fee()`, RIO `STANDARD_DELIVERY_FEE`) |

---

## Rider

| I want to… | Go here |
|------------|---------|
| Rider home / available jobs | `apps/client/src/features/rider/` |
| Delivery pool (redacted) | RPC `list_rider_delivery_pool` — `20260929122000_rider_pool_redacted.sql` |
| Claim delivery | RPC `claim_delivery` |
| Mark out for delivery / delivered | RPC `rider_set_order_status` |
| Duty online/offline | RPC `rider_set_duty` |
| GPS ping | `rider-tracking.ts` + RPC / `rider_locations` |
| Rider RLS on orders | `orders: rider reads assigned` policy |

---

## Kitchen / owner / admin (web)

| I want to… | Go here |
|------------|---------|
| Kitchen order actions | `apps/manager/src/api/orders.ts` → `restaurant_set_order_status` |
| Menu CRUD | `apps/manager/src/api/menu.ts` |
| Restaurant open/close / profile | `apps/manager/src/api/restaurants.ts` |
| Admin users / highlights | `apps/manager/src/features/admin/`, `routes/admin/` |
| LLM provider switch UI | Admin AI area + RPC `activate_llm_config` + table `llm_config` |
| Dashboard CSS theme | `apps/manager/src/styles.css` |
| Supabase browser client | `apps/manager/src/integrations/supabase/client.ts` |
| Service-role helper (unused by routes) | `apps/manager/src/integrations/supabase/client.server.ts` |

---

## Database & security

| I want to… | Go here |
|------------|---------|
| Create / alter tables | **New** file under `supabase/migrations/` only (never edit old ones in Phase 4) |
| Initial schema | `20260919120737_init_schema.sql` |
| RLS policies (original) | `20260919182235_rls_policies.sql` |
| Later RLS hardenings | `20260922150000_*` … `20260929122000_*`, intelligence migrations |
| Order write RPCs | `20260919183135_rpcs.sql` then roles/backend rewrites |
| Roles / applications schema | `20260921133100_roles_and_applications.sql` |
| Embeddings + llm_config | `20260929140000_llm_config_and_embeddings.sql` |
| Intelligence (tickets, auto-assign) | `20260929160000_intelligence_layer.sql` |
| RAG order-history match | `20261001120000_match_embeddings_order_history.sql` |
| Local CLI config | `supabase/config.toml` |
| Manual SQL seeds | `supabase/scripts/*.sql` |
| Generated seed pipeline | `scripts/generate-seed-data.mjs`, `push-seed-data.mjs` |

---

## RIO / AI

| I want to… | Go here |
|------------|---------|
| RIO HTTP entry + system prompt + tool list | `supabase/functions/rio/index.ts` |
| Tool implementations | `supabase/functions/rio/tools.ts` |
| Chat provider (Groq/Ollama) | `supabase/functions/_shared/llm.ts` |
| Embeddings / retrieveContext | `supabase/functions/_shared/embeddings.ts` |
| Client RIO screen | `apps/client/src/screens/customer/RioScreen.tsx` |
| Client call to edge | `apps/client/src/api/rio.ts` |
| Backfill vectors | `scripts/backfill-embeddings.mjs` |
| RAG eval | `scripts/eval-rag.mjs`, `docs/rag/` |

---

## Push, maps, storage

| I want to… | Go here |
|------------|---------|
| Register push token | `apps/client/src/notifications/` + RPC `register_push_device` |
| Order push webhook | `supabase/functions/notify-new-order/index.ts` |
| Directions / ETA polyline | `supabase/functions/directions/index.ts` + `apps/client/src/api/routes.ts` |
| Menu image bucket rules | `20260919183834_storage_rules.sql` (+ roles rewrite) |

---

## Env, build, tests

| I want to… | Go here |
|------------|---------|
| Env var names | Root `.env.example`, `apps/client/.env.example`, `apps/manager/.env.example` |
| Android package id | `apps/client/app.json` → `com.sjinnovation.quickbite` |
| EAS profiles (APK) | `apps/client/eas.json` |
| Unit / edge / integration / e2e | Root `package.json` scripts; `tests/integration/`; `apps/manager/e2e/` |
| Regenerate TS DB types | `npm run types:client` → `apps/client/src/types/database.ts` |

---

## Docs & quarantine

| I want to… | Go here |
|------------|---------|
| Current audit | `docs/00-audit.md` |
| This map | `docs/02-repo-map.md` |
| Old audits | `docs/historical/` |
| Parked seed JSON / temp artifacts | `_delivery_quarantine/` (not runtime — see FAQ) |
