# 08 — Architecture Decision Records (ADRs)

Each entry: **context**, **decision**, **alternatives**, **consequences**.  
Status tag: **CONFIRMED BY YOU** or **INFERRED** (from code/docs only).

---

## ADR-001 — Monorepo with three apps + shared package

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | Need mobile, restaurant dashboard, and marketing site sharing one backend. |
| **Decision** | npm workspaces: `apps/client`, `apps/manager`, `apps/landing`, `packages/shared`. |
| **Alternatives** | Separate repos; one mega Expo web app for kitchen. |
| **Consequences** | Shared types/rules possible; more tooling complexity; root scripts orchestrate tests. |

---

## ADR-002 — Supabase as the backend

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | Fast build needed Auth + Postgres + realtime + edge. |
| **Decision** | Single Supabase project; RLS + RPCs for authorization. |
| **Alternatives** | Custom Nest/Express API; Firebase. |
| **Consequences** | Security must be correct in SQL; service role is powerful; migrations are sacred. |

---

## ADR-003 — Cloud Supabase is the working database

| | |
|--|--|
| **Status** | CONFIRMED BY YOU |
| **Context** | Repo supports `supabase start` (local Docker) and cloud link. |
| **Decision** | Treat **cloud** as source of truth for day-to-day work. Local is optional. |
| **Alternatives** | Local-first with cloud only for demos. |
| **Consequences** | Be careful with seeds/wipes on cloud; document when local is used. |

---

## ADR-004 — Single `profiles.role` (product + code)

| | |
|--|--|
| **Status** | CONFIRMED BY YOU (2026-10-06) + matches code |
| **Context** | Multi-role via `user_roles` was hard to reason about; silent downgrades hurt. You confirmed you do **not** want multi-role. |
| **Decision** | One role column forever; `user_roles` mirrors it; `grant_role` never downgrades precedence (`20260922154000…`, `20260929121000…`). Need both rider and customer? Use two accounts. |
| **Alternatives** | Multi-capability flags / multi-role table (rejected). |
| **Consequences** | Simpler RLS; UX must explain blocked customer/rider sides; no Phase 4 multi-role rewrite. |

---

## ADR-005 — Multi-capability accounts (superseded)

| | |
|--|--|
| **Status** | SUPERSEDED — briefly considered, then rejected by you in favour of ADR-004 |
| **Context** | Earlier note suggested rider+customer on one login. |
| **Decision** | **Do not implement.** Keep single-role. |
| **Alternatives** | — |
| **Consequences** | Docs and Phase 3 proposals omit multi-role work. |

---

## ADR-006 — Order writes only through RPCs

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | Illegal status jumps and price tampering are dangerous. |
| **Decision** | No INSERT/UPDATE/DELETE policies on `orders`/`order_items`; use `place_order`, kitchen/rider RPCs. |
| **Alternatives** | Client updates with complex RLS. |
| **Consequences** | Central state machine in SQL; apps must call RPCs correctly. |

---

## ADR-007 — Customer browse via views, not full restaurant rows

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | `owner_id` / phone should not be world-readable. |
| **Decision** | `restaurant_browse` + tightened restaurants SELECT (`20260922150000…`). |
| **Alternatives** | Column-level privileges only. |
| **Consequences** | Clients must query the view for browse; staff still use base table. |

---

## ADR-008 — Redacted rider delivery pool

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | Unclaimed order SELECT exposed customer PII to every rider. |
| **Decision** | Rider SELECT only assigned; pool via `list_rider_delivery_pool` (`20260929122000…`). |
| **Alternatives** | Trust riders with full addresses before claim. |
| **Consequences** | Safer pool; UI must use the RPC. |

---

## ADR-009 — RIO on Edge with user JWT

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | Assistant needs LLM secrets and DB access without shipping keys to the phone. |
| **Decision** | Edge function; tools run as the customer (anon + user JWT). |
| **Alternatives** | Client-side LLM; service-role tools (dangerous). |
| **Consequences** | RLS protects cart/orders tools; RAG RPC must also be scoped (currently not). |

---

## ADR-010 — Chat provider switchable; embeddings fixed

| | |
|--|--|
| **Status** | INFERRED |
| **Context** | Want Groq speed vs local Ollama; vector index must stay one size. |
| **Decision** | `llm_config` for chat; always Ollama `nomic-embed-text` 768-d for embeddings. |
| **Alternatives** | One vendor for both; change embed model (requires rebuild). |
| **Consequences** | Cloud RIO chat can work without local Ollama; embeddings/backfill still need an Ollama host. |

---

## ADR-011 — RAG corpus needs redesign

| | |
|--|--|
| **Status** | CONFIRMED BY YOU |
| **Context** | Assessment pushed ≥5k embeddings including order history; quality/trust low. |
| **Decision** | Keep aiming for **proper RAG**; do **not** treat current dataset as production-correct. |
| **Alternatives** | Ship current corpus as-is; disable RAG. |
| **Consequences** | Phase 3 must plan wipe/rebuild of embeddings + PII fix on `match_embeddings`. |

---

## ADR-012 — Order acceptance timeout

| | |
|--|--|
| **Status** | CONFIRMED BY YOU + **IMPLEMENTED (P20)** |
| **Context** | Kitchens may ignore `placed` orders. |
| **Decision** | Auto-cancel `placed` orders older than `automation_config.order_accept_timeout_minutes` (default 30) via `run_order_accept_timeout` + `pg_cron` every 5 minutes. |
| **Alternatives** | Manual only; never expire. |
| **Consequences** | Customers get a notification; history shows `cancelled`; kitchens should accept promptly. Tunable without code change. |

---

## ADR-013 — Android package & EAS

| | |
|--|--|
| **Status** | CONFIRMED BY YOU |
| **Context** | FCM / push already worked with this application id. |
| **Decision** | Keep `com.sjinnovation.quickbite`; release via EAS (`apps/client/eas.json`). |
| **Alternatives** | Change package (breaks FCM config). |
| **Consequences** | Document APK/AAB profiles; do not rename casually. |

---

## ADR-014 — Manager service-role client

| | |
|--|--|
| **Status** | INFERRED from code; you were unsure |
| **Context** | TanStack Start can run server code; `client.server.ts` builds admin client. |
| **Decision (factual):** Helper exists; **no `apps/manager/src` route imports it**. E2E uses service role separately. |
| **Alternatives** | Delete helper; wire admin-only server routes carefully. |
| **Consequences** | Today production dashboard should be JWT+anon; still avoid putting service role in Vite client env. |

---

## ADR-015 — Historical audits

| | |
|--|--|
| **Status** | CONFIRMED BY YOU |
| **Context** | `PROJECT_AUDIT.md` and `ship-readiness-audit.md` predate Phase 1. |
| **Decision** | Move to `docs/historical/`; Phase docs are current. |
| **Consequences** | Less confusion; keep files for graders/archaeology. |

---

## ADR-016 — Seed / wipe patience

| | |
|--|--|
| **Status** | CONFIRMED BY YOU |
| **Context** | Large generated seed neglected careful relevance. |
| **Decision** | Accept rebuilding later with fresh test characters and proper order coverage (careful with admin). |
| **Consequences** | Phase 3 wipe+seed plan can prioritize clean demo over preserving bulk junk. |
