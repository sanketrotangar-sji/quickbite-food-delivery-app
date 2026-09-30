# Seed data contract — exact requirements (no sample rows)

This is the structure you fill. **Do not ask the agent for generated rows.**
Load via SQL editor / your own scripts under `supabase/scripts/` (not migrations).

After load → embeddings backfill (`menu_items`, then `ratings`). See bottom.

---

## 1. Exact target counts

| # | Table | Exact target | Role in the mix |
|---|--------|-------------:|-----------------|
| 1 | `auth.users` | **180** | One per profile; same UUID |
| 2 | `profiles` | **180** | Role breakdown below |
| 3 | `restaurants` | **35** | Branches (not a separate branches table) |
| 4 | `restaurant_members` | **35** | ~1 active manager per kitchen |
| 5 | `menu_items` | **350** | ~10 per restaurant |
| 6 | `customer_addresses` | **220** | Across customers only |
| 7 | `orders` | **750** | Status mix below |
| 8 | `order_items` | **1,900** | ~2.5 lines/order (exact sum of quantities lines) |
| 9 | `order_status_history` | **~2,200** | **Do not INSERT** — produced by trigger |
| 10 | `ratings` | **450** | Subset of delivered orders only |
| 11 | `notifications` | **350** | Across any roles |
| 12 | `home_highlights` | **6** | Platform rail |
| 13 | `applications` | **25** | Rider / owner applications |
| 14 | `manager_invites` | **15** | Optional realism |
| 15 | `cart_items` | **40** | Live carts only |
| 16 | `rider_locations` | **15** | Online / on-trip riders only |
| 17 | `user_roles` | **180** | Mirror of `profiles.role` (1 row each) — optional if you use `private.grant_role` |
| — | `push_device_tokens` | **0–100** | Optional; skip if not testing push |
| — | `embeddings` | **0 now** | Filled later by backfill script |

**Approximate total:** ~6,500–7,000 rows (including auto history).

### 1.1 `profiles.role` breakdown (must sum to 180)

| Role | Count |
|------|------:|
| `customer` | 140 |
| `rider` | 20 |
| `restaurant_owner` | 12 |
| `restaurant_manager` | 7 |
| `admin` | 1 |

### 1.2 `orders.status` breakdown (must sum to 750)

| Status | Count | Notes |
|--------|------:|-------|
| `delivered` | **525** | ~70%; set `delivered_at`; then eligible for ratings |
| `ready` | **45** | unclaimed pool if `rider_id` null |
| `preparing` | **30** | unclaimed pool if `rider_id` null |
| `out_for_delivery` | **60** | **must** have `rider_id` |
| `placed` | **52** | kitchen pending |
| `cancelled` | **38** | no rider required |

### 1.3 `ratings`

- Target **450**
- Only on `orders` where `status = 'delivered'`
- Cap: ≤ 525 delivered → 450 is ~86% of delivered (or use 450 of 525 ≈ 86%; earlier “60%” was soft — use **450 exact**)
- `unique(order_id)` — at most one rating per order

### 1.4 `order_items`

- Target **1,900 rows** (not 1,900 items sold as quantity)
- Average ~2.53 lines per order across 750 orders
- Allowed: 1–5 lines per order; keep restaurant’s menu as source of snapshots

---

## 2. Insert order (FK-safe)

```text
1. auth.users
2. profiles          (same id as auth.users; or let handle_new_user create, then UPDATE role)
3. Grant elevated roles via private.grant_role(user_id, role)  ← preferred over raw UPDATE
4. restaurants
5. restaurant_members
6. menu_items
7. customer_addresses
8. orders            (start as 'placed', then UPDATE status along the path)
9. order_items       (can insert right after each order create)
10. (status updates on orders → order_status_history auto-fills)
11. ratings           (delivered only)
12. notifications, home_highlights, applications, manager_invites
13. cart_items, rider_locations (sparse live state)
```

**Never bulk-insert** `order_status_history` — trigger `log_order_status` writes it on order INSERT and on status UPDATE.

**Do not** invent `embeddings` rows by hand.

---

## 3. How to create users (auth)

`profiles.id` **must** equal `auth.users.id`.

Options:

1. **Admin API / Auth signup** for each user, then `private.grant_role(...)` for non-customer roles.
2. **SQL** (service role / SQL editor): insert into `auth.users` with a known uuid, then upsert `profiles`.  
   - Password hash required if using email login.  
   - Prefer Auth Admin API if you need real sign-in later.

After create:

- Customer: leave `profiles.role = 'customer'`
- Others: `select private.grant_role('<uuid>', 'rider'|'restaurant_owner'|'restaurant_manager'|'admin');`  
  (`grant_role` never downgrades; admin > owner > manager > rider > customer)

Mirror: `user_roles` is rewritten by `grant_role` to a single row — you do not manage multi-role lists.

---

## 4. Hard relationship rules

| Rule | Detail |
|------|--------|
| One kitchen per order | `orders.restaurant_id` is a single restaurant; all `order_items` snapshots from that kitchen’s menu |
| Owner owns restaurants | `restaurants.owner_id` ∈ profiles with role `restaurant_owner` (or higher) |
| Manager assignment | `restaurant_members.user_id` ∈ profiles with role `restaurant_manager`; `status = 'active'` |
| Self-deal | Customer on an order must **not** be owner/manager of that restaurant. Rider must **not** be owner/manager of that restaurant |
| Claimed delivery | `status in ('out_for_delivery','delivered')` with rider → set `rider_id`. Unclaimed feed: `rider_id is null` and `status in ('preparing','ready')` |
| Delivered stamp | When status becomes `delivered`, set `delivered_at` (trigger may also set it on real RPC path; for SQL seed set explicitly) |
| Cart | One restaurant per customer across `cart_items` (enforced by cart rules / place_order) |
| Address default | At most **one** `customer_addresses.is_default = true` per `customer_id` |
| Ratings | `ratings.customer_id` = order’s customer; `ratings.restaurant_id` = order’s restaurant; `order_id` unique |

---

## 5. Field contract by table

Legend: **R** = required on insert · **O** = optional · **G** = generated / default · **X** = do not set (system)

### 5.1 `auth.users` (minimal for seed)

You need at least: `id` (uuid), `email`, and whatever your Auth insert path requires (`encrypted_password`, `email_confirmed_at`, etc.).

### 5.2 `profiles`

| Column | Req | Type / constraint |
|--------|-----|-------------------|
| `id` | R | uuid = `auth.users.id` |
| `email` | R | text, non-null |
| `full_name` | O | text |
| `role` | R | `app_role`: `customer` \| `rider` \| `restaurant_manager` \| `restaurant_owner` \| `admin` |
| `phone` | O | text |
| `is_online` | O | bool default false — set true for some riders |
| `vehicle_label` | O | text — riders |
| `plate` | O | text — riders |
| `created_at` / `updated_at` | G | defaults ok |

### 5.3 `restaurants` (each row = one branch)

| Column | Req | Type / constraint |
|--------|-----|-------------------|
| `id` | G/R | uuid |
| `owner_id` | R | → profiles (owner) |
| `name` | R | non-empty trim |
| `address` | R | text |
| `branch_name` | O | text (use for multi-branch owners) |
| `description` | O | text |
| `cuisine` | O | text (free text; no enum) |
| `phone` | O | text |
| `image_url` | O | public Storage URL under `menu-images` |
| `is_open` | R | bool — target ~80% true (~28 open) |
| `lat` / `lng` | O | pair both null or both set; lat ∈ [-90,90], lng ∈ [-180,180] |
| `offer_percent` | O | integer 0–100 or null |
| `prep_minutes` | O | integer 0–180 or null |

**Ownership distribution:** 12 owners → 35 restaurants ⇒ ~2–3 branches each (e.g. 11×3 + 1×2 = 35).

### 5.4 `restaurant_members`

| Column | Req | Constraint |
|--------|-----|------------|
| `restaurant_id` | R | PK part → restaurants |
| `user_id` | R | PK part → profiles (manager) |
| `status` | R | `active` \| `revoked` — seed **35 active** |
| `created_at` / `updated_at` | G | |

1 manager ↔ 1 kitchen (product rule). Owners may still own multiple branches.

### 5.5 `menu_items`

| Column | Req | Constraint |
|--------|-----|------------|
| `id` | G/R | uuid |
| `restaurant_id` | R | → restaurants |
| `name` | R | non-empty |
| `price` | R | numeric ≥ 0 (INR) |
| `description` | O | text (helps embeddings) |
| `category` | O | free text (e.g. Starters, Mains, Breads, Desserts, Beverages) |
| `is_veg` | R | bool — mix ~50/50 across catalog |
| `is_available` | R | bool — **~10% false** (~35 items) |
| `image_url` | O | Storage public URL |

**Per restaurant:** ~10 items → 35 × 10 = 350.

### 5.6 `customer_addresses`

Only for `profiles.role = 'customer'` (140 customers → 220 addresses ≈ 1.57 each).

| Column | Req | Constraint |
|--------|-----|------------|
| `customer_id` | R | → profiles |
| `label` | R | `home` \| `work` \| `other` |
| `nickname` | R | trim length 1–80 |
| `address_line` | R | trim 1–300 |
| `area` | R | trim 1–160 |
| `landmark` | O | text |
| `lat` / `lng` | O | both null or both set + valid ranges |
| `is_default` | R | bool — **exactly one true per customer** who has addresses |

### 5.7 `orders`

| Column | Req | Constraint |
|--------|-----|------------|
| `id` | G/R | uuid |
| `customer_id` | R | → customer profile; not staff of restaurant |
| `restaurant_id` | R | → restaurants |
| `rider_id` | O | required for `out_for_delivery`; usual for `delivered` |
| `status` | R | enum above |
| `total_amount` | R | ≥ 0; **≈ sum(order_items.line_total) + delivery_fee** |
| `delivery_fee` | R | use **40.00** (`standard_delivery_fee()`) |
| `delivery_address` | R | text snapshot (always) |
| `delivery_lat` / `delivery_lng` | O | optional coords |
| `delivery_address_id` | O | → `customer_addresses` if linked |
| `notes` | O | text |
| `placed_at` | R/G | timestamptz (spread over last 30–90 days for realism) |
| `delivered_at` | O | **set when status=delivered** |
| `rider_earning` / `tip_amount` / `bonus_amount` | O | ≥ 0 where used |
| `pickup_km` / `drop_km` / `eta_minutes` | O | ≥ 0 / null |

**Status walk (for history volume):** insert as `placed`, then UPDATE through the path you need, e.g.

- Delivered: `placed → preparing → ready → out_for_delivery → delivered`
- Cancelled: `placed → cancelled` or `placed → preparing → cancelled`

Each transition adds a history row.

### 5.8 `order_items`

| Column | Req | Constraint |
|--------|-----|------------|
| `order_id` | R | → orders |
| `menu_item_id` | O | → menu_items (nullable snapshot; prefer set from that kitchen) |
| `item_name` | R | snapshot name |
| `quantity` | R | integer > 0 |
| `unit_price` | R | ≥ 0 snapshot |
| `line_total` | X | **generated** `quantity * unit_price` — do not insert |

### 5.9 `ratings`

| Column | Req | Constraint |
|--------|-----|------------|
| `order_id` | R | unique; order must be `delivered` |
| `customer_id` | R | = order.customer_id |
| `restaurant_id` | R | = order.restaurant_id |
| `rider_id` | O | = order.rider_id when present |
| `food_rating` | R | integer 1–5 |
| `delivery_rating` | O | integer 1–5 |
| `comment` | O | text — **prefer many non-null comments** (RAG quality) |

### 5.10 `notifications`

| Column | Req | Constraint |
|--------|-----|------------|
| `user_id` | R | → profiles |
| `title` | R | non-empty |
| `body` | R | text |
| `created_at` | G | |
| `read_at` | O | null = unread |

### 5.11 `home_highlights`

| Column | Req | Constraint |
|--------|-----|------------|
| `title` | R | non-empty |
| `subtitle` | O | |
| `image_url` | R | non-empty URL |
| `kind` | R | `offer` \| `video` — e.g. 4 offer + 2 video |
| `sort_order` | R | int |
| `is_active` | R | bool |
| `restaurant_id` | O | → restaurants (CTA target) |
| `badge` | O | text |
| `cta_label` | O | text |

### 5.12 `applications`

| Column | Req | Constraint |
|--------|-----|------------|
| `applicant_id` | R | → profiles |
| `kind` | R | `rider` \| `restaurant_owner` |
| `status` | R | `pending` \| `approved` \| `rejected` |
| `payload` | R | jsonb object (can be `{}`) |
| `review_note` / `reviewed_by` / `reviewed_at` | O | set when approved/rejected |
| Unique | — | at most one **pending** per `(applicant_id, kind)` |

### 5.13 `manager_invites`

| Column | Req | Constraint |
|--------|-----|------------|
| `restaurant_id` | R | → restaurants |
| `email` | R | **must** = `lower(trim(email))` |
| `invited_by` | R | → owner profile |
| `status` | R | `pending` \| `accepted` \| `revoked` |
| Unique | — | one pending per `(restaurant_id, email)` |

### 5.14 `cart_items` (40 rows)

| Column | Req | Constraint |
|--------|-----|------------|
| `customer_id` | R | customer |
| `restaurant_id` | R | must match item’s restaurant |
| `menu_item_id` | R | available item preferred |
| `quantity` | R | > 0 |
| Unique | — | `(customer_id, menu_item_id)` |
| Extra | — | all lines for one customer → **same** `restaurant_id` |

### 5.15 `rider_locations` (15 rows)

| Column | Req | Constraint |
|--------|-----|------------|
| `rider_id` | R | PK → rider profile |
| `order_id` | O | set if currently on a trip |
| `lat` / `lng` | R | valid ranges |
| `updated_at` | G | |

---

## 6. Enums (copy-paste reference)

```text
app_role:            customer | restaurant_manager | rider | restaurant_owner | admin
order_status:        placed | preparing | ready | out_for_delivery | delivered | cancelled
member_status:       active | revoked
application_kind:    rider | restaurant_owner
application_status:  pending | approved | rejected
invite_status:       pending | accepted | revoked
address label:       home | work | other
highlight kind:      offer | video
```

---

## 7. Suggested content variety (still no rows — guidance only)

| Area | Vary |
|------|------|
| Cuisines | Indian regional, Chinese, pizza, cafe, etc. (free text) |
| Categories | Starters / Mains / Rice / Breads / Desserts / Beverages |
| Price band | e.g. ₹40–₹450 |
| Comments on ratings | Real phrases about taste, packaging, delay — these feed RAG |
| Geography | Keep lat/lng in one metro cluster so distance UI looks sane |
| Time | Spread `placed_at` over ~90 days; denser last 7 days |

---

## 8. Validation checklist (run after load)

```sql
-- counts
select role, count(*) from profiles group by 1;
select status, count(*) from orders group by 1;
select count(*) from restaurants;          -- 35
select count(*) from menu_items;           -- 350
select count(*) from order_items;          -- 1900
select count(*) from ratings;              -- 450
select count(*) from order_status_history; -- ~2200 if you walked statuses

-- invariants
select count(*) from ratings r
join orders o on o.id = r.order_id
where o.status <> 'delivered';             -- must be 0

select customer_id, count(*) filter (where is_default)
from customer_addresses group by 1
having count(*) filter (where is_default) > 1;  -- must be empty

-- money sanity (spot-check)
select o.id, o.total_amount, o.delivery_fee,
       (select coalesce(sum(line_total),0) from order_items oi where oi.order_id = o.id) as items
from orders o
limit 20;
-- expect total_amount ≈ items + delivery_fee
```

---

## 9. After seed: embeddings (not part of your CSV)

Requires local Ollama with `nomic-embed-text` pulled, plus `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

```bash
# Preferred (Node — no Deno required)
npm run embeddings:backfill -- --source menu_items
npm run embeddings:backfill -- --source ratings

# Optional Deno twin
# deno run --allow-net --allow-env supabase/scripts/backfill_embeddings.ts --source menu_items
```

| source_table | Text used |
|--------------|-----------|
| `menu_items` | `name · category · description` |
| `ratings` | `comment`, else `Food rating N/5` |

Model fixed: Ollama **`nomic-embed-text`** → **768** dims. Spot-check:

```sql
select source_table, count(*) from embeddings group by 1;
```

Then verify intelligence RPCs/automations: `npm run intelligence:verify`.
