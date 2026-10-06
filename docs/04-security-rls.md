# 04 — Security & RLS

**RLS (Row Level Security)** = Postgres rules that filter which rows a role may see or change, even if the table is granted to `authenticated`.

**JWT** = login token; `auth.uid()` inside policies is “who is calling.”

**Anon key** = public API key (safe in apps). **Service role key** = bypasses RLS (server/scripts only).

---

## Principles this project uses

1. Enable RLS on every business table (locked by default).  
2. Open specific doors with named policies.  
3. Mutate orders through **RPCs** (`security definer`) that check role + legal transitions — not through open UPDATE policies.  
4. Harden over time (browse views, redacted rider pool, owner_id lock).

---

## Role × table matrix (effective intent)

Legend: **R** read, **W** write, **RPC** via function only, **view** safe view, **—** no access.

| Table / object | Anon | Customer | Rider | Manager | Owner | Admin |
|----------------|------|----------|-------|---------|-------|-------|
| `profiles` | — | R/W own (name/phone) | same + order counterparties | same | + staff profiles | R all |
| `restaurants` | — | **view** browse | view | R/W managed | R/W + create/delete owned | R all |
| `menu_items` | — | R available | R available | R/W managed | R/W managed | R all |
| `orders` | — | R own; place **RPC** | R assigned; pool **RPC** | R managed; status **RPC** | same | R all |
| `order_items` / `order_status_history` | — | R via parent order | R via parent | R via parent | R via parent | R via parent |
| `cart_items` | — | R/W own | —* | —* | —* | — |
| `ratings` | — | R own + insert delivered; avg **view** | R if rated | R managed | R managed | R all |
| `rider_locations` | — | R while own order `out_for_delivery` | R/W own | — | — | ? weak |
| `customer_addresses` | — | R/W own | — | — | — | — |
| `applications` | — | R own; submit **RPC** | R own | — | R own | R all; review **RPC** |
| `restaurant_members` / `manager_invites` | — | — / invitee read | — | — | R owned; invite **RPC** | R |
| `user_roles` | — | R own | R own | R own | R own | R all |
| `home_highlights` | — | R active | R active | R active | R active | CRUD |
| `notifications` | — | R/W own (mark read) | same | same | same | same |
| `push_device_tokens` | — | R/W own | R/W own | R/W own | R/W own | R/W own |
| `llm_config` | — | R | R | R | R | R/W + activate RPC |
| `embeddings` table | — | — | — | — | — | service role |
| `match_embeddings` | — | **execute** | **execute** | **execute** | **execute** | **execute** |
| `support_tickets` | — | R/W own | — | R/W kitchen tickets | R/W | R/W |
| `automation_*` | — | R own-order events / R config | R config | R kitchen events / R config | same | R events; W config |
| Storage `menu-images` | public read | read | read | W own folder | W own folder | (via manage) |

\* **Single-role (CONFIRMED):** a rider account is not a customer for cart; kitchen/admin roles use the dashboard, not the customer cart, on that same login.

---

## Policies in plain English (by table)

### `profiles`
- You can read yourself.  
- You can read people who share an order with you (name/phone for delivery coordination).  
- Admins read everyone; owners can read their hired staff profiles.  
- You can update yourself, but the database only grants UPDATE on `full_name` and `phone`, and a trigger rejects role/email changes.

### `restaurants`
- Full table rows: only staff who manage that restaurant, or admin.  
- Everyone else browses via `restaurant_browse` (no owner phone).  
- Owners create; staff update managed; owners delete.

### `menu_items`
- Available dishes are readable to signed-in users.  
- Unavailable dishes: staff/admin only.  
- Writes: staff who manage that kitchen.

### `orders`
- Customer: own orders.  
- Kitchen: orders for restaurants they manage.  
- Admin: all.  
- Rider: **only assigned** orders (unclaimed pool is **not** a SELECT anymore — use `list_rider_delivery_pool`).  
- No client INSERT/UPDATE/DELETE policies — use RPCs.

### `order_items` / `order_status_history`
- Readable if you can see the parent order (inherits orders RLS).  
- History inserts only from trigger.

### `cart_items`
- Full control of your own cart rows.

### `ratings`
- Read: author, kitchen staff, rated rider, or admin.  
- Public averages: `restaurant_rating_public`.  
- Insert: your delivered order, once, not if you manage that kitchen / self-deal cases.

### `rider_locations`
- Rider writes own pin.  
- Customer reads only while their order is `out_for_delivery` and linked.

### Partner tables (`user_roles`, `applications`, `restaurant_members`, `manager_invites`)
- SELECT for self / owner / admin as appropriate.  
- Writes through security-definer RPCs only.

### `home_highlights`
- Authenticated users read active rows; admin CRUD.

### `notifications` / `push_device_tokens` / `customer_addresses`
- Owner-scoped (the user_id / customer_id must be you).

### `llm_config`
- Everyone authenticated can see which provider is active (no secrets in row).  
- Only admin changes / activates.

### `support_tickets` / automation
- Customers own their tickets; kitchen/admin handle kitchen-related ones.  
- Automation config readable by authenticated; writable by admin.

### Storage
- Menu images publicly readable; uploads restricted to managed restaurant folder UUID.

---

## Direct answers to common fears

| Fear | Status |
|------|--------|
| Customer A reads Customer B’s orders? | **Blocked** by RLS (`customer_id = auth.uid()`). |
| Rider sees full address of unclaimed jobs? | **Mitigated** via redacted RPC (area hint only). |
| User sets `role = admin` on signup? | **Blocked** — trigger always inserts `customer`. |
| User UPDATEs own `role`? | **Blocked** — privileges + trigger. |
| Hired manager steals `owner_id`? | **Blocked** by `restaurants_guard_owner_id`. |
| Service role in Expo app? | **Not** in `EXPO_PUBLIC_*`. Exists in gitignored `.env` / scripts / edge. |
| RAG leaks other people’s addresses? | **Mitigated (P4):** `match_embeddings` strips `delivery_address` and only returns order-history rows for `customer_id = auth.uid()`. RIO `retrieve_context` queries `menu_items` + `ratings` only. See migration `20261006220000_match_embeddings_scope_pii.sql`. |

---

## Edge / webhook notes

| Function | JWT gateway | Extra auth |
|----------|-------------|------------|
| `rio` | `verify_jwt = true` | Uses caller JWT for RLS |
| `directions` | `verify_jwt = true` | — |
| `notify-new-order` | `verify_jwt = false` | Compares `WEBHOOK_SECRET` |

`verify_jwt = false` means anyone who hits the URL can try; the secret must be strong and the handler must not trust client-supplied ids blindly.

---

## Gap list (for Phase 3)

1. Scope `match_embeddings` / RAG to non-PII or to the caller’s own orders. **DONE (P4)** — migration `20261006220000_match_embeddings_scope_pii.sql` + RIO menu/ratings-only retrieve.  
2. Revisit webhook auth + payload re-fetch. **DONE (P5)** — DB reload + `notification_dispatch_log` dedupe; rotate `WEBHOOK_SECRET` manually if shared.  
3. Confirm admin read on `rider_locations` if ops need it.  
4. Ensure manager `client.server.ts` never ships service role to the browser (currently unused by routes — still a footgun). **DONE (P6)** — comments + `npm run check:secrets`.  
5. Keep single-role UX honest (blocked screens) so users are not confused when cart/orders are empty for rider accounts.
