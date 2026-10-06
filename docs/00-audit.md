# Phase 1 — QuickBite audit (read-only)

**Date:** 2026-10-06  
**Scope:** Entire repo, `supabase/` migrations, edge functions, env/config usage.  
**Method:** File inspection only. No source edits, no migrations applied, no destructive SQL, no production data changes.  
**Prior docs:** Older audits live in `docs/historical/` (`PROJECT_AUDIT.md`, `ship-readiness-audit.md`). This file is the Phase-1 deliverable for the production-hardening track; it re-verifies claims against current migrations and code.

**How to read this:** Every technical term is defined the first time it appears. File paths are evidence. If something could not be proven from the repo, it is listed under **Open Questions**.

---



## Glossary (terms used in this audit)


| Term                         | Plain meaning                                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo**                 | One git repo that holds several apps and shared packages.                                                                                                  |
| **Migration**                | A numbered SQL file under `supabase/migrations/` that changes the database schema. Migrations are the history of how the DB was built.                     |
| **RLS (Row Level Security)** | Postgres rules that decide which rows a logged-in user may see or change. Even if the API allows a table, RLS can hide most rows.                          |
| **Policy**                   | One RLS rule, e.g. “a customer may SELECT only their own orders.”                                                                                          |
| **RPC**                      | A Postgres function exposed as an API call (e.g. `place_order`). Often marked `security definer` so it can write rows the caller could not write directly. |
| **Security definer**         | The function runs with the privileges of its owner (usually bypassing RLS), so it must check permissions itself.                                           |
| **JWT**                      | The login token Supabase Auth issues. The client sends it; RLS uses `auth.uid()` from it.                                                                  |
| **Anon key**                 | Public Supabase API key safe to put in apps. Alone it cannot bypass RLS.                                                                                   |
| **Service role key**         | Secret key that bypasses RLS. Must never ship in a mobile/web client.                                                                                      |
| **Edge function**            | Serverless Deno code under `supabase/functions/` that runs near the database (RIO, push notify, directions).                                               |
| **pgvector**                 | Postgres extension that stores embedding vectors for similarity search (RAG).                                                                              |
| **RAG**                      | Retrieval-Augmented Generation: search stored text/vectors, then give hits to the LLM so answers are grounded.                                             |
| **Enum**                     | A fixed list of allowed text values in Postgres (e.g. order statuses).                                                                                     |
| **PK / FK**                  | Primary key (unique row id) / foreign key (pointer to another table’s id).                                                                                 |
| **Idempotent**               | Safe to run twice without making a mess (e.g. seed scripts).                                                                                               |


---



## A. Repo map



### A.1 Top-level folders


| Path                    | Purpose                                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/client/`          | Expo / React Native app for **customers** and **riders** (one binary, role-based routes).                                        |
| `apps/manager/`         | Vite + React web dashboard for **restaurant owners**, **managers**, and **admins**. Package name in workspaces is `dashboard`.   |
| `apps/landing/`         | Public marketing site (Vite). Separate deploy from the dashboard.                                                                |
| `packages/shared/`      | Shared pure TypeScript: roles, order-status helpers, brand colours. Re-exports rules from `supabase/functions/_shared/rules.ts`. |
| `supabase/migrations/`  | Source of truth for schema, RLS, triggers, RPCs (44 migration files).                                                            |
| `supabase/functions/`   | Edge functions: `rio`, `notify-new-order`, `directions`, plus `_shared/`.                                                        |
| `supabase/scripts/`     | Manual SQL seeds (`seed_admin.sql`, catalogs) and Deno embedding backfill.                                                       |
| `supabase/seed-data/`   | Generated seed bundle folder (currently only a README; full bundle lives under quarantine).                                      |
| `supabase/tests/`       | SQL tests (e.g. delivery foundations).                                                                                           |
| `scripts/`              | Node/Python tooling: seed generate/push, embeddings backfill, RAG eval, tests, DCT artifacts.                                    |
| `tests/integration/`    | Order happy-path script (needs service role).                                                                                    |
| `docs/`                 | Architecture, setup, seed specs, older audits, ML/RAG/DCT folders.                                                               |
| `assets/`               | README screenshots.                                                                                                              |
| `_delivery_quarantine/` | Parked generated seed JSON, temp Supabase artifacts, assignment notes — **not** part of the runtime app.                         |
| `.github/`              | CI workflows.                                                                                                                    |
| `.cursor/`              | Editor/agent config.                                                                                                             |
| `.venv-ml/`             | Local Python env for the offline menu classifier.                                                                                |
| `node_modules/`         | Dependencies (npm workspaces).                                                                                                   |
| Root `app.json`         | Minimal Expo/EAS `projectId` stub (real Expo config is `apps/client/app.json` + `app.config.js`).                                |


**Why this layout:** Customers/riders need mobile maps and push; kitchen/admin need a browser dashboard; marketing is static. One Supabase project is the shared backend so roles share the same tables and RLS.

### A.2 App entry points


| App     | Entry                                                       | How routing works                                                                                                               |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Client  | `apps/client/app/_layout.tsx` → `apps/client/app/index.tsx` | Expo Router file-based routes under `app/`. Index redirects to auth, customer tabs, or rider tabs based on session + last role. |
| Manager | `apps/manager/src/start.ts` / `router.tsx` + `routes/`      | TanStack Router; `auth-gate.tsx` routes by `profiles.role`.                                                                     |
| Landing | `apps/landing/index.html` → `src/`                          | Static marketing page.                                                                                                          |


Client route groups (evidence: `apps/client/app/`):

- `(auth)/` — login, signup  
- `(customer)/` — home tabs, cart, checkout, restaurant, orders, RIO assistant, addresses, careers  
- `(rider)/` — rider tabs, delivery, earnings, profile  
- `(blocked)/` — role mismatch screens



### A.3 Where code lives (client)


| Concern              | Location                                                                  |
| -------------------- | ------------------------------------------------------------------------- |
| Screens (UI logic)   | `apps/client/src/screens/` (+ rider under `features/rider/screens/`)      |
| Route thin wrappers  | `apps/client/app/**/*.tsx`                                                |
| Components           | `apps/client/src/components/`                                             |
| Hooks                | `apps/client/src/hooks/`                                                  |
| Supabase / API calls | `apps/client/src/api/` (intended single data layer)                       |
| Types                | `apps/client/src/types/` (`models.ts`, generated `database.ts`)           |
| Constants / theme    | `apps/client/src/constants/` (`theme.ts`, `orderStatus.ts`, `pricing.ts`) |
| Notifications        | `apps/client/src/notifications/`                                          |




### A.4 Where code lives (manager)


| Concern          | Location                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Routes / pages   | `apps/manager/src/routes/`                                                                                       |
| Feature UI       | `apps/manager/src/features/` (admin, landing)                                                                    |
| API              | `apps/manager/src/api/`                                                                                          |
| Supabase clients | `apps/manager/src/integrations/supabase/` (`client.ts` browser anon; `client.server.ts` service role for server) |
| UI primitives    | `apps/manager/src/components/ui/`                                                                                |
| Theme            | `apps/manager/src/styles.css` (oklch tokens; notes in `packages/shared/src/brand-tokens.ts`)                     |




### A.5 Backend entry points


| Piece                  | Path                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Schema bootstrap       | `supabase/migrations/20260919120737_init_schema.sql`                                                                 |
| Auth → profile trigger | `20260919144816_auth_trigger.sql` (later forced to always `customer` in `20260921133100_roles_and_applications.sql`) |
| RLS first pass         | `20260919182235_rls_policies.sql` (many policies later replaced)                                                     |
| Core order RPCs        | `20260919183135_rpcs.sql` (rewritten in roles/backend migrations)                                                    |
| RIO                    | `supabase/functions/rio/index.ts` + `tools.ts`                                                                       |
| Push webhook           | `supabase/functions/notify-new-order/index.ts`                                                                       |
| Maps directions        | `supabase/functions/directions/index.ts`                                                                             |


---



## B. Database

**Source of truth:** All files under `supabase/migrations/` (read in timestamp order).  
**Live cloud row counts / orphan rows:** not queried in this phase (see Open Questions).

### B.1 Enums (fixed value lists)


| Enum                 | Values                                                                       | Defined in                                                                                     |
| -------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `app_role`           | `customer`, `restaurant_manager`, `rider`, then `restaurant_owner`, `admin`  | `20260919120737_init_schema.sql` L8; extended `20260921133000_extend_app_role.sql` / `…33050…` |
| `order_status`       | `placed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `cancelled` | init schema L10–12 — **matches your required lowercase words**                                 |
| `application_kind`   | `rider`, `restaurant_owner`                                                  | `20260921133100_roles_and_applications.sql`                                                    |
| `application_status` | `pending`, `approved`, `rejected`                                            | same                                                                                           |
| `member_status`      | `active`, `revoked`                                                          | same                                                                                           |
| `invite_status`      | `pending`, `accepted`, `revoked`                                             | same                                                                                           |
| `ticket_status`      | `open`, `in_progress`, `resolved`                                            | `20260929160000_intelligence_layer.sql`                                                        |
| `ticket_urgency`     | `low`, `medium`, `high`                                                      | same                                                                                           |


**Why enums:** The database itself rejects illegal status strings. The app cannot invent `OnTheWay` by typo.

### B.2 Tables vs required spec



#### Required core (+ your additions)


| Table                  | Present?                 | Notes / deviations                                                                                                                       |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`             | Yes                      | PK = `auth.users.id`. Has `created_at`. Extra: `is_online`, `vehicle_label`, `plate` (`20260923003300_ui_catalog_and_rider_pay.sql`).    |
| `restaurants`          | Yes                      | Extra: `branch_name`, `lat`, `lng`, `offer_percent`, `prep_minutes`. One-owner unique dropped to allow multi-branch (`20260921133100…`). |
| `menu_items`           | Yes                      | Extra: `category`, `is_veg`.                                                                                                             |
| `orders`               | Yes                      | **No** `created_at` — uses `placed_at` instead (init L74). Extra: delivery fee, rider pay fields, `delivery_address_id`.                 |
| `order_items`          | Yes                      | **No** `created_at`. Snapshots `item_name` / `unit_price`. Generated `line_total`.                                                       |
| `ratings`              | Yes                      | `unique(order_id)`.                                                                                                                      |
| `cart_items`           | Yes                      | Unique `(customer_id, menu_item_id)`.                                                                                                    |
| `order_status_history` | Yes                      | PK is `bigint` identity, not uuid. Timestamp column is `changed_at`, **not** `created_at`.                                               |
| `rider_locations`      | Yes                      | **PK is** `rider_id`, not `id`. **No** `created_at` (only `updated_at`).                                                                 |
| `llm_config`           | Yes                      | **No** `created_at`.                                                                                                                     |
| RAG / embeddings       | Yes — table `embeddings` | pgvector 768-d; HNSW index. `source_id` later became `text` (`20261001120000…`).                                                         |




#### Extra tables beyond the required list (intentional product growth)


| Table                | Purpose                                                                                                | Evidence                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `user_roles`         | Historical multi-role; now **mirror** of `profiles.role` after `20260922154000_single_role_column.sql` | Composite PK `(user_id, role)` — **no** `id`                                    |
| `applications`       | Rider / owner apply → admin review                                                                     | roles migration                                                                 |
| `restaurant_members` | Hired managers per kitchen                                                                             | Composite PK; one active membership per user enforced later (`20260930220000…`) |
| `manager_invites`    | Email invite to manage a branch                                                                        |                                                                                 |
| `home_highlights`    | Home offers/videos rail                                                                                | `20260921133400_home_catalog.sql`                                               |
| `notifications`      | In-app notification rows                                                                               | `20260923003300…`                                                               |
| `customer_addresses` | Saved delivery addresses                                                                               | `20260923170000_backend_foundations.sql`                                        |
| `push_device_tokens` | Expo push tokens                                                                                       | same                                                                            |
| `support_tickets`    | RIO escalate + kitchen/admin                                                                           | intelligence layer                                                              |
| `automation_events`  | Audit log for auto-assign / kitchen alerts                                                             |                                                                                 |
| `automation_config`  | Thresholds; **PK is** `key` **text**, not `id`                                                         |                                                                                 |




#### Views (not tables)


| View                       | Purpose                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `restaurant_browse`        | Customer-safe restaurant fields (no `owner_id` / `phone`) — `security_invoker = false` |
| `restaurant_rating_public` | Only `restaurant_id` + `food_rating` for averages                                      |




### B.3 Naming conventions check


| Rule                                | Status                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Tables lower_case plural snake_case | Mostly yes (`menu_items`, `order_items`, …).                                                                                   |
| Columns snake_case                  | Yes.                                                                                                                           |
| Every table has `id` PK             | **Fail** for: `rider_locations` (`rider_id` PK), `user_roles` / `restaurant_members` (composite), `automation_config` (`key`). |
| Every table has `created_at`        | **Fail** for: `orders` (`placed_at`), `order_items`, `order_status_history` (`changed_at`), `rider_locations`, `llm_config`.   |
| FKs end in `_id`                    | Yes (`customer_id`, `restaurant_id`, …).                                                                                       |
| Fixed values lowercase words        | Yes via enums.                                                                                                                 |




### B.4 Indexes (high-signal)

Defined in init + later migrations, including:

- `orders_customer_idx`, `orders_restaurant_idx`, `orders_rider_idx`, partial `orders_unclaimed_idx` (init)  
- `menu_items_restaurant_available_idx`, `restaurants_cuisine_idx` (`20260930120000_browse_query_indexes.sql`)  
- `embeddings_embedding_hnsw` (vector search)  
- Unique: cart one-per-item, ratings one-per-order, llm one-active, one pending application, one active manager membership



### B.5 Triggers (behaviour attached to tables)


| Trigger / function                            | Why it exists                                          |
| --------------------------------------------- | ------------------------------------------------------ |
| `on_auth_user_created` → `handle_new_user`    | Creates `profiles` (+ `user_roles` customer) on signup |
| `profiles_guard_update`                       | Blocks client role/email changes                       |
| `touch_updated_at` on several tables          | Keeps `updated_at` honest                              |
| `orders_log_status_on_*` → `log_order_status` | Writes `order_status_history` automatically            |
| `cart_items_rules` → `enforce_cart_rules`     | One restaurant per cart; derives `restaurant_id`       |
| `restaurants_guard_owner_id`                  | Stops hired managers from stealing `owner_id`          |
| `orders_auto_assign_rider`                    | On status → `ready`, assign nearest online rider       |
| Address / push token state triggers           | Defaults and enabled/disabled timestamps               |
| `llm_config_*`                                | Stamp actor + touch                                    |




### B.6 Public RPCs (app-facing functions)

Including (non-exhaustive; see migrations for bodies):

`place_order`, `restaurant_set_order_status`, `claim_delivery`, `rider_set_order_status`, `rider_set_duty`, `rider_update_location`, `list_rider_delivery_pool`, `submit_application`, `admin_review_application`, `owner_create_branch`, `owner_invite_manager`, `accept_manager_invite`, `owner_revoke_manager`, `list_my_restaurants`, `set_default_customer_address`, `register_push_device`, `standard_delivery_fee`, `activate_llm_config`, `match_embeddings`, `run_kitchen_load_alerts`.

**Why RPCs for order writes:** There are **no** INSERT/UPDATE/DELETE RLS policies on `orders` / `order_items`. All mutations go through RPCs that enforce legal status transitions.

### B.7 Order status state machine (from RPCs)


| From → To                          | Who                                  | Function                                |
| ---------------------------------- | ------------------------------------ | --------------------------------------- |
| (new) → `placed`                   | Customer (via cart)                  | `place_order`                           |
| `placed` → `preparing`             | Kitchen staff who manages restaurant | `restaurant_set_order_status`           |
| `preparing` → `ready`              | Kitchen                              | same                                    |
| `placed`/`preparing` → `cancelled` | Kitchen                              | same                                    |
| claim while `preparing`/`ready`    | Rider                                | `claim_delivery` (sets `rider_id` only) |
| `ready` → `out_for_delivery`       | Assigned rider                       | `rider_set_order_status`                |
| `out_for_delivery` → `delivered`   | Assigned rider                       | same                                    |
| Auto assign on → `ready`           | Trigger                              | `private.auto_assign_rider`             |


Final kitchen RPC uses `private.manages_restaurant` (not owner-only): `20260921133300_roles_rpcs.sql` L134–186.

---



## C. Security



### C.1 Is RLS enabled?

**Yes on every public business table** created in migrations (init enables the core nine; later tables enable RLS in their own migrations).  
`embeddings` has RLS on and **no** policies for `authenticated` — only `service_role` is granted access (`20260929140000…` L134–138).

### C.2 Policies in plain English (effective final intent)

Policies evolved across migrations. Below is the **intended end state** after later replacements (not the first draft in `20260919182235…`).

#### `profiles`

- SELECT own row.  
- SELECT counterparties who share an order (customer/rider/kitchen).  
- SELECT all if admin; SELECT staff profiles if you own their kitchen.  
- UPDATE own row (DB also **revokes** UPDATE on `role`/`email` columns — only `full_name`, `phone` granted — `20260919181927_helpers_and_guards.sql` L70–71).  
- Trigger blocks role/email changes when `auth.uid()` is set.



#### `restaurants`

- SELECT full row only if you manage it or are admin (`20260922150000…`). Customers use `restaurant_browse` instead.  
- INSERT if you are `restaurant_owner` and `owner_id = you`.  
- UPDATE if you manage it.  
- DELETE if you own it.  
- Trigger locks `owner_id` changes to the current owner.



#### `menu_items`

- SELECT if `is_available` OR you manage the kitchen OR admin.  
- INSERT/UPDATE/DELETE if you manage the kitchen.



#### `orders`

- SELECT own as customer.  
- SELECT if you manage the restaurant.  
- SELECT if admin.  
- SELECT if you are the assigned rider (`20260929122000…` — **unclaimed pool removed from SELECT**).  
- No direct INSERT/UPDATE/DELETE policies (RPC-only writes).



#### `order_items` / `order_status_history`

- SELECT if parent order is visible under orders RLS.  
- No user inserts (RPC / trigger).



#### `cart_items`

- Full CRUD on own rows (`customer_id = auth.uid()`).



#### `ratings`

- SELECT if you wrote it, manage the restaurant, are the rated rider, or admin.  
- Public averages via `restaurant_rating_public`.  
- INSERT only for own delivered order, not if you manage that kitchen, and not if you are also the rider.



#### `rider_locations`

- Rider full access to own row.  
- Customer SELECT only when their order is `out_for_delivery` and linked.



#### `user_roles` / `applications` / `restaurant_members` / `manager_invites`

- SELECT own / admin / owner as applicable.  
- **No authenticated write policies** — mutations go through security-definer RPCs.



#### `home_highlights`

- Authenticated read active; admin CRUD.



#### `notifications`

- Read own; update own (mark read). No client insert policy (writers are backend/service).



#### `customer_addresses` / `push_device_tokens`

- Owner CRUD (with grants tightened in foundations migration).



#### `llm_config`

- All authenticated can SELECT; only admin INSERT/UPDATE; activate via `activate_llm_config`.



#### `support_tickets`

- Customer read/insert own (order must be theirs).  
- Staff/admin read/update tickets for managed kitchens.



#### `automation_events` / `automation_config`

- Events: admin / own-order customer / kitchen staff read.  
- Config: all authenticated read; admin write.



#### Storage `menu-images`

- Public read; managers upload/update/delete under their restaurant folder UUID.



### C.3 Role × table access matrix

Legend: **R** read, **W** write (insert/update/delete as allowed), **RPC** only via function, **—** none, **view** via safe view.


| Table                  | Anon | Customer                                  | Rider                     | Rest. manager                    | Rest. owner        | Admin               |
| ---------------------- | ---- | ----------------------------------------- | ------------------------- | -------------------------------- | ------------------ | ------------------- |
| `profiles`             | —    | R/W own (name/phone)                      | R/W own; R counterparties | same + staff visibility if owner | same               | R all               |
| `restaurants`          | —    | browse **view**                           | browse view               | R/W managed                      | R/W owned + create | R all               |
| `menu_items`           | —    | R available                               | R available               | R/W managed                      | R/W managed        | R all               |
| `orders`               | —    | R own; place via RPC                      | R assigned; pool via RPC  | R managed; status RPC            | same               | R all               |
| `order_items`          | —    | R via order                               | R via order               | R via order                      | R via order        | R via order         |
| `cart_items`           | —    | R/W own                                   | —*                        | —*                               | —*                 | —                   |
| `order_status_history` | —    | R via order                               | R via order               | R via order                      | R via order        | R via order         |
| `ratings`              | —    | R own + insert delivered; public avg view | R if rated                | R managed                        | R managed          | R all               |
| `rider_locations`      | —    | R active delivery                         | R/W own                   | —                                | —                  | —†                  |
| `customer_addresses`   | —    | R/W own                                   | —                         | —                                | —                  | —                   |
| `applications`         | —    | R own; submit RPC                         | R own                     | —                                | R own              | R all; review RPC   |
| `llm_config`           | —    | R                                         | R                         | R                                | R                  | R/W                 |
| `embeddings`           | —    | — (table)                                 | —                         | —                                | —                  | —; service/backfill |
| `match_embeddings` RPC | —    | **execute**                               | **execute**               | **execute**                      | **execute**        | **execute**         |
| `support_tickets`      | —    | R/W own                                   | —                         | R/W kitchen                      | R/W kitchen        | R/W                 |


 Single-role model: a person is only one `profiles.role`, so a rider is not a customer in the same account for cart use.  
† Admin may lack a dedicated `rider_locations` SELECT policy — **flag** (Open Question / Medium).

### C.4 Security gaps and answers to your example questions


| Question                                   | Answer                                                                                                                                                                                                                            | Evidence                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Can one customer read another’s orders?    | **No** via table RLS (`customer_id = auth.uid()`).                                                                                                                                                                                | `20260919182235…` L67–69                   |
| Can a rider see unclaimed order PII?       | **Not via SELECT on** `orders` **anymore.** Pool is `list_rider_delivery_pool()` with redacted address (area hint only).                                                                                                          | `20260929122000_rider_pool_redacted.sql`   |
| Can a rider see orders that are not ready? | Assigned rider can see their row at any status. Unclaimed pool includes `preparing` **and** `ready`.                                                                                                                              | same + claim RPC                           |
| Can a user change their own role?          | **No** via client: column privilege + trigger. Role changes only through `private.grant_role` (revoked from clients).                                                                                                             | helpers + `20260922154000…`                |
| Can signup pick admin?                     | **No** — `handle_new_user` always inserts `customer`.                                                                                                                                                                             | `20260921133100…` L254–271                 |
| Service role / secrets in client?          | **Not in Expo/Vite public env.** Client uses `EXPO_PUBLIC_`* anon; manager browser uses `VITE_`*. Service role appears in root `.env` (gitignored), scripts, edge, and `apps/manager/src/integrations/supabase/client.server.ts`. | `.env.example`, `.gitignore`               |
| `notify-new-order` JWT off?                | `verify_jwt = false` in `supabase/config.toml` L427–429; function compares `WEBHOOK_SECRET` (hashed). Still a sharp edge if secret is weak.                                                                                       | config + function                          |
| **RAG PII leak?**                          | **Critical:** `match_embeddings` is `security definer`, granted to `authenticated`, and returns `delivery_address` (and order meta) for `orders` sources to **any** caller who can invoke the RPC — not scoped to “my orders.”    | `20261001120000…` L58–114; grant L160 area |




### C.5 Secrets exposure check (repo)


| Item                                  | Status                                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.env` files                          | Gitignored; present locally with secret **names** including `SUPABASE_SERVICE_ROLE_KEY` at repo root.                                   |
| Committed sample demo passwords       | `docs/dct/sample-credentials.md` documents `@quickbite.test` / `sanket123` — demo accounts, not production secrets, but public in repo. |
| Hardcoded project ref in SQL comments | `motqehtswgjbbvoazarh.supabase.co` in `20260923003300…` L24 (comment / URL shape).                                                      |
| Anon key in client                    | Expected and OK (public).                                                                                                               |


---



## D. Data flows (end-to-end)



### D.1 Sign-up / login (email + Google)

**Email signup**

1. Screen: `apps/client/src/screens/auth/SignupScreen.tsx` / manager signup route.
2. API: `signUpWithEmail` → `supabase.auth.signUp` with `full_name` / `phone` metadata (`apps/client/src/api/auth.ts`).
3. Trigger: `handle_new_user` inserts `profiles` + `user_roles` as **customer**.
4. Session: `useAuth` loads profile (`apps/client/src/hooks/useAuth.tsx`), retries until profile exists.

**Email login**

1. `signInWithPassword` → session → same profile load → `app/index.tsx` redirects.

**Google**

1. `signInWithGoogle` (Expo browser / PKCE) in `apps/client/src/api/auth.ts` L63+.
2. Same auth trigger creates profile from Google `name` metadata.
3. Manager: `apps/manager/src/api/auth.ts` Google OAuth + PKCE.

**Why metadata → trigger:** Auth owns passwords/OAuth; your app owns the `profiles` row used by RLS.

### D.2 Browse restaurants

1. Home/Explore screens → `apps/client/src/api/home.ts` / `restaurants.ts`.
2. Queries `restaurant_browse` (+ menu items, `restaurant_rating_public`, highlights).
3. RLS: browse view is security-barrier; unavailable dishes hidden unless staff.



### D.3 Cart

1. UI: Cart / restaurant detail / `useCart` / `useAddDish`.
2. API: `apps/client/src/api/cart.ts` inserts/updates `cart_items`.
3. Trigger `enforce_cart_rules` blocks mixed restaurants (`20260919182625_cart_rules.sql`).



### D.4 Place order

1. Checkout screen → RPC `place_order` (with address id/lat/lng after delivery-fee migration).
2. Function locks cart, checks open kitchen + availability, snapshots line items, clears cart, returns order id.
3. Trigger logs `placed` into `order_status_history`.
4. Optional: Database webhook → `notify-new-order` edge function for push.



### D.5 Restaurant accepts / prepares / ready

1. Manager UI: `apps/manager/src/api/orders.ts` / kitchen routes.
2. RPC `restaurant_set_order_status` with legal transitions.
3. Self-service guard: cannot kitchen-handle your own order as customer.
4. On `ready`, auto-assign rider trigger may set `rider_id`.



### D.6 Rider claim / pickup / deliver

1. Pool: `list_rider_delivery_pool` (redacted).
2. Claim: `claim_delivery`.
3. Status: `rider_set_order_status` (`ready`→`out_for_delivery`→`delivered`).
4. Location: `rider_update_location` / direct `rider_locations` upserts + realtime.
5. Client: `apps/client/src/features/rider/*`, `api/deliveries.ts`, `api/rider.ts`.



### D.7 Customer tracking

1. Order detail / map screens → `useOrderTracking` / `api/order-tracking.ts`.
2. Reads `orders`, `order_status_history`, `rider_locations` (only while `out_for_delivery`).
3. Realtime subscriptions on orders / rider locations (init + kitchen realtime migrations).



### D.8 Rating

1. After `delivered`, customer inserts into `ratings` under RLS.
2. Unique on `order_id` prevents duplicates.



### D.9 RIO assistant

**Edge:** `supabase/functions/rio/index.ts`  
**Why JWT + anon client:** Gateway verifies JWT (`verify_jwt = true`); function creates a Supabase client with the **user’s** Authorization header so **RLS applies** to tool queries.

#### LLM tools (10 — not 9)


| #   | Tool                    | Queries / writes                                                                         | Row bound?                                          |
| --- | ----------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | `retrieve_context`      | Embeddings via Ollama + `match_embeddings` (menu, ratings, orders, order_items, history) | `top_k` capped ≤12 (tool) / match ≤20 (RPC)         |
| 2   | `search_restaurants`    | `restaurant_browse` + `menu_items`                                                       | `.limit(40)` then diversify to 8 places / 10 dishes |
| 3   | `get_menu`              | one kitchen + available items                                                            | `.limit(10)`                                        |
| 4   | `view_cart`             | `cart_items`                                                                             | `.limit(10)`                                        |
| 5   | `add_to_cart`           | read cart ≤20, insert/update                                                             | bounded reads                                       |
| 6   | `update_cart_quantity`  | update/delete one line                                                                   | single row                                          |
| 7   | `request_checkout`      | read cart only (no place)                                                                | via `readCart` limit 10                             |
| 8   | `track_order`           | `orders` + history                                                                       | 1 or 3 orders; history ≤5/order                     |
| 9   | `check_delivery_status` | wraps `track_order` for one id                                                           | same                                                |
| 10  | `escalate_complaint`    | insert `support_tickets`                                                                 | one row                                             |


**Extra HTTP actions (not LLM tools):** `replace_cart`, confirm place via `placeCustomerOrder` → `place_order` RPC (`rio/index.ts`).

**Unbounded?** No tool does `select` * without a limit on the large catalogs. The risk is **semantic**: `match_embeddings` can return **other customers’ delivery addresses** in RAG payloads (see Critical). Broad `search_restaurants` with empty query still limitted to 40 kitchens.

**LLM switching:** Active row in `llm_config` (Groq vs Ollama); keys from edge secrets (`_shared/llm.ts`). Embeddings always Ollama `nomic-embed-text` 768-d (`_shared/embeddings.ts`).

---



## E. Seed / test data



### E.1 How seed data is produced


| Artifact                                                         | Role                                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docs/seed-data-spec.md`                                         | Contract: 180 users, 35 restaurants, 350 menu items, 750 orders, status mix, etc.                      |
| `scripts/generate-seed-data.mjs`                                 | Builds JSON bundle                                                                                     |
| `scripts/push-seed-data.mjs`                                     | Imports with **service role**                                                                          |
| `_delivery_quarantine/seed-data-generated/`                      | Actual generated `seed-bundle.json`, `manifest.json`, `auth-users.csv`                                 |
| `supabase/seed-data/generated/README.md`                         | Points at generate/push flow; folder currently **empty of JSON**                                       |
| `supabase/scripts/seed_admin.sql`                                | Promote an admin                                                                                       |
| `supabase/scripts/seed_catalog.sql` / `seed_variety_catalog.sql` | Smaller SQL catalogs                                                                                   |
| `supabase/config.toml` `[db.seed]`                               | `sql_paths = ["./seed.sql"]` but `supabase/seed.sql` **is missing**                                    |
| Home highlights INSERT                                           | Inside migration `20260921133400…` (demo offers with Unsplash URLs)                                    |
| `llm_config` bootstrap rows                                      | Inside migration `20260929140000…`                                                                     |
| `automation_config` defaults                                     | Inside intelligence migration                                                                          |
| Embeddings                                                       | Not in seed JSON; `scripts/backfill-embeddings.mjs` / `npm run embeddings:backfill` for ≥5k RAG corpus |


**Identifiable seed users:** emails `*@quickbite.test`, shared password documented as `sanket123` (manifest + `docs/dct/sample-credentials.md`).

### E.2 Seed quality risks (from files, not live DB)


| Risk                                                               | Why it matters                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Large demo corpus (~6.5k+ rows + embeddings) mixed with real users | Hard to tell junk from production without a `is_seed` flag or separate project.                                    |
| Migration-embedded demo `home_highlights`                          | Migrations should be schema-only; data in migrations complicates prod resets (`ship-readiness` also flagged this). |
| `db reset` references missing `seed.sql`                           | Local reset cannot load the intended seed path.                                                                    |
| Orphans / inconsistent statuses in **live** cloud                  | **Not verified** this phase — needs read-only SQL with your approval.                                              |
| Quarantine + empty `supabase/seed-data/generated`                  | Two homes for seed artifacts → confusion about which is canonical.                                                 |


---



## F. Code health



### F.1 Duplication / structure

- Auth helpers duplicated: `apps/client/src/api/auth.ts` and `apps/manager/src/api/auth.ts` (similar email/Google flows).  
- Order status colours/rules: DB enum + `packages/shared` + `apps/client/src/constants/orderStatus.ts`.  
- `home-mock.ts` name is misleading: heavily used for **real** home types/helpers, not only mocks (`apps/client/src/lib/home-mock.ts` imported across home/explore/RIO).  
- Empty/legacy `apps/client/app/(tabs)/`.  
- Duplicate Supabase config stub: `apps/manager/supabase/config.toml` vs root `supabase/`.  
- Older docs (`PROJECT_AUDIT`, `ship-readiness`) vs this Phase-1 track — risk of drift until Phase 2 consolidates.



### F.2 Hard-coded values

- Brand tokens centralised in `packages/shared/src/brand-tokens.ts` — good.  
- Many screens still hard-code hex (`#FFE8DC`, `#FFF3ED`, `#EEEEEE`, …) especially `OrderTrackingScreen.tsx`, `RioScreen.tsx`, `NotificationsScreen.tsx` instead of always using `colors.*`.  
- Delivery fee constant duplicated: SQL `standard_delivery_fee()` and `STANDARD_DELIVERY_FEE = 40` in `rio/tools.ts` L74–75.  
- Project ref / storage URL shapes in migration comments.



### F.3 Theme / styling consistency

- Client background: `#FBF7F2` via brand tokens.  
- Soft orange `#FFE8DC` (`primarySoft`) reused, but tracking/RIO add near-duplicate creams (`#FFF3ED`, `#FFF7F3`, `#FFF8F4`) — visual drift across headers/cards.  
- Manager uses oklch CSS variables; intended parity documented in `brandOklchNotes`.



### F.4 Error / loading states

- Root client shows `LogoLoader` while auth loads (`app/index.tsx`).  
- Many list screens use skeletons/empty components (`LoadingSkeleton`, `EmptyState`) — uneven; manager profile failure → `/blocked` was previously flagged in ship-readiness (still worth verifying manually).



### F.5 Performance / query patterns


| Issue                    | Evidence                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select('*')`            | Client/manager profiles, addresses, applications, menu, partners (`apps/client/src/api/profiles.ts`, `addresses.ts`, `apps/manager/src/api/menu.ts`, …) |
| Large limits             | Manager orders `.limit(200)` / `2000` / `500` (`apps/manager/src/api/orders.ts`); home catalog `.limit(240)` dishes (`apps/client/src/api/home.ts`)     |
| Missing pagination       | Customer orders limited to 40; no cursor pagination pattern                                                                                             |
| Rider refresh over-fetch | Previously flagged (ship-readiness H4); re-check `features/rider` when fixing                                                                           |
| RIO tool limits          | Present (good); RAG privacy not row-count bound alone                                                                                                   |




### F.6 Dead / quarantine weight

- `_delivery_quarantine/` holds ~9MB of generated/temp data.  
- Root `app.json` is nearly empty vs real Expo config in `apps/client`.

---



## Prioritized issue list



### Critical

1. `match_embeddings` **exposes other users’ order PII to any authenticated caller** (security definer + `delivery_address` in preview/meta). Evidence: `20261001120000_match_embeddings_order_history.sql`.
2. `notify-new-order` **runs with** `verify_jwt = false` — entirely dependent on webhook secret strength and payload handling (`supabase/config.toml`, function).
3. **Production vs demo data not separable** in schema (no seed marker); large `@quickbite.test` corpus + migration-inserted highlights risk polluting real ops.



### High

1. **Spec deviations:** missing universal `id` + `created_at` on several tables (`orders`, `order_items`, `rider_locations`, …).
2. `supabase/seed.sql` **missing** while `config.toml` enables seed on reset.
3. **Single-role column** means one human cannot be customer + rider on one account without role thrash (`20260922154000…`) — product/security tradeoff to confirm.
4. **Manager unbounded-ish order queries** (limits 500–2000) and home over-fetch (240 dishes).
5. **Service role available to manager server bundle path** (`client.server.ts`) — ensure it never ships to the browser build.
6. **Demo credentials committed** (`docs/dct/sample-credentials.md`) — fine for grader, bad if those users exist on a shared “prod” project.



### Medium

1. Hard-coded colours / fee constants drift from design tokens.
2. `select('*')` and incomplete generated types sync (`npm run types:client` vs manager types lag called out in older audit).
3. Dual seed homes (quarantine vs `supabase/seed-data`).
4. `home-mock` naming; empty `(tabs)` group; duplicate manager `supabase/` stub.
5. Admin may lack explicit `rider_locations` read (ops debugging harder).
6. RIO tool count is **10**; your brief said 9 — docs/product mismatch.



### Low

1. Migration comments with live project URL.
2. Unused / optional Inter or dead rails previously noted in ship-readiness — re-verify before deleting.
3. Root stub `app.json` vs Expo app config confusion.

---



## Open Questions — answered (2026-10-06)


| #   | Your answer (summary)                                                                                                | How docs treat it                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | You work on **cloud**; surprised local Docker also exists in the repo.                                               | Cloud = source of truth; local optional (`01`, ADR-003). Read-only live SQL still needs explicit OK when we need orphan counts. |
| 2   | Bulk seed neglected careful relevance; OK to rebuild later with fresh test characters / orders (careful with admin). | Flexible wipe+seed in Phase 3 (ADR-016).                                                                                        |
| 3   | Proper RAG required; current dataset/embeddings not trusted.                                                         | Redesign RAG; don’t ship current corpus as “correct” (`06`, ADR-011).                                                           |
| 4   | **Single-role only** — do not implement multi-role / rider+customer on one account.                                  | ADR-004 CONFIRMED; ADR-005 superseded.                                                                                          |
| 5   | Design a proper agent architecture (not 9-vs-10 counting).                                                           | `06` documents today + redesign direction.                                                                                      |
| 6   | Unknown if service role is deployed on manager server.                                                               | Code: `client.server.ts` exists, **no route imports it** (ADR-014).                                                             |
| 7   | **Yes — implement** order acceptance timeout.                                                                        | Required for Phase 3 proposals (`05`, ADR-012).                                                                                 |
| 8   | Package `com.sjinnovation.quickbite` final; EAS path (FCM worked).                                                   | ADR-013.                                                                                                                        |
| 9   | Asked what quarantine is.                                                                                            | Explained in `10-faq-doubts.md` Q12; not runtime-critical.                                                                      |
| 10  | Move old audits to historical.                                                                                       | Done → `docs/historical/`.                                                                                                      |


Still open only if needed later: **permission to run read-only COUNT/orphan SQL on cloud**.

---



## Phase status

- **Phase 1:** Complete (this file).  
- **Phase 2:** Complete — see `[docs/README.md](./README.md)` (`01`–`10`).  
- **Phase 3:** Complete — see [`11-fix-plan.md`](./11-fix-plan.md); approve proposal numbers before Phase 4.

