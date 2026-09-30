# QuickBite — Ship-readiness audit

  
**Scope:** Monorepo end-to-end — `supabase/`, `apps/client` (Expo), `apps/manager` (dashboard), docs, assets, deploy config  
**Verdict:** Critical + High ship items addressed in code (2026-09-29). Apply migrations, redeploy notify-new-order, and run image optimize before calling production-ready. Medium/Low still open.

Findings are ordered **Critical → High → Medium → Low**. Each item notes area, risk, evidence, and recommended fix.

---

## How to use this doc

1. Fix every **Critical** before any public / store release.
2. Fix **High** before marketing the product as “ready to ship.”
3. **Medium** for polish and scale (5k+ catalog).
4. **Low** for excellence / debt cleanup.

---


## Progress (Critical + High — 2026-09-29)

| ID | Status |
|----|--------|
| ADDR | DONE — address load/save hardened (soft-fail default RPC; migration `20260929120000`) |
| C1 | DONE — `owner_id` locked via BEFORE UPDATE trigger (`20260929121000`) |
| C2 | DONE — removed `[QB-DEBUG]` / `:7843` ingest from client |
| C3 | DONE — `notify-new-order` reloads order from DB; idempotency key |
| C4 | DONE — `grant_role` never-downgrade precedence (`20260929121000`) |
| H1 | DONE — redacted rider pool RPC + tighter SELECT (`20260929122000`) |
| H2 | DONE — with C3 (DB-derived recipients) |
| H3 | DONE — Hosted Auth checklist in `docs/setup.md` |
| H4 | DONE — filtered rider queries + pool RPC (no triple full-table load) |
| H5 | DONE — restore tracking only for riders with active assigned order |
| H6 | DONE — optimize script + `expo-image`/`RemoteImage` + slim home + trimmed local assets |
| H7 | DONE — debounced kitchen invalidation; rider realtime only when role=rider |
| H8 | DONE — profile error retry UI (not `/blocked`) |
| H9 | DONE — bounded kitchen/performance order queries |
| H10 | DONE — accepted past wipe; no new catalog DELETE migrations this phase |
| H11 | DONE — release fail-fast log + EAS env docs |
| H12 | DONE — `assign_manager_owners.sql` uses `private.grant_role` |

**Operator follow-up:** `supabase db push`, redeploy `notify-new-order`, run `npm run images:optimize` with service role.

---



## Address bug (client)

### ADDR — Customer address load / save fails

**Status:** DONE — soft-fail default RPC on list/add/import; trigger promote-first hardened (`20260929120000`).

---

## Critical (ship blockers)



### C1 — Hired managers can reassign restaurant ownership


**Status:** DONE — owner_id locked via BEFORE UPDATE trigger (migration `20260929121000`).

|              |                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Area**     | Schema / RLS                                                                                                                                                                                                 |
| **Threat**   | Privilege escalation: any user who `manages_restaurant(id)` can `UPDATE restaurants.owner_id` and steal the kitchen.                                                                                         |
| **Evidence** | Policy `"restaurants: staff updates managed"` in `supabase/migrations/20260921133200_roles_rls.sql` — `USING` / `WITH CHECK` only require `manages_restaurant(id)`; no lock on `owner_id`.                   |
| **Fix**      | `BEFORE UPDATE` trigger (or tighter `WITH CHECK`) so `owner_id` (and ideally `id`) cannot change unless caller is current owner (or service role). Add a pgTAP / SQL test that expects failure for managers. |




### C2 — Debug OAuth telemetry in the mobile production bundle


**Status:** DONE — debug OAuth telemetry removed from auth/supabaseClient/LoginScreen.

|              |                                                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Area**     | `apps/client` security                                                                                                                                     |
| **Threat**   | Agent debug hooks POST to LAN/`127.0.0.1:7843` and log OAuth URL shapes (`[QB-DEBUG]`). Ships with the app if not stripped.                                |
| **Evidence** | `apps/client/src/api/auth.ts`, `apps/client/src/api/supabaseClient.ts`, `apps/client/src/screens/auth/LoginScreen.tsx` (`#region agent log`, ingest URLs). |
| **Fix**      | Delete all agent-log regions and `[QB-DEBUG]` logging before any store / shared APK. Keep `__DEV__`-only logs if needed.                                   |




### C3 — `notify-new-order` gateway has `verify_jwt = false`


**Status:** DONE — webhook reloads order by id; forged customer/rider ids ignored; idempotency key returned.

|              |                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Area**     | Edge function                                                                                                                                                                                                            |
| **Threat**   | Function is reachable without a user JWT; trusts `x-webhook-secret`. On success it uses **service role** for profiles, notifications, push tokens, Expo pushes. Secret leak ⇒ inbox/push abuse.                          |
| **Evidence** | `supabase/config.toml` `[functions.notify-new-order] verify_jwt = false`; `supabase/functions/notify-new-order/index.ts`.                                                                                                |
| **Fix**      | High-entropy rotated secret in Supabase secrets; after auth, **re-load order by** `id` **from DB** and ignore client-supplied `customer_id`/`rider_id`; add idempotency (`order id + status`); rate-limit; monitor 401s. |




### C4 — Single `profiles.role` can silently downgrade capabilities


**Status:** DONE — `private.grant_role` never downgrades (admin>owner>manager>rider>customer).

|              |                                                                                                                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Area**     | Schema / roles relationship                                                                                                                                                                                            |
| **Threat**   | `private.grant_role` sets one `profiles.role`. Accepting a manager invite after being `restaurant_owner` or `rider` overwrites role → owner/rider checks fail while restaurants/assignments may still exist.           |
| **Evidence** | `supabase/migrations/20260922154000_single_role_column.sql`; `accept_manager_invite` → `grant_role(..., 'restaurant_manager')` in roles RPCs.                                                                          |
| **Fix**      | Decide product model: (a) role precedence that never downgrades (owner > manager > rider > customer), or (b) multi-capability flags / multi-role with clear precedence. Add tests for owner→manager and rider→manager. |


---



## High (fix before calling it “ready to ship”)



### H1 — Unclaimed delivery pool exposes full customer PII to every rider


**Status:** DONE — unclaimed pool via `list_rider_delivery_pool` (redacted); riders SELECT assigned only.

|              |                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Area**     | RLS / privacy                                                                                                     |
| **Threat**   | Any rider can `SELECT` full `orders` rows (address, lat/lng, notes) for all unclaimed `preparing`/`ready` orders. |
| **Evidence** | Policy `"orders: rider reads own and the unclaimed pool"` in `20260921133200_roles_rls.sql`.                      |
| **Fix**      | Redacted view/RPC for the pool (area/kitchen only); exact address only after successful `claim_delivery`.         |




### H2 — Webhook payload IDs trusted without DB re-fetch


**Status:** DONE — covered with C3 notify-new-order DB reload.

|              |                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **Area**     | `notify-new-order`                                                                                    |
| **Threat**   | With a valid webhook secret, forged `customer_id` / `rider_id` can target wrong users for push/inbox. |
| **Evidence** | `supabase/functions/notify-new-order/index.ts`                                                        |
| **Fix**      | Derive recipients from `orders` row loaded by service role.                                           |




### H3 — Auth production settings too weak (local template mirrored risk)


**Status:** DONE — Hosted Auth checklist documented in `docs/setup.md` (config.toml stays local DX).

|              |                                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Area**     | Auth                                                                                                                                             |
| **Threat**   | `enable_confirmations = false`, password length 6, empty requirements — fine for local, dangerous if cloud matches.                              |
| **Evidence** | `supabase/config.toml`                                                                                                                           |
| **Fix**      | Document required **hosted** overrides: email confirm, stronger passwords, signup rate limits / captcha. Treat config.toml as dev defaults only. |




### H4 — Rider apps load orders 3× per refresh (full-table pattern)


**Status:** DONE — deliveries API uses filtered assigned queries + pool RPC.

|              |                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Area**     | `apps/client` correctness / performance                                                                                |
| **Threat**   | Cost + latency; will not survive 5k+ scale.                                                                            |
| **Evidence** | `apps/client/src/api/deliveries.ts` + `use-rider-live.ts` — available / mine / history each call broad `loadOrders()`. |
| **Fix**      | One query + partition, or three **filtered** queries (`status`, `rider_id`).                                           |




### H5 — `restoreRiderTracking()` on every login


**Status:** DONE — restoreRiderTracking gated on rider role + active assigned order.

|              |                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Area**     | `apps/client` correctness / privacy                                                                                        |
| **Threat**   | Stale AsyncStorage `@quickbite/rider-active-order` can restart GPS/background tracking for wrong users or finished orders. |
| **Evidence** | `useAuth.tsx`, `features/rider/rider-tracking.ts`                                                                          |
| **Fix**      | Restore only if `hasRole(..., 'rider')` and server says order still active; clear storage on terminal statuses.            |




### H6 — Home catalog over-fetch + image storm


**Status:** DONE — `scripts/optimize-menu-images.mjs`, RemoteImage/expo-image, slim home catalog, unused assets removed (~129MB→~9MB).

|              |                                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Area**     | Performance / scale                                                                                                                                                                                                   |
| **Threat**   | Home pulls all browse restaurants + all available menu items + ratings + highlights; UI shows tiny thumbs but loads full-size Storage PNGs. ~**129 MB** under `apps/client/assets/images/` (mostly unused in bundle). |
| **Evidence** | `apps/client/src/api/home.ts`; RN `Image` everywhere; seed URLs in `supabase/scripts/seed_*.sql`.                                                                                                                     |
| **Fix**      | Paginate / region-filter / slim home feed; `expo-image` + cache; Supabase image transforms or thumb URLs (automate — do **not** resize 5k images by hand); delete unused local PNGs from repo.                        |




### H7 — Global Realtime too broad


**Status:** DONE — debounced home-catalog invalidation; rider realtime only when profile.role=rider.

|              |                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Area**     | Client + schema publication                                                                                                      |
| **Threat**   | Perceived lag, battery, refetch storms. Matches notes in `docs/planning.md` (status needs refresh / click delay).                |
| **Evidence** | `useLiveKitchen` (restaurants + menu_items), root rider realtime, customer orders channel; broad invalidation of `home-catalog`. |
| **Fix**      | Subscribe by role + filters; invalidate slices not whole catalog; avoid duplicate channels.                                      |




### H8 — Dashboard profile load failure → `/blocked`


**Status:** DONE — AuthGate shows retry on profileError instead of sending partners to /blocked.

|              |                                                                                     |
| ------------ | ----------------------------------------------------------------------------------- |
| **Area**     | `apps/manager` UX / security confusion                                              |
| **Threat**   | Network/RLS glitch → partner treated as unauthorized.                               |
| **Evidence** | `apps/manager/src/hooks/use-auth.tsx` (catch → `setProfile(null)`); `auth-gate.tsx` |
| **Fix**      | Error + retry screen; distinguish “no role” vs “could not load profile.”            |




### H9 — Unbounded dashboard order queries


**Status:** DONE — kitchen orders last 7d/active; performance last 30d capped.

|              |                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------- |
| **Area**     | `apps/manager` performance                                                                    |
| **Threat**   | Kitchen + `/performance` load full history; breaks with growth.                               |
| **Evidence** | `api/orders.ts` (`listRestaurantOrders`, `listPerformanceOrders`)                             |
| **Fix**      | Server-side window (e.g. last 7 days + active statuses); SQL aggregates for performance page. |




### H10 — Destructive / demo logic inside migrations


**Status:** DONE — past highlight wipe accepted; no new destructive catalog migrations this phase.

|              |                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Area**     | Schema hygiene                                                                                                            |
| **Threat**   | `DELETE FROM home_highlights` + hard-coded demo seeds / project URL in migrations can wipe or pollute production content. |
| **Evidence** | `20260923160000_home_offer_restaurant.sql`; `20260923003300_ui_catalog_and_rider_pay.sql`                                 |
| **Fix**      | Migrations = schema only; demo data in `scripts/` only; never hard-code production project refs.                          |




### H11 — EAS / env can ship with placeholder Supabase client


**Status:** DONE — release build logs missing EAS env; setup docs for eas env:list.

|              |                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------- |
| **Area**     | Mobile deploy                                                                             |
| **Threat**   | Missing EAS `EXPO_PUBLIC_`* → client uses placeholder URL/key; silent failures.           |
| **Evidence** | `apps/client/src/api/supabaseClient.ts`; `.easignore` excludes local `.env`               |
| **Fix**      | Fail-fast release screen if unconfigured; CI check `eas env:list` for preview/production. |




### H12 — Deprecated SQL bypasses role model


**Status:** DONE — assign_manager_owners.sql rewritten to use private.grant_role only.

|            |                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Area**   | Ops / relationships                                                                                                               |
| **Threat** | `scripts/assign_manager_owners.sql` updates `owner_id` / `user_roles` without `private.grant_role` → desync with `profiles.role`. |
| **Fix**    | Rewrite or delete; document “SQL editor only” with grant_role.                                                                    |


---



## Medium (outstanding quality + scale)



### Schema & relationships


| ID  | Finding                                                                               | Fix                                                                            |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| M1  | Ratings insert does not force `ratings.rider_id = orders.rider_id`                    | Tighten `WITH CHECK`                                                           |
| M2  | `order_status_history` SELECT policy is loose (“parent order exists”) vs order RLS    | Join parent visibility                                                         |
| M3  | `menu-images` public + 50 MiB limit; no MIME allowlist                                | Bucket MIME (jpeg/png/webp), ~5 MiB limit                                      |
| M4  | Direct CRUD still allowed on `push_device_tokens` besides RPC                         | Revoke direct writes; force `register_push_device`                             |
| M5  | `config.toml` points at `./seed.sql` but file missing                                 | Add seed or fix path                                                           |
| M6  | Dual role story: `Profile.roles[]` shim vs single `profiles.role` in client + manager | One model in types + docs                                                      |
| M7  | Manager `types.ts` stale vs client `database.ts` (e.g. rider fields)                  | Regenerate from one project                                                    |
| M8  | Business tab / owner vs manager product gaps still noted in `docs/planning.md`        | Restrict Business to owners; managers get assigned-restaurant performance only |




### Client app


| ID  | Finding                                                                                           | Fix                                              |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| M9  | Auth tokens in AsyncStorage (not SecureStore)                                                     | Hardware-backed storage adapter                  |
| M10 | No OAuth deep-link handler with `detectSessionInUrl: false`                                       | Linking + `createSessionFromUrl`; visible errors |
| M11 | Cart optimistic `pending-*` ids can race quantity updates                                         | Disable steppers until real id                   |
| M12 | `lastRole` may send dual-role users to rider home; customer tabs don’t `rememberRole('customer')` | Persist role on both shells                      |
| M13 | Nested `ScrollView` + `.map()` (no FlashList)                                                     | Virtualize Explore / menus / orders              |
| M14 | Root nav returns `null` while auth loading                                                        | Show `LogoLoader`                                |
| M15 | Checkout allows address without lat/lng                                                           | Warn/block for map tracking                      |
| M16 | Architecture rule “only `src/api` imports supabase” violated by hooks                             | Move Realtime into api/ or document exception    |
| M17 | Misleading `home-mock.ts` (production types)                                                      | Rename to `home-catalog.ts`                      |
| M18 | Dead components (`HighlightRail`, `PromoCarousel` unused)                                         | Wire or delete                                   |
| M19 | `@expo-google-fonts/inter` unused; `expo-dev-client` in dependencies                              | Trim deps; production AAB smoke test             |




### Dashboard


| ID  | Finding                                                                                              | Fix                                      |
| --- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| M20 | Duplicate Realtime: shell + page both `useManagerOrders`                                             | Single provider                          |
| M21 | Recharts on home route without lazy import                                                           | Dynamic import chart only                |
| M22 | No route-level lazy load for admin/performance                                                       | `lazyRouteComponent`                     |
| M23 | AuthGate returns `null` while loading                                                                | Global skeleton                          |
| M24 | Unused Lovable stubs: `client.server.ts`, `auth-middleware`, `signUpWithEmail`, `getOwnedRestaurant` | Delete or quarantine                     |
| M25 | Placeholder Feedback / Help / Notifications buttons                                                  | Wire or hide                             |
| M26 | Nested `apps/manager/supabase/config.toml` confuses source of truth                                  | Remove or document root `/supabase` only |
| M27 | Zero automated tests in manager                                                                      | Minimal auth-gate + order mapping tests  |




### Cross-cutting / product


| ID  | Finding                                                                | Fix                                                                          |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| M28 | Cash-only payments (OK for assignment; not “outstanding” commerce)     | Document; plan gateway later (`docs/planning.md`)                            |
| M29 | Edge CORS `*` on rio/directions; directions ORS quota unbound per user | Origin allowlist + rate limits                                               |
| M30 | Realtime publication includes large tables with full replica identity  | Minimal channels; selective publication                                      |
| M31 | Image pipeline not automated for 5k+ catalog                           | Transforms (Pro) or upload Edge Function + batch script for existing Storage |
| M32 | Version drift: `app.json` 0.1.0 vs `package.json` 1.0.0                | Single version + bump `versionCode`                                          |


---



## Low (polish / debt)


| ID  | Finding                                                                                                       | Fix                               |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| L1  | Narrow SQL tests (`tests/live_delivery_foundations.sql`) — don’t cover owner_id steal, claim mutex, admin RPC | Expand pgTAP / CI                 |
| L2  | Index gaps (`applications.applicant_id`, etc.)                                                                | Add when admin UI scales          |
| L3  | `push_device_tokens.platform` allows `web`; RPC rejects it                                                    | Align                             |
| L4  | RIO prompt injection → Groq quota burn (RLS still binds tools)                                                | Cap steps (already ~5); monitor   |
| L5  | Project refs / Unsplash / demo emails in seeds & docs                                                         | Placeholders for public repos     |
| L6  | `storage.vector` / S3 protocol enabled locally if unused                                                      | Disable in prod if unused         |
| L7  | Google Fonts CDN on dashboard first paint                                                                     | Self-host subset                  |
| L8  | Compress `public/logo2.png` / prefer SVG                                                                      | Asset pass                        |
| L9  | Admin cannot use kitchen UI on same login                                                                     | Product decision                  |
| L10 | `/blocked` copy ≠ account suspension                                                                          | Clarify UX                        |
| L11 | Internal scratchpads (`REMAINING.md`, thin `implementation.md`)                                               | Fold into this doc or archive     |
| L12 | Digital Asset Links / `autoVerify` for `quickbite://`                                                         | Before marketing HTTPS deep links |
| L13 | iOS EAS production profile / TestFlight docs incomplete                                                       | Complete when shipping iOS        |


---



## What is already in good shape

Do **not** rewrite these casually — they are ship strengths:

- **Order writes via SECURITY DEFINER RPCs** (`place_order`, kitchen/rider status, `claim_delivery`) with self-dealing guards in later migrations.  
- **Customer browse** via security-barrier views (`restaurant_browse`, rating public views) after tightening direct table SELECT.  
- **Cart** uniqueness + restaurant consistency triggers.  
- **Manager auth** uses `profiles.role` (aligned with single-role migration); kitchen mutations go through RPCs.  
- **Rider duty auto-off** when browsing as customer.  
- **Client typecheck + Vitest** (addresses, notifications routing, etc.) currently healthy.  
- **Dashboard build** succeeds; no service role in Vite client env.  
- **Monorepo docs** (`architecture`, `setup`, `system-flow`, README) give a clear orientation.

---



## Relationship / schema map (faults called out)

```text
auth.users
    └── profiles (role: SINGLE — see C4)
            ├── restaurants.owner_id ──► owner
            │       ├── menu_items
            │       ├── restaurant_managers ──► profiles (manager)  [H1 ownership update risk]
            │       └── orders
            │               ├── order_items (snapshots)
            │               ├── order_status_history  [M2 loose SELECT]
            │               ├── ratings  [M1 rider_id check]
            │               └── rider_id ──► profiles (rider)
            ├── applications → admin_review_application → grant_role
            ├── manager_invites → accept → grant_role(manager)  [C4 overwrite]
            ├── customer_addresses
            ├── push_device_tokens  [M4 direct writes]
            └── rider_locations (RPC-only writes — good)

Storage: menu-images (public) ──► image_url on restaurants / menu_items / home_highlights
         [H6 full-size URLs; M3 MIME/size]
```

---



## Unnecessary / remove-or-quarantine (build & repo)


| Item                                                             | Why                                         |
| ---------------------------------------------------------------- | ------------------------------------------- |
| Agent debug ingest + `[QB-DEBUG]` (C2)                           | Must not ship                               |
| ~129 MB unused PNGs in `apps/client/assets/images/`              | Inflates repo/clone; most not `require()`’d |
| Unused Inter font; dead rails (`HighlightRail`, `PromoCarousel`) | Noise                                       |
| Manager `client.server.ts` / unused middleware / unused APIs     | Footguns                                    |
| Nested `apps/manager/supabase/`                                  | Wrong source of truth                       |
| Demo `DELETE`/seed inside migrations (H10)                       | Production hazard                           |
| `assign_manager_owners.sql` as-is (H12)                          | Desyncs roles                               |


---



## Suggested fix order (execution plan)

1. **C2** strip debug telemetry
2. **C1** lock `restaurants.owner_id`
3. **C4** role precedence / multi-capability model
4. **C3 + H2** harden `notify-new-order`
5. **H1** redact rider pool
6. **H3** production Auth checklist
7. **H4 + H5** rider fetch + tracking restore
8. **H6 + M31** image pipeline (transforms/batch) + home slim + `expo-image`
9. **H7 + M20** Realtime scope / dedupe
10. **H8 + H9 + M21–M23** dashboard UX + query bounds + lazy charts
11. **H10–H12 + M3–M7** schema hygiene, storage limits, types regen
12. Medium/Low polish, tests, payments roadmap

---



## Outstanding product gaps (from planning — still open)

Tracked in `docs/planning.md`; still required for a standout product:

- Payment gateway (last priority historically; still missing for real commerce)  
- Smart rider assignment / tip when order sits in `ready`  
- Agent suite expansion (ops + support FAQs beyond RIO)  
- Owner-only Business tab; manager performance scoped to assigned restaurants  
- Realtime status sync without manual refresh (ties to H7)  
- Perceived click/update latency (ties to H6/H7)

---



## Definition of “outstanding & ready to ship”

Treat the product as shippable when:

- [ ] All **Critical** closed and verified with SQL/app tests  
- [ ] All **High** closed or explicitly accepted with risk notes  
- [ ] Hosted Auth hardened (H3)  
- [ ] EAS preview + production env verified (H11)  
- [ ] Image + catalog path safe for growth (H6 / M31)  
- [ ] No debug telemetry in release builds (C2)  
- [ ] Smoke test: signup → order → kitchen → claim → deliver → rate; owner invite manager; admin approve applications  

---

*Generated from a full-repo scan of migrations, RLS/RPCs, edge functions, Expo client, and manager dashboard. Re-run this audit after major schema or auth changes.*