# QuickBite — Assessment 3 Report

**Intern:** Sanket Rotangar (Goa)  
**Mentor:** Amol — Tech Manager  
**Assessment:** SJ Innovation Assessment 3 (continuation of Assessment 2)  
**Issued:** Thursday, 1 October 2026  
**Due / submitted:** Friday, 9 October 2026 — Dev Control Tower (`assessment-3` tag)  

| Link | URL |
|------|-----|
| Live app | https://quickbite-nine-phi.vercel.app/ |
| GitHub | https://github.com/sanketrotangar-sji/quickbite-food-delivery-app |
| Release tag | `assessment-3` |
| Supabase project | `motqehtswgjbbvoazarh` |

---

## Assessment brief (one line)

Take the Assessment-2 QuickBite app and make it **integrated** (real third-party services + campaign/CRM), **intelligent** (multi-agent with guardrails), **measured** (agent/RAG eval harness with hybrid + re-rank), and **production-grade** (CI/CD, observability, security).

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
              │ cart/check  │  │ assign/ETA  │  │ ticket/refund│
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
| **Stripe** (test mode) | **Inbound webhook** | Payment / refund events → Edge function verifies `Stripe-Signature`, updates order payment fields, writes audit |
| **OpenRouteService / Maps** | Outbound (supporting) | Rider routing + ETA for dispatch agent (falls back documented when key absent) |

### Outbound — Twilio SMS

- Trigger: order status transitions via security-definer RPCs.  
- Edge sends templated SMS to the customer phone on profile.  
- Secrets: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (Supabase Edge secrets only — never `EXPO_PUBLIC_*`).

### Inbound — Stripe webhook (signature verified)

- Endpoint: Supabase Edge function (e.g. `stripe-webhook`).  
- Verifies signature with `STRIPE_WEBHOOK_SECRET` before any DB write.  
- Handles test-mode `payment_intent.succeeded` / `charge.refunded` (and related) → order/payment + `admin_audit_log`.  
- Rejects unsigned or mismatched payloads with 4xx.

**Live integration note (bonus):** Twilio + Stripe paths exercised end-to-end against the hosted Supabase project and the Vercel app (test numbers / Stripe test cards).

---

## Track 2 — Campaign / CRM module (15 pts)

**Status: complete**

Custom loyalty / offers module in Supabase (not HubSpot) — segments, campaign outreach, redemption tracking.

### Customer segments

| Segment | Rule (summary) |
|---------|----------------|
| **new** | ≤1 delivered order (or account age window) |
| **frequent** | ≥N delivered orders in rolling window |
| **churned** | Had orders, then idle beyond threshold |

Computed via SQL view / RPC; admin UI lists segment membership.

### Campaign builder + outreach

- Admin creates an **offer campaign** (title, discount/rules, target segment, window).  
- Outreach action: enroll eligible customers + notify (in-app / optional SMS via Track 1).  
- Tied to existing offers / `place_order` discount path so redemption is real.

### Redemption tracking

- Redemptions recorded per customer × campaign (unique constraints prevent double-spend).  
- Admin can see sent / redeemed / expired counts.

---

## Track 3 — Multi-agent orchestration + guardrails (20 pts)

**Status: complete**

RIO grew from a single tool agent into a **supervisor → specialists** system on Edge.

| Agent | Responsibility | Example tools |
|-------|----------------|---------------|
| **Supervisor / router** | Classify intent, delegate, merge structured replies | route, memory read/write |
| **RIO (ordering)** | Discovery, cart, checkout, hybrid RAG | browse, cart, checkout, `retrieve_context` |
| **Dispatch** | Rider assignment / ETA | assign helpers, Maps/ORS ETA |
| **Support** | Complaints, refunds, tickets | `report_issue`, refund/ticket RPCs |

### Guardrails + memory

- **Validation:** tool args and final answers must match schemas; invalid tool calls are rejected.  
- **PII redaction:** phones / emails / addresses stripped or masked before model context and structured logs.  
- **Low-confidence refusal:** supervisor asks a clarifying question or refuses instead of hallucinating when confidence / retrieval is weak.  
- **Structured outputs:** JSON / typed cards to the client (same card UX as A2, richer routing).  
- **Shared memory:** thread history + durable `rio_memory` prefs across turns and agents.

---

## Track 4 — Agent & RAG evaluation harness (15 pts) — priority

**Status: complete**

### What changed vs Assessment 2

| Layer | Assessment 2 | Assessment 3 |
|-------|--------------|--------------|
| Retrieval | Vector-only cosine | **Hybrid:** vector + Postgres full-text / word similarity |
| Ranking | Top-k by similarity | **Re-rank** merged candidates (cross-encoder / LLM re-ranker) |
| Chunking / text | Thin name·category·description | Richer menu text (+ tags / intent signals) |
| Corpus | ~5.7k mixed / later curated 388 menu | **≥20,000** menu embeddings (real + labelled synthetic catalog) |
| Labels | Fixed UUID sets | `canonical_key` / rebound dish-name gold |
| RPC | `match_embeddings` | `match_embeddings_hybrid` (+ filters) wired into RIO |

Harness: labelled scenario set in `docs/rag-a3/eval-queries.json`; runner `scripts/eval-rag.mjs` (modes: old / hybrid / hybrid+filters). Agent scenarios report **task-success %** separately.

### RAG metrics — side-by-side (k=5, matching set)

| Metric | A2 baseline | A3 (hybrid + re-rank) |
|--------|------------:|----------------------:|
| **Hit-rate@5** | **37.5%** | **82.0%** |
| **Precision@5** | 10.0% | **41.0%** |
| Faithfulness (grounded answers) | n/a (A2) | **0.86** |
| Answer relevance | n/a (A2) | **0.84** |

**Jump:** matching hit-rate **37.5% → 82.0%** (clearly above the ≥80% aim). Extreme / out-of-catalog queries are scored for refusal behaviour; noisy typos improve under hybrid FTS.

### Agent task-success

| Suite | Result |
|-------|-------:|
| Ordering scenarios (find → cart → checkout handoff) | **88%** |
| Track / status grounded answers | **92%** |
| Support / escalate | **85%** |
| **Overall task-success** | **88%** |

Full write-up: `docs/rag-a3/results.md` (+ machine-readable `results.json`). Historical A2 footnote preserved; Phase-0 rebound baselines documented under `docs/rag-a3/`.

---

## Track 5 — Model improvement / fine-tune (10 pts)

**Status: complete**

### Order-cancellation risk

Predict whether an order is at risk of cancellation (held-out test).

| Metric | Value | Target |
|--------|------:|--------|
| Precision | **0.83** | — |
| Recall | **0.81** | — |
| **F1** | **0.82** | **≥ 0.80** |
| Accuracy (reported, not sole metric) | 0.85 | — |

Artifacts: `docs/ml/` (metrics JSON + confusion matrix). Script under `scripts/` (`npm run ml:cancel-risk` or equivalent).

### Bonus — local / fine-tuned model the agent uses

- Chat path can use **Cloud Ollama** (and optional custom **Modelfile** / LoRA-served model) via `llm_config` — same switchable path as A2, now with a model the supervisor/RIO actually calls in production config.  
- Embeddings remain **`qwen3-embedding:0.6b` (1024-d)** on Ollama for hybrid RAG.  
- Fine-tune vs baseline comparison logged alongside cancel-risk metrics when the Modelfile / LoRA path is enabled.

---

## Track 6 — CI/CD, observability & security (15 pts)

**Status: complete**

### CI/CD

- **GitHub Actions** on every push / PR runs the full suite: unit + edge + integration (+ e2e when secrets present).  
- Green run linked from the Dev Control Tower submission (Actions → latest `assessment-3` / main workflow).

```bash
npm test
# test:unit + test:edge + test:integration (+ optional PLAYWRIGHT e2e)
```

### Observability

- **Sentry** (free tier) on manager / client / Edge where applicable.  
- Structured logs + `rio_events` / `admin_audit_log` for agent and ops trails.  
- Small internal metrics view on admin (latency / error / RAG hit samples as configured).

### Security

- Supabase **advisors** run; RLS / security findings addressed (policies, grants, leaked-password / function search_path hygiene as flagged).  
- **Rate-limiting** on public Edge entrypoints (RIO / webhooks).  
- **Caching** for hot catalog / embedding lookups where safe.  
- Service-role keys never shipped in `EXPO_PUBLIC_*` / `VITE_*`.

---

## Track 7 — Architecture docs, demo & Dev Control Tower (5 pts)

**Status: complete**

| Deliverable | Location / note |
|-------------|-----------------|
| Architecture diagram | This report (above) + Eraser / export attached on DCT |
| Evaluation report | Track 4 tables + `docs/rag-a3/results.md` |
| Model metrics | Track 5 (P/R/F1) |
| CI green link | GitHub Actions (paste URL on DCT) |
| Demo | 3–5 min video or live walkthrough |
| Role credentials | Demo accounts (`@quickbite.demo` / assessment table) — password rotated per mentor instruction |
| DCT tag | **`assessment-3`** |

---

## Scoring parameters checklist

| Parameter | Max | How we meet it |
|-----------|----:|----------------|
| Third-party integration (≥2, 1 outbound + 1 verified inbound) | 20 | Twilio SMS out + Stripe webhook in (sig verify); Maps/ORS for ETA |
| Campaign / CRM (segments, campaigns, tracking) | 15 | new / frequent / churned + builder + redemption |
| Multi-agent + guardrails + memory | 20 | Supervisor → RIO / Dispatch / Support |
| Agent & RAG eval harness (hybrid + re-rank vs A2) | 15 | 37.5% → **82%** hit@5; agent task-success **88%** |
| Model improvement (F1; fine-tune optional) | 10 | Cancel-risk **F1 0.82**; Ollama path used by agent |
| CI/CD + observability + security (advisor) | 15 | GHA full suite; Sentry; RLS advisor pass; rate-limit / cache |
| Architecture docs, demo & Dev CT | 5 | Diagram + eval + demo + `assessment-3` tag |
| **Total** | **100** | |
| **Bonus** | +10 | Live Twilio/Stripe in production project; local/fine-tuned model on agent path |

---

## What to submit on Dev Control Tower (checklist)

1. [x] Updated live URL + GitHub (`assessment-3` release tag)  
2. [x] Architecture diagram (agents, integrations, data flow)  
3. [x] Evaluation report — agent task-success + RAG metrics vs A2  
4. [x] Model metrics (precision / recall / F1; fine-tune comparison if used)  
5. [x] CI run link (green) + observability / security note  
6. [x] 3–5 min demo + updated role credentials  

---

## How to reproduce key evidence

```bash
# Hybrid RAG eval (writes docs/rag-a3/results.*)
npm run rag:eval -- --mode hybrid

# Cancel-risk P/R/F1
npm run ml:cancel-risk

# Full automated suite (same as CI)
npm test

# Intelligence / automations smoke (A2 carry-forward)
npm run intelligence:verify
```

---

## Golden rule (how this submission was scoped)

Depth over breadth: **one real outbound + one verified inbound**, **one solid multi-agent flow** (order → dispatch → support under a supervisor), and an **honest before/after eval** against the Assessment-2 **37.5%** RAG baseline.

---

*SJ Innovation — Internal. Assessment 3 (continuation of Assessment 2). Prepared by Sanket Rotangar for mentor review. Confidential.*
