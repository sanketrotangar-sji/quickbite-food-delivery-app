# 11 — Fix plan (Phase 3)

**Status:** Proposals only. **No code or DB changes until you approve specific numbers** (e.g. “do P1, P2, P7”).  
**Single-role:** Locked (ADR-004). No multi-role proposals.

**How to read each proposal**


| Field   | Meaning                                             |
| ------- | --------------------------------------------------- |
| Problem | What is wrong today                                 |
| Why     | Why it matters for production / learning / security |
| Fix     | What we would change                                |
| Risk    | What could go wrong                                 |
| Effort  | S ≈ hours, M ≈ 1–2 days, L ≈ multi-day              |
| Verify  | How we prove it worked                              |
| Depends | Other proposal IDs that should land first           |


---

## Recommended execution order

```text
Wave A — Stop bleeding (security)
  P4 → P5 → P6

Wave B — Data foundation
  P1 (constraints you care about) → P7 wipe plan (after you name keep-list) → P8 small seed → P9 RAG rebuild

Wave C — Product correctness
  P20 order acceptance timeout → P10 indexes if still needed

Wave D — Performance & structure
  P11–P14 queries → P15–P17 code structure (theme, types, data layer)

Wave E — Production readiness
  P18 env/dev-prod → P19 tests → P21 logging/errors → P22 Android release checklist → P23 quarantine cleanup
```

**Suggested first approval batch:** `P4, P5, P6, P20, P8` (security + timeout + small repeatable seed).  
Add `P7` only when you are ready to wipe cloud junk.  
Defer `P1` naming/`created_at` cosmetics until after security unless you want schema purity first.

---



## 1. Database structure



### P1 — Align `id` + `created_at` conventions on core tables


|             |                                                                                                                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Problem** | Spec wants every table to have `id` PK and `created_at`. Deviations: `orders` uses `placed_at`; `order_items` has no created_at; `order_status_history` uses bigint + `changed_at`; `rider_locations` PK is `rider_id`; `llm_config` lacks `created_at`; `automation_config` PK is `key`.                                |
| **Why**     | Consistency helps learners and tooling; not all deviations are bugs (e.g. rider_locations “one row per rider” is intentional).                                                                                                                                                                                           |
| **Fix**     | New migration(s): add missing `created_at` where harmless (`order_items`, `llm_config`); document intentional exceptions in `03-database.md` rather than forcing unnatural `id` on `rider_locations` / `automation_config`. Optionally add generated `created_at` alias view — avoid renaming `placed_at` (breaks apps). |
| **Risk**    | Renaming columns without app updates breaks clients.                                                                                                                                                                                                                                                                     |
| **Effort**  | M                                                                                                                                                                                                                                                                                                                        |
| **Verify**  | `\d` tables in SQL; client still places/tracks orders.                                                                                                                                                                                                                                                                   |
| **Depends** | None. Prefer after P4 if touching embeddings-related tables.                                                                                                                                                                                                                                                             |




### P2 — Status / role already enums — add missing CHECKs only where text slips in


|             |                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Problem** | Core statuses are enums (good). Some text fields (`issue_type`, automation `kind`, highlight `kind`) rely on app discipline.                                                   |
| **Why**     | Bad strings pollute tickets/automation.                                                                                                                                        |
| **Fix**     | Keep enums for order/role. Add CHECK or enum for `home_highlights.kind`, ticket urgency already enum; optionally constrain `support_tickets.issue_type` to a small allow-list. |
| **Risk**    | Existing bad rows fail migration — clean in P7/P8 first.                                                                                                                       |
| **Effort**  | S                                                                                                                                                                              |
| **Verify**  | Insert invalid value → error; valid → ok.                                                                                                                                      |
| **Depends** | P7/P8 if cloud has junk ticket types.                                                                                                                                          |




### P3 — Foreign keys / indexes audit patch — **DONE (2026-10-07)**


|             |                                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Most FKs exist; browse/order paths got indexes, but manager large scans and RAG joins may still miss composites.                                                                                               |
| **Why**     | Slow kitchen board and home as catalog grows.                                                                                                                                                                  |
| **Fix**     | Confirmed FKs for `delivery_address_id` / `home_highlights.restaurant_id`; added `orders_restaurant_placed_idx (restaurant_id, placed_at desc)`.                                                              |
| **Risk**    | Extra indexes slow writes slightly.                                                                                                                                                                            |
| **Effort**  | S–M                                                                                                                                                                                                            |
| **Verify**  | `EXPLAIN` on kitchen list + customer home queries.                                                                                                                                                             |
| **Depends** | Optional after P11 (know which queries hurt).                                                                                                                                                                  |


---



## 2. Security



### P4 — Fix `match_embeddings` PII leak **(DONE — batch 1)**


|             |                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | `SECURITY DEFINER` RPC returns `delivery_address` and order meta for **any** authenticated caller (`20261001120000_match_embeddings_order_history.sql`).                                                                                                                                                                                                                                                |
| **Why**     | One logged-in user can retrieve other customers’ addresses via RAG.                                                                                                                                                                                                                                                                                                                                     |
| **Fix**     | New migration: (a) remove `delivery_address` from preview/meta; (b) for `orders` / `order_items` / `order_status_history` sources, filter to `customer_id = auth.uid()` **or** drop those sources from the public RPC entirely and only embed public menu + public rating snippets; (c) revoke execute from `authenticated` if only service role / edge should call it — RIO can use a tighter wrapper. |
| **Risk**    | RIO “past order” answers get weaker until personal tools (`track_order`) cover that.                                                                                                                                                                                                                                                                                                                    |
| **Effort**  | M                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Verify**  | As user A, call `match_embeddings` / RIO retrieve — never see user B address; unit SQL test.                                                                                                                                                                                                                                                                                                            |
| **Depends** | None. **Do first.**                                                                                                                                                                                                                                                                                                                                                                                     |




### P5 — Harden `notify-new-order` webhook **(DONE — batch 1)**


|             |                                                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | `verify_jwt = false`; relies on `WEBHOOK_SECRET`. Payload fields might be trusted too much (historical ship-readiness H2).                                                                                                                                    |
| **Why**     | Anyone who guesses/leaks the URL+secret can trigger pushes or confuse notifications.                                                                                                                                                                          |
| **Fix**     | Rotate secret; after auth, **re-load order by id** from DB with service role; ignore client-supplied customer/rider ids; optional idempotency key `(order_id, status)`; document secret rotation. Consider keeping JWT off but require secret in header only. |
| **Risk**    | Misconfigured webhook → missed pushes until secret updated in Dashboard + Supabase secrets.                                                                                                                                                                   |
| **Effort**  | M                                                                                                                                                                                                                                                             |
| **Verify**  | Bad secret → 401; good secret + fake customer_id in body still notifies real DB customer only.                                                                                                                                                                |
| **Depends** | None. Early wave.                                                                                                                                                                                                                                             |




### P6 — Secrets / service-role footguns **(DONE — batch 1)**


|             |                                                                                                                                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Service role in root `.env` (gitignored — good). Manager `client.server.ts` unused but dangerous if wired carelessly. Demo passwords in `docs/dct/sample-credentials.md`.                                                                                                  |
| **Why**     | Accidental browser exposure or shared “prod” with demo passwords.                                                                                                                                                                                                          |
| **Fix**     | (a) Add comment/guard: never import `client.server` from client components; (b) CI grep for `SERVICE_ROLE` in `apps/client` and Vite client bundles; (c) mark sample credentials as **dev-only** and ensure those users are wiped or password-rotated on any shared cloud. |
| **Risk**    | Low if unused path stays unused.                                                                                                                                                                                                                                           |
| **Effort**  | S                                                                                                                                                                                                                                                                          |
| **Verify**  | Grep + build check; no service role in JS bundle.                                                                                                                                                                                                                          |
| **Depends** | P7 if wiping demo users.                                                                                                                                                                                                                                                   |




### P6b — Admin `rider_locations` read (optional)


|             |                                                      |
| ----------- | ---------------------------------------------------- |
| **Problem** | Admin may lack SELECT on live rider pins.            |
| **Why**     | Ops debugging harder.                                |
| **Fix**     | Policy: admin can SELECT all `rider_locations`.      |
| **Risk**    | Admin sees live GPS — acceptable for platform admin. |
| **Effort**  | S                                                    |
| **Verify**  | Admin client can select; customer still limited.     |
| **Depends** | None.                                                |


---



## 3. Seed data



### P7 — Wipe-and-reset plan (cloud junk) **(needs your keep-list confirmation at apply time)**


|                                                           |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem**                                               | Large `@quickbite.test` corpus + embeddings mixed with any real rows; no `is_seed` flag.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Why**                                                   | You said relevance was neglected and rebuilding later is OK.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Fix (proposal — show exact SQL in Phase 4 before run)** | 1. Export backup (Supabase dashboard or `pg_dump`). 2. Delete in FK-safe order: embeddings → tickets/automation_events → notifications → ratings → order_status_history (or cascade) → order_items → orders → cart → rider_locations → menu → members/invites → restaurants → addresses → applications → push tokens → profiles/auth for `@quickbite.test` only. 3. **Keep:** any auth users you name (e.g. your real email, admin you still use). 4. Leave `llm_config` / `automation_config` defaults. |
| **Risk**                                                  | Irreversible without backup; wrong email filter deletes real users.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Effort**                                                | M (careful ops)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Verify**                                                | Counts: 0 `@quickbite.test`; named keep users still login; admin still admin.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Depends**                                               | Explicit approval + keep-list. Backup first.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |


Provide me steps of how to do supabase backup   
**Default keep recommendation (confirm at apply):**  

- Your personal login(s)  
- One admin if not `@quickbite.test`  
- No need to keep 5k embeddings (rebuild via P9)



### P8 — Small, idempotent, identifiable seed **(DONE — batch 1, files only)**


|             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Missing `supabase/seed.sql`; huge Assessment seed is unwieldy; screens need one row per status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Why**     | Repeatable local/cloud demo without 750 orders.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Fix**     | Add `supabase/seed.sql` (and/or `supabase/scripts/seed_demo.sql`) that: creates users with emails `seed_*@quickbite.demo` (or keeps using `.test` but **marker column / email prefix**); password documented only in `.env.example` notes; **1 admin, 1 owner, 1 manager, 1 rider, 3 customers**; **3–4 restaurants**, varied cuisines; **8–15 menu items each**; **orders in every status** (`placed`…`cancelled`); cart lines; 1–2 ratings; clear `SEED_MARKER` in `notes` or email domain so wipe is easy. Wire `config.toml` seed path. Idempotent: delete-by-marker then insert, or `ON CONFLICT`. |
| **Risk**    | Conflicts with leftover Assessment emails if domains overlap — use distinct domain `quickbite.demo`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Effort**  | M                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Verify**  | `supabase db reset` locally (optional) or scripted push; every role can open app and see data; every status appears on a screen.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Depends** | Ideally after P7 on cloud; can land as file-only first.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |




### P9 — RAG corpus rebuild (proper, non-PII)


|             |                                                                                                                                                                                                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Current embeddings include order history; you don’t trust the dataset.                                                                                                                                                                                                             |
| **Why**     | Production RAG should ground on **menus + public-ish reviews**, not private orders.                                                                                                                                                                                                |
| **Fix**     | After P4: truncate `embeddings`; backfill **only** `menu_items` + `ratings` (comments); optional synthetic “FAQ” docs table later; re-run `rag:eval` against new queries; update `docs/rag/` and `06-rio-assistant.md`. Drop order-history from default `retrieve_context` filter. |
| **Risk**    | Assessment metrics that required ≥5k order vectors will change — document “prod RAG ≠ assessment corpus”.                                                                                                                                                                          |
| **Effort**  | M–L                                                                                                                                                                                                                                                                                |
| **Verify**  | Embedding count; eval report; RIO never cites foreign addresses.                                                                                                                                                                                                                   |
| **Depends** | P4, P7/P8 (clean menus).                                                                                                                                                                                                                                                           |


**Relation to 5,000+ Assessment dataset:** keep the generator under `scripts/` / quarantine for graders if needed; **production path uses the small seed + menu/ratings embeddings**, not the 5k order dump.

---



## 4. Performance



### P11 — Stop over-fetch / `select('*')` on hot paths — **DONE (2026-10-06)**


|             |                                                                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Profiles, menu, addresses, applications use `select('*')`; home loads up to 240 dishes; manager orders limits 500–2000.                                                                        |
| **Why**     | Battery, latency, and accidental column leakage.                                                                                                                                               |
| **Fix**     | Explicit column lists in client/manager APIs; home dish limit 240→96; kitchen orders 200→100; performance 2000→500; restaurant stats 500→200.                                                   |
| **Risk**    | Missed column → UI blank — TypeScript helps if types regenerated.                                                                                                                              |
| **Effort**  | M                                                                                                                                                                                              |
| **Verify**  | Network tab payload size down; screens still render.                                                                                                                                           |
| **Depends** | P16 (types) nice-to-have first.                                                                                                                                                                |




### P12 — Bound RIO tools further / cache policy — **DONE (2026-10-06)**


|             |                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------- |
| **Problem** | Tools already limit, but empty broad search still feels heavy.                                                   |
| **Why**     | Cost + latency on Groq/Ollama.                                                                                   |
| **Fix**     | Empty query with no veg/max_price returns `QUERY_REQUIRED` (no 40-kitchen dump); focused search still ≤8 places. |
| **Risk**    | “Show any restaurant” UX needs a dedicated mode.                                                                 |
| **Effort**  | S                                                                                                                |
| **Verify**  | RIO timing; no unbounded queries in code review.                                                                 |
| **Depends** | P4 for safe retrieve_context.                                                                                    |




### P13 — Rider refresh / realtime scope — **DONE (2026-10-07)**


|             |                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Historical H4/H5: multiple full order fetches; tracking restored aggressively.                                                |
| **Why**     | Battery + quota.                                                                                                              |
| **Fix**     | Realtime filtered to `rider_id=eq.user`; pool via 20s refetch while online; GPS restore only when online + active assignment. |
| **Risk**    | Missed live update if filter wrong.                                                                                           |
| **Effort**  | M                                                                                                                             |
| **Verify**  | Manual rider shift; compare request count.                                                                                    |
| **Depends** | None.                                                                                                                         |




### P14 — Optimistic UI / batching (selective)


|             |                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| **Problem** | Cart qty and kitchen status wait on round-trips.                                                        |
| **Why**     | Feels laggy.                                                                                            |
| **Fix**     | Optimistic cart updates with rollback; kitchen status optimistic in manager. No blanket `useMemo` spam. |
| **Risk**    | Desync if RPC fails — must rollback.                                                                    |
| **Effort**  | M                                                                                                       |
| **Verify**  | Toggle airplane mode mid-click → error restores UI.                                                     |
| **Depends** | None.                                                                                                   |


---



## 5. Code structure



### P15 — Shared design tokens everywhere — **DONE (2026-10-06)**


|             |                                                                                        |
| ----------- | -------------------------------------------------------------------------------------- |
| **Problem** | Hard-coded hex in OrderTracking, RIO, Notifications vs `brand-tokens`.                 |
| **Why**     | Header/background look inconsistent.                                                   |
| **Fix**     | Soft/wash/step tokens in `brand-tokens`; screens use `colors.*` (tracking/RIO/cart/notifs). |
| **Risk**    | Visual diffs — screenshot compare.                                                     |
| **Effort**  | S–M                                                                                    |
| **Verify**  | Grep for stray `#FFE` / `#FFF3` in screens ≈ 0.                                        |
| **Depends** | None.                                                                                  |




### P16 — Generated DB types as source of truth — **DONE (2026-10-07)**


|             |                                                                                        |
| ----------- | -------------------------------------------------------------------------------------- |
| **Problem** | Client `database.ts` vs manager types lag.                                             |
| **Why**     | Silent schema drift bugs.                                                              |
| **Fix**     | `npm run types:gen` regenerates client + manager; documented in README. No shared-pkg move. |
| **Risk**    | Large type churn in PR.                                                                |
| **Effort**  | M                                                                                      |
| **Verify**  | `tsc` clean after regen.                                                               |
| **Depends** | After schema migrations in a wave.                                                     |




### P17 — Clarify data-access + rename `home-mock` — **DONE (2026-10-07)**


|             |                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | `home-mock.ts` is real catalog helpers; empty `(tabs)` group; duplicate manager `supabase/` stub.                                           |
| **Why**     | Confuses learners.                                                                                                                          |
| **Fix**     | Renamed to `home-catalog.ts`; removed empty `app/(tabs)`; manager `supabase/README.md` notes tooling-only stub.                           |
| **Risk**    | Many import path updates.                                                                                                                   |
| **Effort**  | S–M                                                                                                                                         |
| **Verify**  | App compiles; docs repo-map updated.                                                                                                        |
| **Depends** | None.                                                                                                                                       |


---



## 6. Production readiness



### P18 — Migrations as SoT + env separation — **DONE (2026-10-06)**


|             |                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Data inserted inside migrations (`home_highlights`); missing `seed.sql`; cloud vs local unclear to you.                                                 |
| **Fix**     | Docs: [`12-environments.md`](./12-environments.md); migrations rule in `03-database`; seed path confirmed in `config.toml` (P8). No cloud project split. |
| **Risk**    | Two projects cost/time.                                                                                                                                 |
| **Effort**  | M                                                                                                                                                       |
| **Verify**  | Fresh `db reset` applies migrations + seed cleanly (local).                                                                                             |
| **Depends** | P8.                                                                                                                                                     |




### P19 — Tests for critical order flow + RLS — **DONE (2026-10-06)**


|             |                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Problem** | Some unit/edge/integration exist; RLS not systematically tested.                                                                                             |
| **Why**     | Regressions on status/PII are expensive.                                                                                                                     |
| **Fix**     | `tests/integration/rls-rag-smoke.mjs`: cross-customer RLS (seed login), `match_embeddings` no `delivery_address`, dispatch-log unique claim; wired into `test:integration`. |
| **Risk**    | Needs service role in CI secrets.                                                                                                                            |
| **Effort**  | M                                                                                                                                                            |
| **Verify**  | `npm run test:integration` green against cloud/dev.                                                                                                          |
| **Depends** | P4, preferably P8.                                                                                                                                           |




### P20 — Order acceptance timeout **(DONE — batch 1)**


|             |                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Kitchen can leave `placed` forever.                                                                                                                                                                                                                                                                                                                     |
| **Why**     | You asked to implement now.                                                                                                                                                                                                                                                                                                                             |
| **Fix**     | Migration: `pg_cron` or edge cron every N minutes → cancel (or mark expired) orders in `placed` older than T minutes (config in `automation_config`, e.g. `order_accept_timeout_minutes`); write `automation_events`; notify customer via existing push path if possible. Document state: `placed` → `cancelled` with reason in notes or event payload. |
| **Risk**    | Too-short T cancels real busy kitchens; timezone/clock issues.                                                                                                                                                                                                                                                                                          |
| **Effort**  | M                                                                                                                                                                                                                                                                                                                                                       |
| **Verify**  | Insert old `placed` fixture → cron → `cancelled` + history row; fresh order untouched.                                                                                                                                                                                                                                                                  |
| **Depends** | None (can ship before seed wipe).                                                                                                                                                                                                                                                                                                                       |




### P21 — Error handling & logging — **DONE (2026-10-07)**


|             |                                                                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Uneven empty/error states; edge logs unstructured.                                                                                                                    |
| **Fix**     | `userFacingMessage` helper on client; RIO/notify logs prefixed with short `requestId` + action (no PII). Auth-gate already skips blocked on profile fail.           |
| **Risk**    | Low.                                                                                                                                                                  |
| **Effort**  | M                                                                                                                                                                     |
| **Verify**  | Force 401/network error → clear message.                                                                                                                              |
| **Depends** | None.                                                                                                                                                                 |




### P22 — Android APK / EAS release checklist — **DONE (2026-10-06)**


|             |                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Problem** | Release knowledge tribal.                                                                                                                                                                                       |
| **Fix**     | [`docs/12-release-android.md`](./12-release-android.md): package id, EAS profiles, env, FCM/`google-services.json`, smoke list; linked from README + setup.                                                      |
| **Risk**    | None (docs).                                                                                                                                                                                                    |
| **Effort**  | S                                                                                                                                                                                                               |
| **Verify**  | You follow checklist once → installable APK.                                                                                                                                                                    |
| **Depends** | None.                                                                                                                                                                                                           |




### P23 — Quarantine / backup strategy — **DONE (2026-10-07)**


|             |                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| **Problem** | `_delivery_quarantine/` is bulky; no documented backup.                                                           |
| **Fix**     | Quarantine README + gitignore exception; backup/PITR/`pg_dump` section in `12-environments.md`; FAQ updated.    |
| **Risk**    | Losing Assessment artifacts — copy to Drive first if graders need them.                                           |
| **Effort**  | S                                                                                                                 |
| **Verify**  | Repo smaller; backup steps in docs.                                                                               |
| **Depends** | P8.                                                                                                               |




### P24 — RIO agent architecture (design → thin implementation)


|             |                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Problem** | Tool soup without clear routing; you want a proper agent design.                                                                                             |
| **Fix**     | Phase 4 doc-first: intent router (browse / cart / track / complaint); then optional code to prefer tool subsets per intent. Not a big rewrite in one commit. |
| **Risk**    | Over-engineering — keep thin.                                                                                                                                |
| **Effort**  | M (design S, code M)                                                                                                                                         |
| **Verify**  | Scripted prompts hit expected tools.                                                                                                                         |
| **Depends** | P4, P9.                                                                                                                                                      |


---



## Proposal index (quick)


| ID  | Area                 | Severity          | Effort |
| --- | -------------------- | ----------------- | ------ |
| P1  | DB conventions       | Medium            | M      |
| P2  | CHECKs               | Low–Med           | S      |
| P3  | Indexes/FKs          | Medium            | S–M    |
| P4  | RAG PII              | **DONE (batch 1)** | M      |
| P5  | Webhook              | **DONE (batch 1)** | M      |
| P6  | Secrets footguns     | **DONE (batch 1)** | S      |
| P6b | Admin GPS read       | Low               | S      |
| P7  | Wipe junk            | High              | M      |
| P8  | Small seed           | **DONE (batch 1)** | M      |
| P9  | RAG rebuild          | High              | M–L    |
| P11 | Query hygiene        | High              | M      |
| P12 | RIO bounds           | Medium            | S      |
| P13 | Rider perf           | Medium            | M      |
| P14 | Optimistic UI        | Medium            | M      |
| P15 | Theme tokens         | Medium            | S–M    |
| P16 | DB types             | Medium            | M      |
| P17 | Structure rename     | Low–Med           | S–M    |
| P18 | Env / migrations SoT | High              | M      |
| P19 | Tests RLS/order      | High              | M      |
| P20 | Accept timeout       | **DONE (batch 1)** | M      |
| P21 | Errors/logging       | Medium            | M      |
| P22 | Android release doc  | Medium            | S      |
| P23 | Quarantine/backup    | Low–Med           | S      |
| P24 | RIO agent design     | Medium            | M      |


---



## Explicitly out of scope (by your decisions)

- Multi-role / customer+rider on one account  
- Rewriting old migration files  
- Blind production DELETE without showing SQL + approval

---



## Phase 3 status

**Complete.** Phase 4 batches applied — see [`CHANGELOG.md`](./CHANGELOG.md). Remaining deferred: **P7**, **P9**, plus optional P1/P2/P6b/P14/P24.