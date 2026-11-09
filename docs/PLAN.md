# QuickBite — plan (Assessment 3)

Backlog for Assessment 3. Day-to-day status: `[PROGRESS.md](./PROGRESS.md)`. Product SoT: `[REQUIREMENTS.md](./REQUIREMENTS.md)`.

**Execution rule:** one track at a time → update PROGRESS (Done + numbers + Decision) → next. Thin CI can land early; full Track 6 hardening after features stabilize.

---

## Already done (Assessment 2 baseline — do not redo)


| Item | Notes                                                                              |
| ---- | ---------------------------------------------------------------------------------- |
| [x]  | RIO tool agent: cart / checkout / track / escalate (+ discovery seller tools)      |
| [x]  | Smart rider-assign + kitchen-load automations + `admin_audit_log`                  |
| [x]  | Ollama embeddings `qwen3-embedding:0.6b` (1024-d); curated corpus (~388 menu rows) |
| [x]  | Menu-category classifier **97.4%** (A2)                                            |
| [x]  | RAG eval honest baseline: **37.5%** hit-rate (A2) — Track 4 must beat this         |
| [x]  | Catalog text enrich + discovery/resilience polish (2026-10-08)                     |
| [x]  | Admin AI page: Cloud Ollama + RAG panel; RIO memory / clarify-first                |


Chat LLM stays switchable via `llm_config` (Groq / Ollama). Embeddings stay on Cloud Ollama unless Track 5 bonus changes serving.

---



## Assessment 3 — tracks (recommended order)

Defaults were **4 → 3 → 1 → 2 → 5 → 6 → 7**. Live order: **T6 before T5** (A3-010).


| Order | Track                                   | Status   | Done when                                                                                                                                                                                    |
| ----- | --------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **T4 — RAG + eval harness**             | [x]      | Hybrid RPC + RIO on `match_embeddings_hybrid` + LLM/heuristic re-rank. Corpus **frozen** (no further backfill). Eval: old hit@5 **48.5%** → hybrid+rerank **81.8%** — see `docs/rag-a3/results.md`. |
| 2     | **T3 — Multi-agent + guardrails**       | [x]      | Supervisor → order / dispatch / support (+ clarify); PII redact; tool-arg validate; low-confidence clarify; `estimate_eta`; route logged on `rio_events`. Shared memory via threads + `rio_memory`. |
| 3     | **T1 — Third-party (≥2)**               | [x]      | Twilio outbound (Verify on trial) + Stripe signed webhook + Checkout. E2E smoke OK; Stripe UX polish later. |
| 4     | **T2 — Campaign / CRM**                 | [x]      | Custom Supabase CRM (not HubSpot): segments view + campaigns + launch outreach + `place_order` redemption. Admin `/admin/crm`. |
| 5     | **T6 — CI/CD, observability, security** | [x]      | GHA CI (secrets + unit + edge; optional integration/e2e); optional Sentry; RIO rate-limit; directions TTL cache; advisor checklist in REQUIREMENTS. |
| 6     | **T5 — Cancel-risk model**              | [x]      | Offline `npm run ml:cancel-risk`: random_forest held-out **F1 0.845** (P 0.867 / R 0.825). Artifacts in `docs/ml/`. Synthetic corpus (cloud had only 6 closed orders). Bonus Modelfile deferred. |
| 7     | **T7 — Docs, demo, Dev CT**             | [x]      | Final report `docs/dct/ASSESSMENT3_REPORT.{md,html}` (arch SVG + RAG before/after + cancel-risk P/R/F1); companion `PROJECT_ARCHITECTURE_REPORT.html`. Tag **`assessment-3`** on DCT. |


**Bonus (any time after T4/T3):** locally serve or fine-tune a model RIO *calls* end-to-end (not only embeddings).

---



## Ops / polish (not A3 tracks — keep small)


| Priority | Item                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Ops      | Auth redirects: Vercel origin + `quickbite://` (email + Google)                                        |
| Ops      | `OPENROUTESERVICE_API_KEY` in Supabase secrets if Maps/ETA must avoid OSRM fallback (may fold into T1) |
| Ops      | EAS preview APK link for graders                                                                       |
| Ops      | Optional: deploy `apps/landing` as its own Vercel project                                              |
| Done     | Schema hardening P0–P5 (drop `user_roles`, fence synthetic, checkout offer helper, `order_payments`, notification outbox, profile side tables) |
| Ops      | Apply pending migrations `2026110401*`–`2026110406*` via `supabase db push` (requires CLI login)       |
| Later    | Drop legacy `orders.payment_*` / `profiles` rider+rio mirror columns after dual-write proves stable     |
| Later    | **P7** — Clean demo seed / careful cloud wipe if graders need a fresh cast (backup first)              |


---



## Audit fixes (2026-11-07)

From the Ponytail audit. One step per task. Do not start the next step in the same change. Steps 1 and 4 write SQL: stop and get a yes before creating the migration.

1. **Sign-up trigger.** New migration `supabase/migrations/20261107010000_fix_handle_new_user.sql` replaces `public.handle_new_user()` with the profile insert only. Delete the `insert into public.user_roles`. Keep `on conflict (id) do nothing` and `role = 'customer'`. No other trigger edits. Then note it in REQUIREMENTS (the `on_auth_user_created` row) and PROGRESS.
2. **Dead Home fetchers.** In `packages/api/src/mobile/home.ts`, delete `fetchHomeCatalog`, `fetchHomeShell`, and `fetchHomeDishes`, plus helpers that only those three call. Grep the repo first. Keep `fetchFavoritesCatalog` and `fetchSimilarPlaces`. Run `packages/api` typecheck.
3. **Dead package and one-off scripts.** Delete `packages/shared/` (nothing imports `@quickbite/shared`). Delete `scripts/migrate-client-features.mjs`, `scripts/migrate-packages-api.mjs`, and `scripts/extract-manager-pages.mjs` (no `package.json` script calls them). Fix the title in `packages/domain/README.md` (it still says `@quickbite/shared`). Refresh the lockfile with `npm install`.
4. **Admin lists that load every row.** New migration adds one security-definer RPC, `admin_overview()`, returning counts only (kitchens, open kitchens, applications by status, profiles by role, active orders). `packages/api/src/dashboard/admin.ts` calls that RPC for the overview. List functions (`applications`, `profiles`, `restaurants`, `tickets`, `orders`) get `.range(0, 49)` and a matching limit argument. Do not add a new dashboard page.
5. **Menu image upload.** Move the `supabase.storage.from('menu-images')` call out of `apps/manager/src/lib/images.ts` into `packages/api/src/dashboard/menu.ts`. The screen keeps calling the api wrapper. Add one Vitest that the upload helper sends the thumb path and content type.
6. **Kitchen status test.** One Vitest next to `apps/manager/src/api/orders.test.ts` for the legal kitchen transition helper already in `@quickbite/domain` (`nextKitchenStatus`). No new UI.
7. **RIO file split.** Split `supabase/functions/rio/index.ts` by job, not by line count: HTTP entry stays in `index.ts`; the model turn loop moves to `turn.ts`; SSE write helpers move to `stream.ts`. Behavior stays the same. Existing `guardrails.test.ts` and `supervisor.test.ts` must still pass. Do not add a new agent.
8. **One-line api shims.** Delete `apps/client/src/api/*.ts` and `apps/manager/src/api/*.ts` files whose body is only `export * from '@quickbite/api/...'`. Point those imports at `@quickbite/api`. Keep `apps/client/src/api/auth.ts`, `payments.ts`, and `supabaseClient.ts`. A tsconfig alias cannot do this: `@/*` already maps to `./src/*`, and those three files are real code in the same folder.
9. **Style warnings, last.** Only in a file a step above already edits: swap a literal `fontSize` for an `AppText` `variant` when the size matches `type` in `@/constants/theme`. Do not open screens only to clear the ~290 warnings.

Not in this list: Explore/Favorites FlashList, rider `NearbyOrderCard`, recent-search UI, splash asset deletion, cloud `db push`, `rio` deploy. Those stay in PROGRESS as separate ops.

## Out of scope (unless product asks)

- Multi-role RIO (rider/kitchen/admin on one agent login)
- Real UPI / live card capture beyond Stripe **test mode** for T1
- Unrelated refactors / new apps

---



## Decisions (Assessment 3)


| ID     | Decision                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------- |
| A3-001 | Track order default was **T4 → T3 → T1 → T2 → T5 → T6 → T7**; overridden by A3-010 |
| A3-002 | RAG corpus may grow past “menu + comment ratings only” to hit ≥20k — document source mix in PROGRESS when chosen |
| A3-003 | T1 vendors locked: **Twilio** outbound SMS + **Stripe** test inbound webhook (sig verify); ORS/Maps supporting outbound for ETA |
| A3-004 | T2: **custom** Supabase CRM (segments + campaigns + redemption); HubSpot not used |
| A3-005 | Do not delete restaurants/menu/orders/profiles for RAG scale-up; synthetic/enriched rows OK if labelled as such  |
| A3-010 | Live order: **T6 before T5** (CI/observability before cancel-risk) |
| A3-011 | T5 cancel-risk: offline sklearn only; synthetic corpus OK when real closed orders are sparse |


