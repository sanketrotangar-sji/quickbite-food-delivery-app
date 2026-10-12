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
| Later    | Drop `user_roles` mirror (`profiles.role` is SoT)                                                      |
| Later    | **P7** — Clean demo seed / careful cloud wipe if graders need a fresh cast (backup first)              |


---



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


