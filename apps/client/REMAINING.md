# QuickBite client — remaining slices

Test **Slice 0** now. Slice 1 (customer order loop) is already in the app — use the checklist below. Slices 2–5 are the backlog so the next session does not need a re-brief.

## How to run

```bash
cd apps/client
cp .env.example .env   # fill EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npx expo start
```

Need at least one **open** restaurant with available menu items (Studio or `apps/manager`).

Google: Supabase → Authentication → Google provider on. Redirect URLs: `quickbite://**` and `exp://**`.

Regenerate DB types after schema changes (repo root):

```bash
npm run types:client
```

---

## Slice 0 — skeleton

What it proves: login loads the right navigator for the right role.

- [ ] Email signup as **customer** → Home / Cart / Orders / Profile tabs
- [ ] Email signup as **rider** → Available / My Deliveries / History / Profile tabs
- [ ] Restaurant manager account → “use the manager website” screen + logout
- [ ] Email login restores session after reload
- [ ] Google button (customer by default — Auth trigger has no role picker on OAuth)
- [ ] Profile: edit name/phone, logout, log in as the other role

---

## Slice 1 — customer ordering loop (built)

What it proves: `cart_items`, single-restaurant trigger, `place_order()`, RLS on orders.

- [ ] Home lists open and closed restaurants; closed cards are greyed, still tappable
- [ ] Restaurant detail: menu; Add disabled when closed or `is_available = false`
- [ ] Persistent bar: `N items · ₹X · View Cart`
- [ ] Cart badge on the tab = item count
- [ ] Add from restaurant Y while cart has X → dialog, not a raw Postgres error
- [ ] Place order with address → `place_order` RPC → cart empty, order on Orders tab
- [ ] Closed restaurant / empty cart / unavailable item surface the RPC message

API already used:

| Helper | Backend |
|--------|---------|
| `placeOrder({ address, notes? })` | `place_order` |
| cart insert/update | `cart_items` + `enforce_cart_rules` |

---

## Slice 2 — rider claiming loop

Do not start until Slice 1 is demoable.

**Screens**

- Available Deliveries: unclaimed orders with `status in ('preparing','ready')`. Distinguish “Preparing — claim early” vs “Ready — pick up now” using `ORDER_STATUS_META` / `riderActions()` in `src/constants/orderStatus.ts`.
- My Deliveries: claimed, not yet delivered.
- **Start Delivery** only when status is `ready` (not at claim time).
- **Mark delivered** = one confirm button.

**Add** `src/api/deliveries.ts` (only file that talks to supabase-js for this):

| Helper | Backend |
|--------|---------|
| `listAvailableDeliveries()` | `orders` select (RLS already opens the unclaimed pool) |
| `claimDelivery(orderId)` | `claim_delivery(p_order_id)` |
| `startDelivery(orderId)` | `rider_set_order_status(id, 'out_for_delivery')` |
| `markDelivered(orderId)` | `rider_set_order_status(id, 'delivered')` |

Handle `ALREADY_CLAIMED` as “Someone else got this one” and refetch the list.

GPS / `rider_locations`: **do not** ping on claim. Start only after `out_for_delivery` (Slice 3).

---

## Slice 3 — live tracking

**Customer** `TrackOrder` as a **stack** route: `app/(customer)/orders/[id].tsx` (not a tab).

- Vertical timeline from `order_status_history` (this is why the table exists).
- Map + rider pin only when `status >= out_for_delivery` (`isStatusAtLeast`).
- TanStack Query + Supabase Realtime: subscribe to `orders`, `order_status_history`, `rider_locations`, then `queryClient.invalidateQueries`.

**Rider:** after Start Delivery, upsert `rider_locations` (own row, PK = rider_id) on a timer. Stop / row is deleted by `on_order_delivered` trigger.

Realtime publication already includes those three tables.

---

## Slice 4 — ratings + history

- Customer order history (Orders tab can grow; delivered rows get Rate).
- Rider delivery history list.
- Rate flow: **insert** into `ratings` (there is no `rate_order()` RPC). RLS: own order, `status = 'delivered'`, one row per `order_id`.
- Add `src/api/ratings.ts` wrapping that insert (`food_rating`, optional `delivery_rating` + `comment`).

---

## Slice 5 — polish

Empty states, error copy, loading skeletons, profile photo later if wanted. No new schema.

Nice-to-have, not MVP: require rider GPS near destination before Mark Delivered.

---

## Backend gaps (do not fake these in the app)

- **No customer `cancel_order` RPC.** Orders are SELECT-only; writes go through RPCs. Add a migration if cancellation is needed.
- **No `rate_order()` RPC** — insert `ratings`.
- **`mark_delivered` is not its own function** — `rider_set_order_status(..., 'delivered')`.
- Google signup cannot pick rider unless you add a post-OAuth role step (role is locked after insert).

## Status UI

One file: [`src/constants/orderStatus.ts`](./src/constants/orderStatus.ts). Badges, timeline dots, and “which button to show” all read from there. Do not copy colors into screens.
