# QuickBite — Requirements (source of truth)

This file is the **product and data contract**. Schema details that disagree with `supabase/migrations/` must be fixed in migrations first, then here. Do not invent features outside this doc without an explicit ask.

---

## 1. Roles & sidebars

Every logged-in user has **exactly one** `profiles.role` (`app_role` enum).

| Role | App | Sidebar / tabs |
|------|-----|----------------|
| `customer` | Expo `apps/client` | **Home**, **Explore**, **Orders**, **RIO**, **Profile** (+ cart, checkout, addresses, tracking as stacks) |
| `rider` | Expo `apps/client` | **Home**, **Orders**, **Earnings**, **Profile** (+ delivery detail, vehicle, documents) |
| `restaurant_manager` | Web `apps/manager` | **Dashboard**, **Orders**, **Menu**, **Performance** |
| `restaurant_owner` | Web `apps/manager` | Same as manager + **Business** (branches, invites) |
| `admin` | Web `apps/manager` `/admin` | **Dashboard**, **Tickets**, **Orders**, **Riders**, **Applications**, **Restaurants**, **Users**, **Offers**, **AI** |

### How roles are granted

| Role | Path |
|------|------|
| Customer | Default on signup (`handle_new_user` trigger) |
| Rider / restaurant owner | In-app application → admin RPC `admin_review_application` |
| Restaurant manager | Owner invite email → `accept_manager_invite` |
| Admin | Seed / SQL only (never self-serve) |

Need customer + rider? **Two accounts** (ADR: single-role forever).

---

## 2. Workflow (order handoff)

```text
placed → preparing → ready → out_for_delivery → delivered
              ↘ cancelled (from placed / preparing)
```

| Step | Who | Mechanism |
|------|-----|-----------|
| 1. Menu open + items available | Manager / owner | `menu_items`, `restaurants.is_open` |
| 2. Browse / cart / checkout | Customer | Views + `cart_items` → RPC `place_order` → `placed` |
| 3. Accept → prepare → ready | Kitchen | RPC `restaurant_set_order_status` |
| 4. Assign rider | Claim or auto on `ready` | `claim_delivery` / trigger `auto_assign_rider` |
| 5. Out for delivery → delivered | Assigned rider | RPC `rider_set_order_status` |
| 6. Rate | Customer | Insert into `ratings` (one per delivered order) |

**Timeout:** ignored `placed` orders older than `automation_config.order_accept_timeout_minutes` (default **30**) auto-cancel via `run_order_accept_timeout` + `pg_cron` every 5 minutes.

**Delivery range:** place / cart / RIO confirm blocked outside **8 km** of the kitchen (client + `place_order`).

**Cash-on-delivery default.** Optional Stripe **test-mode** card pay after `place_order` (A3-T1); live UPI/cards remain out of scope.

---

## 3. Naming standards

- Tables: `lower_case`, plural, `snake_case`
- Columns: `snake_case`; FKs end in `_id`
- Prefer `id` PK + `created_at` (known exceptions below)
- Enum / status values: lowercase words (`placed`, `preparing`, …)
- Migrations: timestamp prefix; **schema / RPC / RLS / indexes only** — demo data goes in `supabase/seed.sql`

### Known exceptions

| Object | Exception |
|--------|-----------|
| `orders` | Time column `placed_at` (not `created_at`) |
| `order_items` | No `created_at` (snapshot lines) |
| `order_status_history` | `changed_at`; bigint identity PK |
| `rider_locations` | PK = `rider_id` |
| `user_roles` / `restaurant_members` | Composite PKs |
| `automation_config` | PK = `key` |

---

## 4. Enums

| Enum | Values |
|------|--------|
| `app_role` | `customer`, `restaurant_manager`, `rider`, `restaurant_owner`, `admin` |
| `order_status` | `placed`, `preparing`, `ready`, `out_for_delivery`, `delivered`, `cancelled` |
| `application_kind` | `rider`, `restaurant_owner` |
| `application_status` | `pending`, `approved`, `rejected` |
| `member_status` | `active`, `revoked` |
| `invite_status` | `pending`, `accepted`, `revoked` |
| `ticket_status` | `open`, `in_progress`, `resolved` |
| `ticket_urgency` | `low`, `medium`, `high` |

---

## 5. Tables (columns & purpose)

**Source of truth for exact DDL:** `supabase/migrations/`. This section is the product map.

### Core ordering

| Table | Key columns | Purpose |
|-------|-------------|---------|
| `profiles` | `id` (= auth user), `full_name`, `email`, `phone`, `role`, `is_online`, `vehicle_label`, `plate`, timestamps | One identity per user |
| `restaurants` | `owner_id`, `name`, `cuisine`, `address`, `phone`, `image_url`, `is_open`, `branch_name`, `lat`/`lng`, `offer_percent`, `prep_minutes`, `capacity_threshold` | Kitchen / branch |
| `menu_items` | `restaurant_id`, `name`, `description`, `price`, `is_available`, `category`, `is_veg`, images | Dishes |
| `orders` | `customer_id`, `restaurant_id`, `rider_id`, `status`, `total_amount`, `delivery_fee`, `discount_amount`, `offer_percent`, address + lat/lng, `delivery_address_id`, `drop_km`/`pickup_km`, rider pay, `placed_at`, `delivered_at`, refund fields, `payment_method`/`payment_status`/`paid_at`, Stripe test ids | One checkout |
| `order_items` | `order_id`, `menu_item_id`, `quantity`, `unit_price`, name snapshot | Frozen line items |
| `cart_items` | `customer_id`, `menu_item_id`, `quantity`, `restaurant_id` | Pre-checkout basket (one restaurant) |
| `order_status_history` | `order_id`, `status`, `changed_at`, `changed_by` | Audit trail (trigger-written) |
| `ratings` | `order_id` unique, `customer_id`, `restaurant_id`, food stars, optional delivery score, `comment` | Post-delivery review |
| `rider_locations` | `rider_id` PK, lat/lng, updated | Live pin (overwrite) |
| `customer_addresses` | `customer_id`, label, address, lat/lng, default flag | Saved addresses |

### Partner / ops

| Table | Purpose |
|-------|---------|
| `user_roles` | Mirror of `profiles.role` (legacy multi-role table; single-role product) |
| `applications` | Rider / owner applications |
| `restaurant_members` | Active managers on a restaurant |
| `manager_invites` | Pending owner invites |
| `home_highlights` | Home offers / promo rail |
| `crm_campaigns` / `crm_campaign_enrollments` | A3-T2 custom CRM campaigns + outreach/redemption |
| `crm_customer_segments` (view) | new / frequent / churned / active segment membership |
| `notifications` | In-app inbox |
| `push_device_tokens` | Expo push endpoints |
| `support_tickets` | Customer / kitchen support |
| `automation_events` / `automation_config` | Auto-assign, kitchen-load, accept-timeout knobs + logs |
| `admin_audit_log` | Audited admin force-status / refund / ticket / ops edits |
| `notification_dispatch_log` | Push + SMS webhook dedupe (`preparing`/`delivered` + `sms_*`) |

### Intelligence / RIO

| Table | Purpose |
|-------|---------|
| `llm_config` | Active chat provider (`groq` / `ollama`); no API keys in row |
| `embeddings` | pgvector(1024) curated RAG corpus (`source_table`, `source_id`, `content_hash`, `content`, `metadata`, generated `fts`) — menu + comment ratings |
| `rio_threads` / `rio_messages` | Cloud chat history (customer-owned; last ~8 turns fed to LLM) |
| `rio_events` | Per-turn provider/model/tools/latency |
| `profiles.rio_memory` | Durable RIO prefs (diet, spice, budget, cuisines, avoid) — survives New chat |

### Views

| View | Why |
|------|-----|
| `restaurant_browse` | Customer catalog without owner phone / sensitive columns |
| `restaurant_rating_public` / `restaurant_rating_summary` | Safe averages for cards |

---

## 6. Functions (RPCs) & edge

### Important RPCs

| RPC | Purpose |
|-----|---------|
| `place_order` | Cart → order + items; discounts; delivery fee; 8 km guard; clear cart |
| `restaurant_set_order_status` | Kitchen legal transitions |
| `claim_delivery` | Rider claims unclaimed job |
| `rider_set_order_status` | `out_for_delivery` / `delivered` |
| `list_rider_delivery_pool` | Redacted available jobs |
| `rider_set_duty` / `rider_update_location` | Online + GPS |
| `submit_application` / `admin_review_application` | Partner pipeline |
| `owner_create_branch` / `owner_invite_manager` / `accept_manager_invite` / `owner_revoke_manager` | Owner ops |
| `admin_set_ticket_status` / `admin_force_order_status` / `admin_mark_order_refunded` / `admin_update_restaurant_ops` | Audited admin |
| `crm_segment_counts` / `crm_list_segment_members` / `crm_create_campaign` / `crm_launch_campaign` / `crm_end_campaign` / `crm_campaign_stats` | A3-T2 CRM admin |
| `activate_llm_config` | Switch RIO chat provider |
| `match_embeddings` | Vector search (PII-scoped); kept for eval baseline |
| `match_embeddings_hybrid` | Hybrid RAG: vector + FTS + trigram (RRF); filters `is_available` / `is_veg` / `category` from live `menu_items`. RIO retrieve uses this + re-rank |
| `run_kitchen_load_alerts` / `run_order_accept_timeout` | Cron automations |
| `register_push_device` / `set_default_customer_address` / `standard_delivery_fee` | Helpers |
| `rio_snapshot` | Live customer context for RIO (memory prefs, cart money, range, active order, taste) |
| `rio_update_memory` | Merge durable prefs into `profiles.rio_memory` (RIO `save_prefs` tool) |

### Important triggers

| Trigger | Effect |
|---------|--------|
| `on_auth_user_created` | Insert customer profile |
| `profiles_guard_update` | Block client role/email edits |
| `cart_items_rules` | One restaurant per cart |
| `orders_log_status_*` | Append history |
| `restaurants_guard_owner_id` | Managers cannot steal ownership |
| `orders_auto_assign_rider` | On → `ready`, nearest online rider |

### Edge functions

| Function | Auth | Role |
|----------|------|------|
| `rio` | JWT required | Customer assistant: supervisor → order / dispatch / support (+ clarify); tools + stream. Per-user rate limit (default 40/min; `RIO_RATE_LIMIT` / `RIO_RATE_WINDOW_MS`). Optional `SENTRY_DSN` on unhandled errors. |
| `directions` | JWT required | Map/route helper; short TTL cache on route responses (`_shared/ttlCache`) |
| `notify-new-order` | `WEBHOOK_SECRET` | Push on accept / delivered |
| `send-order-sms` | `WEBHOOK_SECRET` | Twilio outbound on placed / ready / out_for_delivery / delivered (Verify SMS on free trial; ContentSid/Body when upgraded) |
| `create-payment-intent` | JWT required | Stripe Checkout Session (test) for order owner; success/cancel prefer app deep links (`quickbite://orders/{id}?paid=…`) from client `Linking.createURL` |
| `stripe-webhook` | `Stripe-Signature` | Inbound payment/refund → order fields + `admin_audit_log` |

### RIO tools (current)

Discovery (theme → kitchen → menu → add):

- `browse_themes` — categories from **open + in-range** kitchens (vague asks)
- `find_offers` — per-kitchen dish offers with `is_open`, `distance_km`, cards (`distanceKm`); open first
- `verify_dish` — named kitchen + dish → `available` | `unavailable` | `closed` | `out_of_range` | `not_on_menu`
- `find_food` — thin legacy alias of `find_offers` (one release)

Also: `get_menu`, cart (`view` / `add` / `set_qty`), checkout (confirm + `cartHash`), `order_status`, `estimate_eta` (dispatch; ORS/OSRM/haversine), `report_issue`, `reorder_last`, `save_prefs`.

**Multi-agent:** supervisor routes each turn to **order** / **dispatch** / **support** (or **clarify**). Guardrails: PII redact before LLM/logs, tool-arg validation, low-confidence clarify. Customer JWT never claims riders or marks refunds.

**Cart physics:** one kitchen per order. `CART_OTHER_RESTAURANT` → Keep / Clear UI + two-order seller (checkout then second order); tool loop stops (no retry-add thinking loop). Delivery **8 km**. Prefer open kitchens. Tool/LLM failures degrade to a calm RIO reply (no crash / raw stacks). Checkout is two-step; `place_order` only on Confirm. Chat from `llm_config`; embeddings Ollama `qwen3-embedding:0.6b` 1024-d.

---

## 7. Auth (email + Google)

**Required:**

1. **Email & password** signup / login (customer + dashboard)
2. **Google** OAuth (Supabase Auth Google provider + client buttons)

Rules:

- Signup metadata may set `full_name` / `phone`; role is always **customer** from the trigger
- Role changes only via approved admin/owner RPCs or seed — never client UPDATE
- Manager `AuthGate` routes admin → `/admin`, owner/manager → kitchen shell, others → `/blocked`
- Expo routes customer vs rider tabs from `profiles.role` (+ remembered last role)

Redirects: Vercel dashboard origin + Expo scheme `quickbite://`.

---

## 8. RLS rules (intent)

Principles:

1. RLS on every business table  
2. Named policies open specific doors  
3. **Order mutations only through RPCs** (no client INSERT/UPDATE/DELETE on `orders` / `order_items`)  
4. Browse via safe views; rider pool via redacted RPC  

| Object | Customer | Rider | Manager / Owner | Admin |
|--------|----------|-------|-----------------|-------|
| `profiles` | R/W own name/phone | + order counterparties | + staff (owner) | R all |
| `restaurants` | **view** browse | view | R/W managed; owner create/delete | R all + ops |
| `menu_items` | R available | R available | R/W managed | R all |
| `orders` | R own; place **RPC** | R assigned; pool **RPC** | R managed; status **RPC** | R all; force **RPC** |
| `cart_items` | R/W own | — | — | — |
| `ratings` | R own + insert delivered | R if rated | R managed | R all |
| `rider_locations` | R while own order `out_for_delivery` | R/W own | — | limited |
| `customer_addresses` | R/W own | — | — | — |
| `applications` | R own; submit **RPC** | R own | — | R; review **RPC** |
| `support_tickets` | R/W own | — | R/W kitchen | R/W + status RPC |
| `rio_threads` / `rio_messages` | R/W own | — | — | — |
| `embeddings` | via `match_embeddings` only | same | same | service/backfill |
| Storage `menu-images` | public read | read | W managed folder | via manage |

### Hard guarantees

| Fear | Status |
|------|--------|
| Customer A reads B’s orders | Blocked (`customer_id = auth.uid()`) |
| User sets `role = admin` | Blocked (trigger + column privileges) |
| Manager steals `owner_id` | Blocked (trigger) |
| Rider sees full address before claim | Mitigated (`list_rider_delivery_pool`) |
| RAG returns other users’ addresses | Mitigated (scoped `match_embeddings` + RIO retrieve limits) |
| Service role in Expo / Vite public env | Forbidden |

Anon key is public. Service role is server/scripts/edge only.

### CI / observability (A3-T6)

| Piece | Rule |
|-------|------|
| GitHub Actions `.github/workflows/ci.yml` | On push/PR to `main`: `check:secrets`, `test:unit`, `test:edge`. Integration / Playwright run when repo secrets are set (`SUPABASE_*`, `PLAYWRIGHT=1`). |
| Sentry | Optional. Manager `VITE_SENTRY_DSN`, client `EXPO_PUBLIC_SENTRY_DSN`, Edge `SENTRY_DSN` — envelope ingest, no SDK required. Omit DSN = no-op. |
| Caching | RIO read tools via `rio/_toolCache`; directions via `_shared/ttlCache`. |
| Advisors | Review Supabase Dashboard → Database → Advisors after schema changes; fix blocking RLS before ship. |

### Cancel-risk model (A3-T5)

| Piece | Rule |
|-------|------|
| Script | `npm run ml:cancel-risk` → `scripts/cancel_risk.py` (sklearn; needs `.venv-ml` deps) |
| Label | `cancelled` = positive, `delivered` = negative; in-flight excluded |
| Features | Place-time only (`total_amount`, fees, km, hour/dow, cash, past restaurant/customer cancel rates) — no post-claim leakage |
| Bar | Held-out **F1 ≥ 0.80** (also report precision / recall / accuracy) |
| Artifacts | `docs/ml/cancel-risk-metrics.json`, `cancel-risk-confusion.png`, `cancel-risk-dataset-summary.json` |
| Schema | No live score column / RPC in T5 — offline eval only |

---

## 9. Out of scope (unless explicitly requested)

- Multi-role on one account  
- Live UPI / live card capture (Stripe **test** path only for A3-T1)
- Coupons platform  
- iOS App Store ship as primary path  
- Letting Lovable or agents invent new tables without approval  
- Cloud wipe / full RAG rebuild without a backup plan (see PROGRESS)
