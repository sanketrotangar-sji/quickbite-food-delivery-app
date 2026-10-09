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

Defaults: **4 → 3 → 1 → 2 → 5 → 6 → 7**. Change order only by editing this table + PROGRESS.


| Order | Track                                   | Status   | Done when                                                                                                                                                                                    |
| ----- | --------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | **T4 — RAG + eval harness**             | [~]      | Hybrid RPC + labelled eval done: test hit@5 **81.8%** (old 51.5%) — see `docs/rag-a3/results.md`. Remaining: finish ≥20k embed backfill, RIO switch to hybrid, re-rank/faithfulness extras. |
| 2     | **T3 — Multi-agent + guardrails**       | [ ]      | Supervisor → RIO (order) + dispatch (assign/ETA) + support (complaints/refunds); shared memory; validation, PII redaction, low-confidence refuse, structured outputs.                        |
| 3     | **T1 — Third-party (≥2)**               | [ ]      | ≥2 real free-tier services; **1 outbound** + **1 inbound webhook with signature verify**. Candidates: Stripe test + Twilio SMS; Maps/ETA (ORS already partial). Pick vendors before coding.  |
| 4     | **T2 — Campaign / CRM**                 | [ ]      | Segments (new / frequent / churned) + campaign/outreach action + redemption tracking (HubSpot integration).                                                                                  |
| 5     | **T5 — Cancel-risk model**              | [ ]      | Precision / recall / **F1 ≥ 0.80** (not accuracy-only). Bonus: LoRA or Ollama Modelfile the agent actually uses.                                                                             |
| 6     | **T6 — CI/CD, observability, security** | [ ]      | GitHub Actions full suite on push/PR; Sentry (+ logs/metrics); Supabase advisor pass + RLS fixes; rate-limit + caching.                                                                      |
| 7     | **T7 — Docs, demo, Dev CT**             | [ ]      | Architecture diagram + eval report (before/after) + short demo; submit on Dev Control Tower with **assessment-3** tag.                                                                       |


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
| A3-001 | Track order default: **T4 → T3 → T1 → T2 → T5 → T6 → T7**                                                        |
| A3-002 | RAG corpus may grow past “menu + comment ratings only” to hit ≥20k — document source mix in PROGRESS when chosen |
| A3-003 | T1 vendors: **TBD** (propose Stripe test webhook + Twilio outbound; Maps if needed for second outbound/ETA)      |
| A3-004 | T2: prefer **custom** segments/campaigns in Supabase unless HubSpot is required for the score sheet              |
| A3-005 | Do not delete restaurants/menu/orders/profiles for RAG scale-up; synthetic/enriched rows OK if labelled as such  |


