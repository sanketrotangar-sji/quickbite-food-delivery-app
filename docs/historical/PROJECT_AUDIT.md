# QuickBite — Project audit (source of truth)

**Date:** 2026-09-30  
**Method:** Read-only inspection of migrations, apps, edge functions, docs, and tests. Claims cite file paths. Items not proven wired end-to-end are marked **unverified** or given a non-COMPLETE status.  
**Original brief:** `docs/requirements.md`

---

## 1. Tech stack and architecture

### Stack


| Layer         | Choice                                                     | Evidence                                                                                                               |
| ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Monorepo      | npm workspaces `apps/*`, `packages/*`                      | `package.json`                                                                                                         |
| Mobile        | Expo ~57, Expo Router, React Native 0.86, React 19         | `apps/client/package.json`                                                                                             |
| Mobile data   | `@supabase/supabase-js`, TanStack Query                    | `apps/client/package.json`, `apps/client/src/api/*`                                                                    |
| Maps          | MapLibre RN + `directions` edge fn (OpenRouteService)      | `apps/client/package.json`, `supabase/functions/directions/index.ts`, `apps/client/src/api/routes.ts`                  |
| Push          | `expo-notifications` + `push_device_tokens`                | `apps/client/src/notifications/NotificationProvider.tsx`, `supabase/migrations/20260923170000_backend_foundations.sql` |
| Web dashboard | Vite 8, React 19, TanStack Router/Start, Tailwind 4, Radix | `apps/manager/package.json`                                                                                            |
| Shared rules  | `@quickbite/shared` (order/role helpers)                   | `packages/shared/src/index.ts`                                                                                         |
| Backend       | Supabase Auth + Postgres + RLS + Edge Functions (Deno)     | `supabase/`, `docs/architecture.md`                                                                                    |
| AI chat       | Groq or Ollama via `llm_config`                            | `supabase/functions/_shared/llm.ts`, `supabase/migrations/20260929140000_llm_config_and_embeddings.sql`                |
| Embeddings    | Ollama `nomic-embed-text` 768-d + pgvector                 | `supabase/functions/_shared/embeddings.ts`, `20260929140000_llm_config_and_embeddings.sql`                             |




### Folder structure (by role)

```text
QuickBite/
├── apps/client/          # Expo: customer + rider (+ careers apply)
├── apps/manager/         # Vite web: restaurant_owner / restaurant_manager / admin
├── packages/shared/      # Shared pure rules + types
├── supabase/
│   ├── migrations/       # Schema, RLS, RPCs, automations
│   ├── functions/        # rio, notify-new-order, directions
│   └── seed-data/        # Generated seed bundle
├── scripts/              # seed, embeddings, ML, RAG eval, tests
├── docs/                 # architecture, setup, requirements, ml, rag
└── tests/integration/    # order happy-path script
```

Role → app mapping (enforced in code + docs): `docs/architecture.md`, `apps/client/app/_layout.tsx`, `apps/manager/src/components/auth-gate.tsx`.

### How frontends talk to Supabase

- Both apps use the **anon key** + user JWT; all privileged writes go through **RPCs** or RLS-scoped table access.
- Client rule: Supabase calls live under `apps/client/src/api/` only (`docs/architecture.md`).
- Manager uses `apps/manager/src/integrations/supabase/client.ts` + `src/api/*`.
- Edge: `rio`, `directions` (JWT), `notify-new-order` (webhook secret, `verify_jwt = false` in config — see gaps).



### Deployment


| Surface        | Target                                           | Evidence                                                       |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Manager web    | Vercel root `apps/manager`                       | `docs/architecture.md`, live URL in `README.md`                |
| Client         | Expo Go / EAS APK (`com.sjinnovation.quickbite`) | `docs/architecture.md`, `apps/client/package.json` scripts     |
| DB / functions | Linked Supabase project                          | `docs/setup.md`, `package.json` `db:push` / `functions:deploy` |


No `vercel.json` in repo — Vercel project settings are **unverified** beyond docs/README.

### Env vars (names only)

From `.env.example`:


| Name                            | Used by                      |
| ------------------------------- | ---------------------------- |
| `VITE_SUPABASE_URL`             | Manager                      |
| `VITE_SUPABASE_ANON_KEY`        | Manager                      |
| `EXPO_PUBLIC_SUPABASE_URL`      | Client                       |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Client                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | Scripts / edge / seed        |
| `WEBHOOK_SECRET`                | `notify-new-order`           |
| `OPENROUTESERVICE_API_KEY`      | `directions`                 |
| `GROQ_API_KEY`                  | RIO chat (Groq)              |
| `GROQ_MODEL`                    | Optional chat model override |
| `OLLAMA_BASE_URL`               | Chat (Ollama) + embeddings   |
| `EXPO_ACCESS_TOKEN`             | Optional Expo push           |


---



## 2. Database inventory

**Source of column shapes:** migrations + `apps/client/src/types/database.ts` (more complete than manager types, which omit several later tables/columns).

### Order status enum

`placed | preparing | ready | out_for_delivery | delivered | cancelled` — `supabase/migrations/20260919120737_init_schema.sql`.

### App roles (extended beyond original 3)

`customer | restaurant_manager | rider | restaurant_owner | admin` — migrations `20260921133000_extend_app_role.sql`, `20260921133050_extend_app_role.sql`; precedence in `20260929121000_owner_lock_and_role_precedence.sql`.

### Spec tables (original 6) — present and extended


| Table         | Columns (final)                                                                                                                                                                                                                                                 | FKs                                                                            | Notes                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `profiles`    | id, full_name, email, role, phone, created_at, updated_at, **is_online, vehicle_label, plate**                                                                                                                                                                  | id → auth.users                                                                | RLS on                                                               |
| `restaurants` | id, owner_id, name, description, cuisine, address, phone, image_url, is_open, created_at, updated_at, **branch_name, lat, lng, offer_percent, prep_minutes**                                                                                                    | owner_id → profiles                                                            | RLS on; unique(owner_id) dropped for multi-branch (`20260921133100`) |
| `menu_items`  | id, restaurant_id, name, description, price, image_url, is_available, created_at, updated_at, **category, is_veg**                                                                                                                                              | restaurant_id → restaurants                                                    | RLS on                                                               |
| `orders`      | id, customer_id, restaurant_id, rider_id, status, total_amount, delivery_address, delivery_lat/lng, notes, placed_at, delivered_at, updated_at, **delivery_fee, delivery_address_id, rider_earning, tip_amount, bonus_amount, pickup_km, drop_km, eta_minutes** | customer/restaurant/rider → profiles/restaurants; address → customer_addresses | RLS on; writes via RPCs                                              |
| `order_items` | id, order_id, menu_item_id, item_name, quantity, unit_price, line_total (generated)                                                                                                                                                                             | order, menu_item                                                               | RLS on; insert only via `place_order`                                |
| `ratings`     | id, order_id (unique), customer_id, restaurant_id, rider_id, food_rating, delivery_rating, comment, created_at                                                                                                                                                  | order + profiles + restaurants                                                 | RLS on                                                               |




### Extra tables / views (beyond the 6)


| Object                          | Purpose                                                          | Created                                    |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `cart_items`                    | Server-backed cart                                               | init                                       |
| `order_status_history`          | Append-only status timeline (trigger-written)                    | init                                       |
| `rider_locations`               | Live rider pin (1 row/rider)                                     | init                                       |
| `user_roles`                    | Legacy multi-role rows (still present; app uses `profiles.role`) | `20260921133100`                           |
| `applications`                  | Rider / owner applications                                       | `20260921133100`                           |
| `restaurant_members`            | Manager↔kitchen membership                                       | `20260921133100`                           |
| `manager_invites`               | Email invites                                                    | `20260921133100`                           |
| `home_highlights`               | Promo rail / offers                                              | `20260921133400` (+ offer restaurant link) |
| `notifications`                 | In-app notices                                                   | `20260923003300`                           |
| `customer_addresses`            | Saved delivery addresses                                         | `20260923170000`                           |
| `push_device_tokens`            | Expo push tokens                                                 | `20260923170000`                           |
| `llm_config`                    | Active chat provider (groq/ollama)                               | `20260929140000`                           |
| `embeddings`                    | RAG vectors (service_role only)                                  | `20260929140000`                           |
| `support_tickets`               | RIO complaint tickets                                            | `20260929160000`                           |
| `automation_events`             | Auto-assign / ETA audit                                          | `20260929160000`                           |
| `automation_config`             | Tunables for kitchen-load alerts                                 | `20260929160000`                           |
| View `restaurant_browse`        | Public browse fields (no owner/phone)                            | `20260923003300`                           |
| View `restaurant_rating_public` | restaurant_id + food_rating for averages                         | `20260922152000`                           |




### Triggers (high-signal)


| Trigger                             | Table                                          | Behavior                                        | File                                                 |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `on_auth_user_created`              | auth.users                                     | Creates `profiles` (+ customer role)            | `20260919144816_auth_trigger.sql`                    |
| `profiles_guard_update`             | profiles                                       | Blocks role self-escalation                     | `20260919181927` / later                             |
| `*_touch`                           | restaurants, menu_items, orders, cart_items, … | `updated_at`                                    | `20260919182358_triggers.sql`                        |
| `orders_log_status_on_*`            | orders                                         | Writes `order_status_history`                   | same                                                 |
| `cart_items_rules`                  | cart_items                                     | One restaurant per cart; derive restaurant_id   | `20260919182625_cart_rules.sql`                      |
| `orders_on_delivered`               | orders                                         | Sets `delivered_at`                             | `20260919183052_optional_rule.sql`                   |
| `restaurants_guard_owner_id`        | restaurants                                    | Locks `owner_id`                                | `20260929121000`                                     |
| `orders_auto_assign_rider`          | orders                                         | On → `ready` + null rider: nearest online rider | `20260929160000`                                     |
| Address / push / llm stamp triggers | various                                        | Defaults, token state, actor stamp              | `20260923174500`, `20260923170000`, `20260929140000` |




### RPCs / functions (public, app-facing)


| RPC                                                                                               | Role                              | Evidence                                      |
| ------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------- |
| `place_order`                                                                                     | Customer                          | `20260919183135` / later fee+address versions |
| `restaurant_set_order_status`                                                                     | Kitchen                           | preparing/ready/cancelled transitions         |
| `claim_delivery`                                                                                  | Rider                             | Race-safe claim                               |
| `rider_set_order_status`                                                                          | Rider                             | out_for_delivery / delivered                  |
| `rider_set_duty` / `rider_update_location`                                                        | Rider                             | Duty + GPS                                    |
| `list_rider_delivery_pool`                                                                        | Rider                             | Redacted available pool                       |
| `list_my_restaurants`                                                                             | Partner                           | Multi-branch                                  |
| `submit_application` / `admin_review_application`                                                 | Customer / admin                  | Careers + admin                               |
| `owner_create_branch` / `owner_invite_manager` / `accept_manager_invite` / `owner_revoke_manager` | Owner                             | Business                                      |
| `set_default_customer_address` / `register_push_device`                                           | Customer                          | Addresses / push                              |
| `standard_delivery_fee`                                                                           | Anyone authenticated              | Pricing helper                                |
| `activate_llm_config`                                                                             | Admin                             | Provider switch                               |
| `match_embeddings`                                                                                | Service / edge (security definer) | RAG                                           |
| `run_kitchen_load_alerts`                                                                         | service_role / cron               | ETA bumps                                     |


Private helpers: `private.has_role`, `grant_role`, `manages_restaurant`, `auto_assign_rider`, `haversine_km`, etc.

### RLS summary (plain language)

RLS is **enabled** on all app tables created in migrations. Notable policies:


| Table                                                         | Who can read                                                                         | Who can write                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `profiles`                                                    | Self; order counterparties; admin; owners read staff                                 | Self update (role guarded by trigger); no user insert |
| `restaurants`                                                 | Authenticated browse (later scoped for staff/admin extras)                           | Owner create/update/delete; staff update managed      |
| `menu_items`                                                  | Available items (or staff of kitchen)                                                | Staff of managed restaurant                           |
| `orders`                                                      | Customer own; staff managed; rider assigned; admin all; pool via RPC not full SELECT | **No direct client writes** — RPCs only               |
| `order_items` / `order_status_history`                        | Via parent order visibility                                                          | History insert = trigger only                         |
| `cart_items`                                                  | Owner only                                                                           | Owner all                                             |
| `ratings`                                                     | Parties (customer/staff/rider/admin) — not world-readable                            | Customer insert on own **delivered** order            |
| `rider_locations`                                             | Rider own; customer while `out_for_delivery`                                         | Rider write own (RPC preferred)                       |
| `customer_addresses` / `notifications` / `push_device_tokens` | Owner rows                                                                           | Owner CRUD / mark-read                                |
| `applications` / `manager_invites` / `restaurant_members`     | Self / owner / admin                                                                 | Via RPCs + policies in `20260921133200`               |
| `home_highlights`                                             | Active for all auth; admin full CRUD                                                 | Admin                                                 |
| `llm_config`                                                  | Authenticated read                                                                   | Admin write / `activate_llm_config`                   |
| `embeddings`                                                  | **No anon/authenticated policies** — service_role only                               | Backfill / edge                                       |
| `support_tickets`                                             | Customer own; kitchen/admin for kitchen tickets                                      | Customer insert own; staff update                     |
| `automation_events`                                           | Admin; customer own order; kitchen                                                   | Inserts from automations (definer)                    |
| `automation_config`                                           | Authenticated read                                                                   | Admin write                                           |


**Flags**

- `embeddings`: RLS on, **zero client policies** (intentional; service role / `match_embeddings`).
- **Both** generated type files lag migrations: manager types omit addresses/notifications/push and several order/restaurant columns; client types omit `llm_config`, `embeddings`, `support_tickets`, `automation_`*. Schema source of truth = `supabase/migrations/`.
- Live DB row counts: **unverified** in this audit (seed *targets* in `supabase/seed-data/generated/manifest.json`: e.g. 35 restaurants, 350 menu items, 750 orders, 450 ratings).

---



## 3. Auth and roles



### Email / password


| Flow             | Wired?             | Evidence                                                                                   |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Client sign-in   | Yes                | `apps/client/src/api/auth.ts` → `signInWithPassword`; screens under `app/(auth)/`          |
| Client sign-up   | Yes                | `signUpWithEmail`; `SignupScreen` — name/email/password/phone only                         |
| Manager sign-in  | Yes                | `apps/manager/src/routes/login.tsx` — email/password + Google                              |
| Manager “signup” | Informational only | `routes/signup.tsx` — tells partners to apply via the customer app; no account-create form |




### Google login


| Surface | Wired? | Evidence                                                                                                          |
| ------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Client  | Yes    | `signInWithGoogle` OAuth + session exchange in `apps/client/src/api/auth.ts`; used from **login** UI (not signup) |
| Manager | Yes    | `signInWithGoogle` on `routes/login.tsx`                                                                          |




### Role selection at signup

**Not implemented.** Signup never asks for customer/restaurant/rider. Every new user is created as **customer** by `handle_new_user` (`20260919144816_auth_trigger.sql` / roles migrations). Extra roles via:

1. Careers apply → `applications` → admin approve (`submit_application` / `admin_review_application`) — `CareersScreen`, admin Applications.
2. Owner invites manager → `accept_manager_invite`.
3. Admin seeded via SQL (`docs/architecture.md`).



### Role enforcement


| Layer                  | Mechanism                                                                          | Evidence                                                      |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Client routes          | `Stack.Protected` for auth; rider stack redirects non-riders to `/(blocked)/rider` | `apps/client/app/_layout.tsx`, `app/(rider)/_layout.tsx`      |
| Client side preference | `last-role` AsyncStorage (customer vs rider UI)                                    | `apps/client/app/index.tsx`, `lib/last-role`                  |
| Manager                | `AuthGate`: admin → `/admin*`; partner → kitchen; else `/blocked`                  | `apps/manager/src/components/auth-gate.tsx`                   |
| DB                     | RLS + `private.has_role` / RPC checks                                              | migrations above                                              |
| Self-deal guards       | Rider cannot deliver own order; kitchen/order ownership checks                     | `20260922155000_rider_status_self_deal.sql`, place_order RPCs |




### Spec sidebar vs implemented



#### Customer (spec: Browse, Cart, Orders, Track, Profile)


| Spec item          | Status          | Actual UI               | Evidence                                             |
| ------------------ | --------------- | ----------------------- | ---------------------------------------------------- |
| Browse Restaurants | **IMPLEMENTED** | Home + Explore tabs     | `(tabs)/index`, `(tabs)/picks`, `restaurant/[id]`    |
| My Cart            | **IMPLEMENTED** | Stack route (not a tab) | `(customer)/cart.tsx`, `CheckoutScreen`              |
| My Orders          | **IMPLEMENTED** | Orders tab              | `(tabs)/reorder.tsx` → `OrdersScreen`                |
| Track Order        | **IMPLEMENTED** | Order detail / tracking | `(customer)/orders/[id].tsx` → `OrderTrackingScreen` |
| My Profile         | **IMPLEMENTED** | Profile tab             | `(tabs)/settings.tsx` → `EditProfileScreen`          |


Extra tabs beyond spec: **RIO** assistant (`(tabs)/assistant.tsx`).

#### Restaurant (spec: Dashboard, Menu, Incoming, History, Profile)


| Spec item       | Status                            | Actual UI                                                                                                                                                           | Evidence                                                                    |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Dashboard       | **IMPLEMENTED**                   | `/`                                                                                                                                                                 | `routes/index.tsx`, nav in `quickbite-shell.tsx`                            |
| My Menu         | **IMPLEMENTED** (edit incomplete) | `/menu`                                                                                                                                                             | `routes/menu.tsx` — add/toggle/delete wired; **Edit button has no handler** |
| Incoming Orders | **IMPLEMENTED**                   | `/orders` filters Incoming/preparing/ready                                                                                                                          | `routes/orders.tsx`                                                         |
| Order History   | **PARTIAL**                       | No History nav/route. `/orders` query includes kitchen statuses **or** last 7 days, but UI filters are only `all/placed/preparing/ready` — no delivered/history tab | `listRestaurantOrders` in `api/orders.ts`, `routes/orders.tsx`              |
| My Profile      | **PARTIAL**                       | Shell has Feedback/Help **buttons with no navigation**; logout works. Owner “Business” at `/business` is the profile/kitchen settings surface                       | `quickbite-shell.tsx`, `routes/business.tsx`                                |


Extra: **Performance** `/performance`, owner **Business**, full **Admin** platform.

#### Rider (spec: Dashboard, Available, My Deliveries, History, Profile)


| Spec item            | Status          | Actual UI                                             | Evidence                                                                  |
| -------------------- | --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| Dashboard            | **IMPLEMENTED** | Rider Home tab                                        | `(rider)/(tabs)/index` → `RiderHomeScreen` (live pool + duty)             |
| Available Deliveries | **IMPLEMENTED** | “Nearby Orders” on home                               | `useRiderOrders` → `listAvailableDeliveries` / `list_rider_delivery_pool` |
| My Deliveries        | **IMPLEMENTED** | Active segment + delivery screen                      | `(tabs)/orders`, `(rider)/delivery`                                       |
| Delivery History     | **IMPLEMENTED** | Completed segment + Earnings tab                      | `RiderOrdersScreen`, `EarningsScreen`                                     |
| My Profile           | **PARTIAL**     | Profile tab; personal/vehicle/docs mostly local stubs | `RiderProfileScreen`, `RiderAccountScreens.tsx`                           |


Extra: Earnings tab, Help (static FAQ), Report, Preferences (push toggle wired).

---



## 4. Feature matrix


| Feature                                                  | Role               | Status               | Evidence                                                                                                                                                     | Notes                                                                                                                                                 |
| -------------------------------------------------------- | ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email/password auth                                      | All                | COMPLETE             | `apps/client/src/api/auth.ts`, manager auth                                                                                                                  |                                                                                                                                                       |
| Google OAuth                                             | Customer + Manager | COMPLETE             | Client `auth.ts`; manager `routes/login.tsx`                                                                                                                 | Hosted Auth provider config is ops setup (`docs/setup.md`)                                                                                            |
| Role pick at signup                                      | —                  | STUB / absent        | `SignupScreen`                                                                                                                                               | Always customer via trigger                                                                                                                           |
| Browse restaurants/menu                                  | Customer           | COMPLETE             | `api/home.ts`, `RestaurantDetailScreen`, `restaurant_browse`                                                                                                 | Live DB catalog; explore cards may show **hashed fake review counts / default discounts** when offer/prep missing (`lib/home-presentation.ts`)        |
| Cart add/update/clear                                    | Customer           | COMPLETE             | `api/cart.ts`, `useCart`, cart RLS + trigger                                                                                                                 | One-restaurant rule                                                                                                                                   |
| Checkout + place order                                   | Customer           | COMPLETE             | `CheckoutScreen` → `place_order` RPC                                                                                                                         | Needs address lat/lng; COD-oriented UI; `TripMap` on checkout is decorative (`TripMap.tsx`); UPI/card/wallet in `PaymentSheet.tsx` are disabled stubs |
| Saved addresses                                          | Customer           | COMPLETE             | `api/addresses.ts`, `customer_addresses`, defaults RPCs                                                                                                      |                                                                                                                                                       |
| Order list                                               | Customer           | COMPLETE             | `OrdersScreen`, `api/orders.ts`                                                                                                                              |                                                                                                                                                       |
| Live track + timeline                                    | Customer           | COMPLETE             | `OrderTrackingScreen`, `order_status_history`, realtime hooks                                                                                                | Map + history                                                                                                                                         |
| Rider live map for customer                              | Customer           | COMPLETE             | `rider_locations` + `CustomerOrderMap`                                                                                                                       | While `out_for_delivery`                                                                                                                              |
| Live order maps (tracking/delivery)                      | Customer/Rider     | COMPLETE             | `CustomerOrderMap`, `RiderRouteMap`, MapLibre when native maps supported                                                                                     | Expo Go: map unavailable message; needs EAS/dev build                                                                                                 |
| Driving route polyline                                   | Customer/Rider     | COMPLETE             | `api/routes.ts` → `directions` function                                                                                                                      | Needs `OPENROUTESERVICE_API_KEY`                                                                                                                      |
| Rate delivered order                                     | Customer           | **PARTIAL**          | Table + insert RLS; UI **reads** ratings only (`RestaurantReviews`, home averages). **No insert UI/API call in apps/**; `canRate` in `orderStatus.ts` unused | Spec step 6 incomplete                                                                                                                                |
| Favorites / hearts                                       | Customer           | **PARTIAL**          | `useSavedHearts` → AsyncStorage only                                                                                                                         | Not a DB table                                                                                                                                        |
| In-app notifications list                                | Customer           | COMPLETE             | `NotificationsScreen`, `notifications` table                                                                                                                 |                                                                                                                                                       |
| Push notifications                                       | Customer/Rider     | COMPLETE             | `NotificationProvider`, `register_push_device`, `notify-new-order`                                                                                           | Needs native build + webhook                                                                                                                          |
| RIO assistant                                            | Customer           | COMPLETE             | Tab + `api/rio.ts` → `functions/rio` (9 LLM tools + client actions `confirm_order` / `replace_cart`)                                                         | Needs LLM secrets + embeddings for RAG quality                                                                                                        |
| Kitchen dashboard stats                                  | Restaurant         | COMPLETE             | `routes/index.tsx`, orders query                                                                                                                             |                                                                                                                                                       |
| Menu create / availability / veg / delete / image upload | Restaurant         | COMPLETE             | `routes/menu.tsx`, `api/menu.ts`, storage policies                                                                                                           |                                                                                                                                                       |
| Menu edit existing fields                                | Restaurant         | **STUB**             | Edit icon in `menu.tsx` with **no onClick**                                                                                                                  |                                                                                                                                                       |
| Advance order placed→preparing→ready                     | Restaurant         | COMPLETE             | `restaurant_set_order_status`, `useAdvanceOrder`                                                                                                             | Realtime kitchen hooks present                                                                                                                        |
| Cancel order (kitchen)                                   | Restaurant         | **PARTIAL**          | RPC allows `cancelled`; UI never calls it                                                                                                                    |                                                                                                                                                       |
| Order status timeline (kitchen drawer)                   | Restaurant         | COMPLETE             | `order-drawer.tsx` + history select                                                                                                                          |                                                                                                                                                       |
| Performance charts                                       | Restaurant         | COMPLETE             | `routes/performance.tsx`                                                                                                                                     |                                                                                                                                                       |
| Owner business / branches / invites                      | Owner              | COMPLETE             | `routes/business.tsx`, owner RPCs                                                                                                                            |                                                                                                                                                       |
| Rider duty on/off                                        | Rider              | COMPLETE             | `rider_set_duty`, `RiderHomeScreen`                                                                                                                          |                                                                                                                                                       |
| Available pool + claim                                   | Rider              | COMPLETE             | `list_rider_delivery_pool`, `claim_delivery`                                                                                                                 | Auto-assign may claim first                                                                                                                           |
| Start delivery / mark delivered                          | Rider              | COMPLETE             | `rider_set_order_status` via `api/deliveries.ts`                                                                                                             |                                                                                                                                                       |
| Background location while delivering                     | Rider              | COMPLETE             | `rider-tracking.ts`, `rider_update_location`                                                                                                                 | Native build required                                                                                                                                 |
| Rider earnings from DB                                   | Rider              | COMPLETE             | Computed from delivery history pay fields                                                                                                                    | Dead mock constants in `rider-home.ts` unused by screens                                                                                              |
| Rider personal/vehicle save                              | Rider              | **STUB**             | Local state; copy says not stored                                                                                                                            | `RiderAccountScreens.tsx`                                                                                                                             |
| Rider documents                                          | Rider              | **STUB**             | Hardcoded “On file” rows                                                                                                                                     | same file                                                                                                                                             |
| Rider drop ETA copy                                      | Rider              | **STUB**             | Hardcoded `"about 16 min"` on delivery UI                                                                                                                    | `DeliveryScreen.tsx`                                                                                                                                  |
| Rider rating stat                                        | Rider              | **STUB**             | `todayStats` returns `rating: 'New'` — not from `ratings`                                                                                                    | `use-rider-live.ts`                                                                                                                                   |
| Careers apply rider/owner                                | Customer           | COMPLETE             | `CareersScreen` → `submit_application`                                                                                                                       |                                                                                                                                                       |
| Admin approve applications                               | Admin              | COMPLETE             | `/admin/applications`                                                                                                                                        |                                                                                                                                                       |
| Admin users / restaurants / offers                       | Admin              | COMPLETE             | `/admin/users`, `restaurants`, `highlights`                                                                                                                  |                                                                                                                                                       |
| Admin LLM switch                                         | Admin              | COMPLETE             | `/admin/ai` → `activate_llm_config`                                                                                                                          |                                                                                                                                                       |
| Auto rider assign on ready                               | System             | COMPLETE             | trigger `orders_auto_assign_rider`                                                                                                                           | Needs online riders w/ location                                                                                                                       |
| Kitchen-load ETA bump                                    | System             | COMPLETE             | `run_kitchen_load_alerts` + pg_cron schedule attempt                                                                                                         | Cron availability host-dependent                                                                                                                      |
| Support tickets via RIO                                  | Customer           | COMPLETE             | `escalate_complaint` → `support_tickets`                                                                                                                     | No dedicated kitchen ticket UI found                                                                                                                  |
| Customer cancel order                                    | Customer           | **PLANNED** / absent | No client cancel RPC usage found                                                                                                                             | Kitchen can cancel via RPC only                                                                                                                       |




### Order lifecycle (wired)

```text
Customer place_order → placed
Kitchen advance → preparing → ready
  ↳ trigger may auto-assign rider
Rider claim (if unassigned) → rider_id set
Rider start → out_for_delivery
Rider deliver → delivered (+ delivered_at trigger)
Kitchen cancel (RPC only) → cancelled
```

Evidence: RPCs in `supabase/migrations/20260919183135_rpcs.sql` (+ later), manager `use-manager-orders.ts`, client `api/deliveries.ts`, automation in `20260929160000`.

---



## 5. Features never listed in the original spec

These are implemented (or partially) beyond `docs/requirements.md` sidebar/workflow:

1. **Admin platform** — dashboard, applications, users, restaurants, offers (`home_highlights`), AI provider page (`apps/manager/src/components/admin-shell.tsx`).
2. **Restaurant owner vs manager** — multi-branch, invites, Business page (`routes/business.tsx`).
3. **RIO conversational ordering agent** with tool cards (`apps/client` assistant tab + `supabase/functions/rio`).
4. **RAG embeddings** + retrieval + offline menu-category ML (`embeddings`, `docs/ml`, `docs/rag`).
5. **Automations** — auto rider assign, kitchen-load ETA, `automation_events` / `automation_config`.
6. **Support tickets** from complaints.
7. **Saved addresses**, delivery fee, ETA minutes, rider pay fields.
8. **Push + in-app notifications**.
9. **Live maps** (MapLibre) + OpenRouteService directions edge function.
10. **Explore / home marketing UX** — craving circles, promo carousel, highlights, diet filters (`HomeScreen`, `ExploreScreen`).
11. **Favorites** (device-local hearts).
12. **Careers** apply flows for rider/owner.
13. **Performance analytics** page for kitchens.
14. **Seed / image optimize / intelligence verify** tooling (`scripts/`*).
15. **Shared package + unit/integration/e2e harness** (`npm test` scripts).
16. Manager shell search jumping to orders/menu; live order badge count.
17. Rider earnings UI, help FAQ, report screen, push preference toggle.
18. Role precedence / owner_id lock hardening migrations (security).

---



## 6. AI and advanced features



### RIO agent


| Item                           | Detail                                                                                                                                                             | Evidence                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Entry                          | Customer tab “RIO”                                                                                                                                                 | `app/(customer)/(tabs)/assistant.tsx` → `RioScreen` |
| Transport                      | `supabase.functions.invoke('rio')`                                                                                                                                 | `apps/client/src/api/rio.ts`                        |
| Tools                          | `retrieve_context`, `search_restaurants`, `get_menu`, `view_cart`, `add_to_cart`, `request_checkout`, `track_order`, `check_delivery_status`, `escalate_complaint` | `supabase/functions/rio/index.ts` TOOLS             |
| Client actions (same function) | `confirm_order` → `place_order` RPC; `replace_cart` clears + adds                                                                                                  | `rio/index.ts`, `RioScreen.tsx`                     |
| Checkout                       | Tool prepares cart card; **Confirm in UI** places order (typed “yes” insufficient)                                                                                 | System prompt in `rio/index.ts`                     |
| Cards                          | restaurants / menu / cart / order / ticket                                                                                                                         | `rio/tools.ts`, `RioCards.tsx`                      |




### LLM providers


| Provider                   | Config                                             | Switch                                                               |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| Groq (default active seed) | `GROQ_API_KEY`; model from `llm_config.chat_model` | `llm_config` row `provider=groq`                                     |
| Ollama                     | `OLLAMA_BASE_URL`; model e.g. `llama3.2`           | Admin `activate_llm_config`                                          |
| Implementation             | Single OpenAI-compatible path                      | `_shared/llm.ts`                                                     |
| Admin UI                   | `/admin/ai`                                        | `apps/manager/src/routes/admin/ai.tsx`, `features/admin/ai-page.tsx` |


Embeddings **always** Ollama `nomic-embed-text`, independent of chat provider (`_shared/embeddings.ts`, migration comments).

### RAG


| Item                 | Detail                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Sources              | `menu_items` + `ratings` comments embedded into `embeddings`         |
| Retrieve             | Query embed → `match_embeddings` cosine / HNSW                       |
| Backfill             | `npm run embeddings:backfill` → `scripts/backfill-embeddings.mjs`    |
| Seed target size     | 350 menu + 450 ratings (embed after seed)                            |
| Live embedding count | **unverified** (requires live DB)                                    |
| Eval                 | `docs/rag/eval-queries.json`, report `docs/rag/evaluation-report.md` |




### Classification


| Item            | Detail                                                          |
| --------------- | --------------------------------------------------------------- |
| Task            | Predict `menu_items.category` from embeddings                   |
| Result artifact | Logistic regression accuracy **0.974** on 77-test / 388 samples |
| Product wiring  | **Not** in manager UI (docs: out of scope)                      |




### Automations


| Automation                                             | Wiring                                              |
| ------------------------------------------------------ | --------------------------------------------------- |
| Notify on order insert/update                          | Edge `notify-new-order` + DB webhook (ops)          |
| Auto-assign nearest online rider when status → `ready` | BEFORE UPDATE trigger                               |
| Kitchen load → bump `eta_minutes` + notify             | `run_kitchen_load_alerts` + `cron.schedule` attempt |




### Tests (executed this audit)


| Suite          | Command                                  | Result                                                                                            |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Unit shared    | `packages/shared` vitest                 | **9 passed**                                                                                      |
| Unit client    | 5 files                                  | **18 passed**                                                                                     |
| Unit manager   | `orders.test.ts`                         | **1 passed**                                                                                      |
| Edge Deno      | `npm run test:edge`                      | **Failed here** — could not download `deno` (`ECONNRESET`); test files exist: `_shared/*.test.ts` |
| Integration    | `tests/integration/order-happy-path.mjs` | **Not run** (needs service role + live DB)                                                        |
| E2E Playwright | `apps/manager/e2e/login.spec.ts`         | **Not run** this pass                                                                             |


Coverage is **logic/helpers + thin API**, not full UI E2E of the order chain.

---



## 7. Gaps and risks



### Demo / product gaps


| Risk                                                           | Evidence                                                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **No customer rating submit UI** despite spec                  | No `.from('ratings').insert` in apps; only reads                                                            |
| Menu **Edit** button dead                                      | `apps/manager/src/routes/menu.tsx`                                                                          |
| Kitchen **cancel** not exposed in UI                           | API supports; advance-only UX                                                                               |
| Rider profile/vehicle/documents **local stubs**                | `RiderAccountScreens.tsx`                                                                                   |
| Manager Feedback/Help nav **non-functional**                   | `quickbite-shell.tsx` ghost buttons                                                                         |
| Favorites not synced across devices                            | AsyncStorage                                                                                                |
| RAG eval hit-rates low                                         | `docs/rag/evaluation-report.md` — demo recommendations may miss                                             |
| Auto-assign can empty “Available” pool before manual claim     | Trigger on `ready`                                                                                          |
| Maps/push need **dev/preview native build**, not Expo Go alone | `docs/setup.md`                                                                                             |
| `notify-new-order` JWT off — relies on `WEBHOOK_SECRET`        | `docs/ship-readiness-audit.md`, config                                                                      |
| Manager types stale vs schema                                  | Missing intelligence tables/columns                                                                         |
| Dead mock rider fixtures still in tree                         | `rider-home.ts` `RIDER_*` constants unused by live screens                                                  |
| Hashed fake review counts / default discounts on explore cards | `apps/client/src/lib/home-presentation.ts` — do not claim “real review volume” in demo                      |
| Checkout map / payment methods look finished but are stubs     | `TripMap.tsx`, `PaymentSheet.tsx`                                                                           |
| TODO/FIXME in `apps/**` TS                                     | **None found** this grep; open work listed in `docs/implementation.md` / `apps/client/REMAINING.md` instead |




### Security / ops

- Anon keys in client/manager env are expected; **service role must never** ship as `EXPO_PUBLIC_`* / `VITE_*` (`.env.example` warns).
- Embeddings locked to service role — good.
- Ratings no longer world-readable — good (`20260922152000`).
- Owner steal via manager update mitigated (`20260929121000`).
- Hosted Ollama URL must be reachable from edge; localhost will break cloud RIO embeddings/chat-on-Ollama.



### Loading / empty states

Generally present on customer orders, tracking, rider home, manager lists (`EmptyState`, `ListShell`, skeletons). Manager Feedback/Help lack destinations rather than empty states.

---



## 8. Presentation summary



### COMPLETE features (plain language, 12 bullets)

1. Customers sign up / sign in (email or Google) and browse real restaurants and menus.
2. Customers build a cart, save addresses, and place paid-structure orders (items + delivery fee).
3. Restaurant staff see incoming orders and move them Placed → Preparing → Ready.
4. Status history is recorded and shown to customer and kitchen.
5. Riders go on duty, see or receive deliveries, navigate the trip, and mark Out for delivery → Delivered.
6. Customers track the order live, including rider location while food is on the way.
7. Restaurants manage menu items (add, photo, availability, veg flag, delete) and open/closed business settings.
8. Owners can run branches and invite managers; admins approve rider/owner applications.
9. Push and in-app notifications fire on order activity (when webhook + tokens configured).
10. RIO, the in-app assistant, can search food, fill the cart, help checkout, track orders, and open support tickets.
11. Admins can switch the chat brain between Groq and Ollama without redeploying the app.
12. Background automations can assign a nearby online rider when food is ready and bump ETAs when a kitchen is overloaded.



### Five unique selling points (actually in code)

1. **One account, three jobs** — customer ordering and rider delivery in one Expo app; kitchen + admin in one Vercel dashboard, all one Supabase project with RLS.
2. **RIO tool-using agent** — not a FAQ bot; it calls cart/order/RAG tools and renders action cards (`supabase/functions/rio`).
3. **Database-enforced order handoff** — status changes only through RPCs with legal transitions, plus append-only `order_status_history`.
4. **Ops intelligence** — auto rider assignment + kitchen-load ETA automation with an audit table (`automation_events`).
5. **Measurable AI homework** — embedding RAG eval report + 97% offline category classifier artifacts under `docs/rag` and `docs/ml`.



### Known limitations / future work

- Customer **cannot rate** from the app UI yet (schema ready).
- Menu **edit** and kitchen **cancel** incomplete in UI.
- Rider account subpages largely **mock/local**.
- RAG quality on eval set is weak; embeddings/Ollama must be up for a strong RIO demo.
- Classifier not connected to manager “suggest category”.
- No dedicated automation feed UI (`docs/implementation.md`).
- Integration/E2E/happy-path not re-verified live in this audit; edge unit tests blocked by Deno download here.



### Suggested 5-minute demo (COMPLETE path only)

1. **Customer (phone):** Sign in → Home/Explore → open a restaurant → add 1–2 items → Cart → Checkout with a saved address → Place order → Orders → open tracking (show `placed`).
2. **Kitchen (web):** Same order appears → advance to Preparing → Ready (mention history drawer).
3. **Rider (phone):** If auto-assign ran, open active delivery; else Start duty and Accept from Nearby → Start delivery → show map → Mark delivered.
4. **Customer:** Pull-to-refresh tracking → timeline through delivered (skip rating — not wired).
5. **Optional wow (if secrets up):** RIO tab — “spicy under 300” → retrieve card → add to cart; Admin → AI page show Groq/Ollama switch (do not flip mid-demo unless both backends live).

**Avoid in live demo:** Menu Edit button, rider Documents/Personal save, Feedback/Help in kitchen shell, relying on RAG if embeddings were not backfilled, Expo Go for background location/push.

---

*End of audit. No application code was modified to produce this file.*