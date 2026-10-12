# QuickBite — Assessment 3 Report

**Intern:** Sanket Rotangar (Goa)  
**Mentor:** Amol — Tech Manager  
**Assessment:** SJ Innovation Assessment 3 (continuation of Assessment 2)  
**Issued:** Thursday, 1 October 2026  
**Report date:** Sunday, 12 October 2026 — Dev Control Tower (`assessment-3` tag)

| Link | URL |
|------|-----|
| Live app | https://quickbite-nine-phi.vercel.app/ |
| GitHub | https://github.com/sanketrotangar-sji/quickbite-food-delivery-app |
| Release tag | `assessment-3` |
| Supabase project | `motqehtswgjbbvoazarh` |

---

## Assessment brief (one line)

Take the Assessment-2 QuickBite app and make it **integrated** (real third-party services + campaign/CRM), **intelligent** (multi-agent with guardrails), **measured** (RAG eval harness with hybrid + re-rank), and **production-grade** (CI/CD, observability, security).

### Where Assessment 2 left off

| Cap | A2 result |
|-----|-----------|
| RIO tool-calling agent | Cart / checkout / track / escalate |
| Automations | Smart rider-assign + kitchen-load + audit trail |
| Embeddings | Ollama (later upgraded to `qwen3-embedding:0.6b`, 1024-d) |
| Menu-category classifier | **97.4%** accuracy |
| RAG matching hit-rate@5 | **37.5%** (honest — weak retrieval) |

Assessment 3 closes that RAG gap and adds the production layer around the same product.

---

## Architecture (agents, integrations, data flow)

```text
                    ┌─────────────────────────────────────┐
                    │     Customer / Manager / Rider UI    │
                    │   (Expo client · Vercel dashboard)   │
                    └───────────────┬─────────────────────┘
                                    │ JWT
                    ┌───────────────▼─────────────────────┐
                    │     Supervisor / Router (Edge)       │
                    │  intent → specialist · shared memory │
                    │  guardrails: validate · PII · refuse │
                    └───┬─────────────┬─────────────┬─────┘
              ┌─────────▼───┐  ┌──────▼──────┐  ┌───▼──────────┐
              │ RIO (order) │  │  Dispatch   │  │   Support    │
              │ cart/check  │  │ ETA / route │  │ tickets     │
              │ hybrid RAG  │  │ Maps / ORS  │  │ escalate    │
              └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
                     │                │                 │
         ┌───────────▼────────────────▼─────────────────▼──────────┐
         │              Supabase (Auth · Postgres · RLS · Realtime) │
         │  orders · embeddings · campaigns · tickets · audit_log   │
         └───────────┬────────────────┬─────────────────┬──────────┘
                     │                │                 │
              ┌──────▼──────┐  ┌──────▼──────┐  ┌───────▼────────┐
              │ Twilio SMS  │  │ Stripe WH   │  │ Sentry / GHA   │
              │ (outbound)  │  │ (inbound ✓) │  │ CI + errors    │
              └─────────────┘  └─────────────┘  └────────────────┘
```

**Shared memory:** `rio_threads` / `rio_messages` + `profiles.rio_memory` (durable prefs) + short-term supervisor scratch for the turn.  
**Guardrails (all agents):** input/output JSON schemas, PII redaction before LLM/logs, low-confidence clarify/refuse, tool-arg validation before RPCs.

---

## Track 1 — Third-party integration (20 pts)

**Status: complete**

≥2 real free-tier services. **One outbound action** + **one inbound webhook with signature verification**.

| Service | Direction | Role in QuickBite |
|---------|-----------|-------------------|
| **Twilio** (SMS trial) | **Outbound** | Order-status SMS (placed / ready / out_for_delivery / delivered) from Edge after RPC status changes |
| **Stripe** (test mode) | **Inbound webhook** | Payment / refund events → Edge verifies `Stripe-Signature`, updates order payment fields, writes audit |
| **OpenRouteService / Maps** | Outbound (supporting) | Rider routing + ETA for dispatch (`estimate_eta`; OSRM / haversine fallback when needed) |

### Outbound — Twilio SMS

- Trigger: order status transitions via security-definer RPCs → Edge `send-order-sms`.  
- Deduped via `notification_dispatch_log`. On Twilio trial, delivery uses **Verify SMS** (`TWILIO_VERIFY_SERVICE_SID`).  
- Secrets: `TWILIO_*` in Supabase Edge only — never `EXPO_PUBLIC_*`.

### Inbound — Stripe webhook (signature verified)

- Endpoints: `create-payment-intent` (JWT → Checkout Session) + `stripe-webhook`.  
- Verifies `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET` before any DB write.  
- Handles test-mode `payment_intent.succeeded` / refund-related events → order payment fields + `admin_audit_log`.  
- Client: optional **Pay with card (test)** on tracking; cash remains default.

**Live integration:** Twilio + Stripe paths exercised end-to-end against the hosted Supabase project and the Vercel app (test numbers / Stripe test cards).

---

## Track 2 — Campaign / CRM module (15 pts)

**Status: complete**

Custom loyalty / offers module in Supabase (not HubSpot) — segments, campaign outreach, redemption tracking. Admin UI: `/admin/crm`.

### Customer segments

| Segment | Rule (summary) |
|---------|----------------|
| **new** | ≤1 delivered order (or account age window) |
| **frequent** | ≥N delivered orders in rolling window |
| **churned** | Had orders, then idle beyond threshold |

Computed via SQL view / RPCs (`crm_segment_counts`, `crm_list_segment_members`); admin UI lists segment membership.

### Campaign builder + outreach

- Admin creates an **offer campaign** (title, discount %, target segment, window).  
- **Launch** enrolls the segment and sends in-app notifications (`crm_launch_campaign`).  
- Tied to `place_order` so enrolled discounts redeem on checkout.

### Redemption tracking

- Redemptions recorded per customer × campaign (unique constraints prevent double-spend).  
- Admin sees enrolled / redeemed / expired-unused counts (`crm_campaign_stats`).

---

## Track 3 — Multi-agent orchestration + guardrails (20 pts)

**Status: complete**

RIO grew from a single tool agent into a **supervisor → specialists** system on Edge (`supabase/functions/rio`).

| Agent | Responsibility | Example tools |
|-------|----------------|---------------|
| **Supervisor / router** | Classify intent, delegate, merge structured replies | route → order / dispatch / support / clarify |
| **RIO (ordering)** | Discovery, cart, checkout, hybrid RAG | browse, cart, checkout, `retrieve_context` |
| **Dispatch** | ETA / route context for active deliveries | `estimate_eta` (ORS → OSRM → haversine) |
| **Support** | Complaints and tickets | `order_status`, `report_issue` |

### Guardrails + memory

- **Validation:** tool args and final answers must match schemas; invalid tool calls are rejected.  
- **PII redaction:** phones / emails / addresses stripped or masked before model context and structured logs.  
- **Low-confidence refusal:** supervisor asks a clarifying question instead of hallucinating when confidence is weak.  
- **Structured outputs:** JSON / typed cards to the client (same card UX as A2).  
- **Shared memory:** thread history + durable `rio_memory` prefs across turns and agents.  
- Route logged on `rio_events.tools` as `route:{agent}:{confidence}`.

---

## Track 4 — RAG evaluation harness (15 pts)

**Status: complete**

### What changed vs Assessment 2

| Layer | Assessment 2 | Assessment 3 |
|-------|--------------|--------------|
| Retrieval | Vector-only cosine | **Hybrid:** vector + Postgres full-text / word similarity |
| Ranking | Top-k by similarity | **Re-rank** over-fetched candidates (LLM listwise + heuristic fallback) |
| Chunking / text | Thin name·category·description | Richer menu text via `buildMenuItemText` |
| Corpus | Curated ~388 menu (+ earlier junk cleared) | Synthetic catalog scale-up (**20,500** menu rows) + hybrid index |
| Labels | Fixed UUID sets | `canonical_key` / rebound dish-name gold |
| RPC | `match_embeddings` | `match_embeddings_hybrid` wired into RIO `retrieve_context` |

Harness: labelled set in `docs/rag-a3/eval-queries.json` (73 queries); runner `scripts/eval-rag.mjs` (modes: old / hybrid / hybrid+filters / hybrid+rerank). Metrics below are **test split only**.

### RAG metrics — side-by-side (k=5)

| Metric | Rebound baseline (`old`) | A3 (`hybrid+rerank`) |
|--------|-------------------------:|---------------------:|
| **Hit-rate@5** | **48.5%** | **81.8%** |
| **Precision@5** | 24.8% | **66.7%** |
| **MRR** | 0.347 | **0.695** |
| OOC refusal | 50.0% | **75.0%** |

Historical Assessment-2 footnote (pre-rebuild labels / older embedder): matching hit-rate@5 **37.5%**. A3 aim ≥80% hit@5 is met on the rebound harness (**81.8%**).

Full write-up: `docs/rag-a3/results.md` (+ machine-readable `results.json`).

---

## Track 5 — Model improvement (10 pts)

**Status: complete**

### Order-cancellation risk

Predict whether an order is at risk of cancellation (held-out test). Place-time features only (no post-claim leakage).

| Metric | Value | Target |
|--------|------:|--------|
| Precision | **0.867** | — |
| Recall | **0.825** | — |
| **F1** | **0.845** | **≥ 0.80** |
| Accuracy (reported, not sole metric) | 0.877 | — |

Model: **random_forest** (threshold tuned on train holdout). Dataset: 6 real closed orders + **3000** synthetic place-time rows — see `docs/ml/cancel-risk-dataset-summary.json`.

Artifacts: `docs/ml/cancel-risk-metrics.json`, `cancel-risk-confusion.png`. Script: `npm run ml:cancel-risk` → `scripts/cancel_risk.py`.

### Agent LLM path

- Chat path uses **Cloud Ollama** via `llm_config` (switchable Groq / Ollama) — RIO supervisor calls this path.  
- Embeddings remain **`qwen3-embedding:0.6b` (1024-d)** on Ollama for hybrid RAG.

---

## Track 6 — CI/CD, observability & security (15 pts)

**Status: complete**

### CI/CD

- **GitHub Actions** (`.github/workflows/ci.yml`) on every push / PR to `main`: secrets hygiene + unit + Deno edge tests.  
- Integration and Playwright e2e jobs run when repo secrets are present.

```bash
npm run check:secrets
npm run test:unit
npm run test:edge
# + optional integration / e2e when secrets configured
```

### Observability

- **Sentry** envelope ingest on manager / client / Edge when DSN is set (`VITE_SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` / `SENTRY_DSN`).  
- Structured trails via `rio_events` and `admin_audit_log`.

### Security

- RLS + security-definer RPC discipline; advisor / search_path hygiene tracked in product docs.  
- **Rate-limiting** on RIO (default 40/min per user).  
- **TTL cache** on directions; tool-result cache on hot RIO lookups.  
- Service-role keys never shipped in `EXPO_PUBLIC_*` / `VITE_*`.

---

## Track 7 — Architecture docs, demo & Dev Control Tower (5 pts)

**Status: complete**

| Deliverable | Location / note |
|-------------|-----------------|
| Architecture diagram | This report (above) + SVG in `docs/dct/ASSESSMENT3_REPORT.html` |
| Evaluation report | Track 4 tables + `docs/rag-a3/results.md` |
| Model metrics | Track 5 (P/R/F1) + `docs/ml/` |
| CI workflow | `.github/workflows/ci.yml` — paste green Actions URL on DCT |
| Companion architecture write-up | `docs/dct/PROJECT_ARCHITECTURE_REPORT.html` |
| Role credentials | Demo accounts (`@quickbite.demo`) — rotate password per mentor instruction |
| DCT tag | **`assessment-3`** |

---

## Scoring parameters checklist

| Parameter | Max | How we meet it |
|-----------|----:|----------------|
| Third-party integration (≥2, 1 outbound + 1 verified inbound) | 20 | Twilio SMS out + Stripe webhook in (sig verify); Maps/ORS for ETA |
| Campaign / CRM (segments, campaigns, tracking) | 15 | new / frequent / churned + builder + `place_order` redemption |
| Multi-agent + guardrails + memory | 20 | Supervisor → RIO / Dispatch / Support |
| RAG eval harness (hybrid + re-rank vs baseline) | 15 | Rebound **48.5% → 81.8%** hit@5; A2 footnote 37.5% |
| Model improvement (F1) | 10 | Cancel-risk **F1 0.845**; Ollama path used by agent |
| CI/CD + observability + security | 15 | GHA unit/edge; Sentry; rate-limit / cache; RLS discipline |
| Architecture docs, demo & Dev CT | 5 | Diagram + eval + model metrics + `assessment-3` tag |
| **Total** | **100** | |
| **Bonus** | +10 | Live Twilio/Stripe on hosted project; Cloud Ollama on agent path |

---

## What to submit on Dev Control Tower (checklist)

1. [x] Updated live URL + GitHub (`assessment-3` release tag)  
2. [x] Architecture diagram (agents, integrations, data flow)  
3. [x] Evaluation report — RAG metrics vs baseline (`docs/rag-a3/results.md`)  
4. [x] Model metrics (precision / recall / F1)  
5. [x] CI workflow + observability / security note  
6. [x] Role credentials for graders  

---

## How to reproduce key evidence

```bash
# Hybrid RAG eval (writes docs/rag-a3/results.*)
npm run rag:eval -- --mode hybrid+rerank

# Cancel-risk P/R/F1
npm run ml:cancel-risk

# Same core suite as CI
npm run check:secrets && npm run test:unit && npm run test:edge

# Intelligence / automations smoke (A2 carry-forward)
npm run intelligence:verify
```

---

## Golden rule (how this submission was scoped)

Depth over breadth: **one real outbound + one verified inbound**, **one solid multi-agent flow** (order → dispatch → support under a supervisor), and an **honest before/after RAG eval** on the rebound harness (**48.5% → 81.8%** hit@5), with Assessment-2 **37.5%** kept as the historical baseline footnote.

---

*SJ Innovation — Internal. Assessment 3 (continuation of Assessment 2). Prepared by Sanket Rotangar for mentor review. Confidential.*
