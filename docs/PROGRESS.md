# QuickBite — Progress

Update this file after every meaningful task. Status as of **2026-10-09**.

---

## Done

### Product foundation
- [x] Monorepo: `apps/client` (Expo), `apps/manager` (dashboard), `apps/landing`, `packages/shared`, `supabase/`
- [x] Auth: email/password + Google; signup → `customer` profile
- [x] Roles: customer, rider, restaurant_manager, restaurant_owner, admin (single-role)
- [x] Order RPC chain: `place_order` → kitchen status → claim/auto-assign → rider deliver → rate
- [x] RLS + browse views + redacted rider pool
- [x] Realtime kitchen / tracking; push webhook (`notify-new-order`) with dedupe
- [x] Owner invite managers; admin applications for riders/owners
- [x] Dashboard live on Vercel; migrations pushed to cloud Supabase

### Phase 4 / production readiness (batches 1–3 + waves)
- [x] RAG PII scope on `match_embeddings`; RIO retrieve menu/ratings only
- [x] Order accept timeout (30 min default, `pg_cron`)
- [x] Secrets hygiene check in `npm test`
- [x] Local demo seed `@quickbite.demo` in `supabase/seed.sql`
- [x] Query hygiene, theme tokens, unified `types:gen`
- [x] Rider duty/earnings RPCs; GPS scoped to online + assigned
- [x] RIO cloud threads (`rio_threads` / `rio_messages`)
- [x] Customer fetch/image performance pass
- [x] Android EAS package `com.sjinnovation.quickbite` documented

### Truth layer (A–E) — 2026-10-08
- [x] **A** — Offers + `discount_amount` in `place_order`; drop/pickup km; Goa geo script; Near me ≤8 km default; range guards on add/checkout
- [x] **B** — Manager prep avg, cancel confirm, rider panel, Quiet/Normal/Busy capacity
- [x] **C** — Performance Today/7d/30d, AOV, prep SLA; rider rating on profile
- [x] **D** — `admin_audit_log`, capacity threshold, refund fields; admin tickets/orders/riders + restaurant ops RPCs
- [x] **E** — RIO cart/confirm parity with checkout fees + range; track/support grounding

### RIO pipeline (Phases 1–8) — 2026-10-08
- [x] `rio_snapshot` (+ taste from delivered orders)
- [x] Streaming final answer + NDJSON progress
- [x] Server thread history (last 8); client sends latest user text
- [x] `cartHash` on confirm (CART_CHANGED guard)
- [x] Tools: browse_themes, find_offers, verify_dish (+ find_food alias), get_menu, cart, checkout, order_status, report_issue, reorder_last, save_prefs
- [x] `rio_events` + LLM failover retry
- [x] Client split: `useRioThread` / `useRioChat` / `RioMessageList`
- [x] Discovery + smart seller + resilience (theme→kitchen→menu; conflict early-exit; calm errors; `distanceKm` on cards)

### Docs cleanup — 2026-10-08
- [x] Consolidated to `README.md`, `docs/REQUIREMENTS.md`, `docs/PROGRESS.md`, `.cursor/rules/project.mdc`
- [x] Pre-submission backlog in `docs/PLAN.md`

### Catalog + curated RAG — 2026-10-08
- [x] Enriched short restaurant/menu descriptions (UPDATE only; no entity deletes)
- [x] **P9** — wiped junk embeddings; migrated to `qwen3-embedding:0.6b` **1024-d**
- [x] Curated backfill: 388 `menu_items` (comment ratings when present); no orders/history junk
- [x] `OLLAMA_BASE_URL=https://ollama.buildyourai.consulting`; `rio` redeployed; dosa smoke OK
- [x] Chat LLM unchanged (`llm_config` Groq / Ollama)
- [x] Admin `/admin/ai`: Cloud Ollama chat card + fixed RAG panel (host/model/dims; secrets stay in Edge)
- [x] RIO: hide model reasoning from UI; durable `profiles.rio_memory` + `save_prefs`; clarify-first prompt; keep more cards

### Synthetic corpus scale-up — 2026-10-09
- [x] `scripts/datagen/`: vocab + 160-base catalog → 669 expanded dishes → **250** synthetic restaurants × **82** items = **20,500** menu rows
- [x] Deterministic UUIDv5 + seeded PRNG; validator green; CSVs/report in `scripts/datagen/out/` (gitignored)
- [x] Loaded to cloud (dry-run → `--limit 200` → full); upsert `onConflict id`; real (`is_synthetic=false`) rows untouched
- [x] One synthetic owner `synthetic-owner@quickbite.synthetic` (UUIDv5) owns all synthetic restaurants

### A3-T4 hybrid RPC + backfill — 2026-10-09
- [x] Applied `20261009010000_rag_hybrid_a3.sql` on cloud: `content`/`metadata`/`fts`, `match_embeddings_hybrid` (live menu filters; real cosine; word_similarity; OR tsquery)
- [x] `buildMenuItemText` in `supabase/functions/_shared/ragText.{mjs,ts}`; both backfill scripts use it
- [x] Backfill flags `--force --source --limit --concurrency`; batch Ollama `/api/embed`; writes content + hash + metadata
- [x] Timed 200 menu upserts ≈ **113.5s** → estimate **~189 min** for 20,000 (~1.76 items/s)
- [x] Smoke: hybrid returns rows; veg filter zero non-veg; `is_available=false` hides hit then restored
- [x] Eval harness rebuilt: 73 queries (`canonical_key`, 50/50 dev/test, 5 buckets); modes old / hybrid / hybrid+filters; OOC thr tuned on **dev** (Youden)
- [x] Test report `docs/rag-a3/results.md`: **old hit@5 51.5% → hybrid(+filters) 81.8%**; OOC refusal 50%→75%; p@5 27.3%→63.6%
- [ ] RIO still on `match_embeddings` (switch later); finish full ≥20k embed backfill

---

## In progress

| Item | Notes |
|------|--------|
| **A3-T4 corpus embed** | Backfill ~20k synthetic menu embeddings (paused briefly for eval; resumed). Eval already green on hybrid. |
| Android APK distribution | Prefer EAS cloud preview; local `build-*.apk` files are gitignored artifacts only |
| Hosted Auth redirects | Confirm email + Google redirects for Vercel + `quickbite://` |
| Maps secret | Set `OPENROUTESERVICE_API_KEY` in Supabase secrets if directions must avoid OSRM fallback |
| Landing deploy | Optional separate Vercel project for `apps/landing` |

---

## Next

| Priority | Item |
|----------|------|
| **A3-T4** | Hybrid RAG + re-rank + ≥20k corpus + eval harness (beat **37.5%** hit-rate; aim ≥80%) — see `docs/PLAN.md` |
| A3-T3 | Multi-agent supervisor (RIO + dispatch + support) + guardrails |
| A3-T1 | ≥2 third-party integrations (1 outbound + 1 signed inbound webhook) |
| A3-T2 | Campaign / CRM: segments + outreach + redemption |
| A3-T5 | Cancel-risk model: precision / recall / F1 ≥ 0.80 (+ optional fine-tune bonus) |
| A3-T6 | GHA full tests; Sentry; advisor/RLS; rate-limit + cache |
| A3-T7 | Arch diagram + eval report + demo + Dev CT `assessment-3` |
| Ops | Auth redirects, ORS key, EAS APK, optional landing deploy |
| Later | Drop `user_roles` mirror; **P7** clean demo seed (backup first) |

---

## Decisions made

| ID | Decision |
|----|----------|
| ADR-001 | Monorepo: client + manager + landing + shared |
| ADR-002 | Supabase = Auth + Postgres + RLS + Realtime + Edge |
| ADR-003 | **Cloud Supabase** is day-to-day DB SoT; local Docker optional |
| ADR-004 | **Single `profiles.role` forever** — two accounts if two jobs |
| ADR-005 | Multi-capability on one login — **rejected** |
| ADR-006 | Order writes **only via RPCs** |
| ADR-007 | Customers browse via `restaurant_browse`, not full restaurant rows |
| ADR-008 | Rider unclaimed pool via **redacted** `list_rider_delivery_pool` |
| ADR-009 | RIO on Edge with **user JWT** (RLS applies to tools) |
| ADR-010 | Chat provider switchable (`llm_config`); embeddings fixed to Ollama `qwen3-embedding:0.6b` **1024-d** |
| ADR-011 | RAG curated rebuild done (menu + comment ratings); Assessment junk corpus cleared |
| ADR-012 | Order accept timeout — **implemented** (default 30 min) |
| ADR-013 | Android package `com.sjinnovation.quickbite`; ship via EAS |
| ADR-014 | Manager service-role helper must not ship to browser; dashboard uses anon + JWT |
| ADR-016 | OK to wipe/rebuild seed later with care for admin |
| A3-001 | Assessment 3 track order: **T4 → T3 → T1 → T2 → T5 → T6 → T7** (full checklist in `docs/PLAN.md`) |
| A3-002 | A2 RAG baseline locked at **37.5%** hit-rate for before/after reports |
| A3-003 | T1 vendors TBD; T2 default = custom CRM (not HubSpot) unless score sheet requires it |
| A3-006 | Synthetic catalog owner: **one** `restaurant_owner` profile (`e12406d9-382d-5d96-9ef8-b2ffbf46c116`); all synthetic restaurants share `owner_id` — FK kept intact |

---

## Changelog (compressed)

- **2026-10-09** — A3-T4: fixed + applied hybrid migration; `match_embeddings_hybrid` smoke OK; backfill writes content/hash/metadata; 200 timed (~189 min / 20k est)

- **2026-10-09** — Synthetic datagen loaded: **250** restaurants + **20,500** menu_items (`is_synthetic=true`); one synthetic owner; scripts in `scripts/datagen/`  
- **2026-10-09** — A3-T4 eval rebuild: 73 canonical_key queries + modes; old test hit@5 **48.5%** / OOC 50% (`docs/rag-a3/results.md`); hybrid blocked pending migration apply  
- **2026-10-09** — A3-T4 Phase **1**: drafted hybrid migration + `match_embeddings_hybrid` (not applied); review in `docs/rag-a3/01-phase1-review.md`  

- **2026-10-09** — A3-T4 Phase **0b**: rebound eval gold by dish name; baseline-v0 matching **50%** / precision **20%** (qwen, 388 rows); A2 37.5% footnote only  
- **2026-10-09** — A3-T4 Phase **0a**: restored `docs/rag/`; cloud probe (388 embeddings, dirty gold IDs); audit in `docs/rag-a3/00-audit.md`  
- **2026-10-09** — `docs/PLAN.md` rewritten for Assessment 3; A2 work archived as baseline; Next = T4 first  
- **2026-10-08** — RIO discovery (`browse_themes` / `find_offers` / `verify_dish`) + two-order seller + graceful degradation; catalog RAG; truth layer A–E; docs + PLAN.md  
- **2026-10-07** — Production waves 0–6; customer perf; Phase 4 batches 2–3  
- **2026-10-06** — Phase 4 batch 1 (PII, webhook, secrets, timeout, seed)  
- **2026-10-01** — Delivery handoff: migrations/functions/dashboard smoke; quarantine local noise  
