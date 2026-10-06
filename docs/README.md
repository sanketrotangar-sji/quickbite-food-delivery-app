# QuickBite docs — start here

This folder is the **learning map** for the codebase. Read in order if you are new; jump via the tables if you already know what you need.

**Phase status:** Phases 1–3 done. Phase 4 **batch 1** applied (`P4, P5, P6, P20, P8`). Approve more IDs in [`11-fix-plan.md`](./11-fix-plan.md) before the next batch.

---

## Start here (15 minutes)

1. Skim [`09-glossary.md`](./09-glossary.md) so words like RLS, RPC, JWT do not surprise you.
2. Read [`07-mind-map.md`](./07-mind-map.md) — one-page mental model.
3. Skim [`01-architecture.md`](./01-architecture.md) for *why* the pieces exist.
4. Use [`02-repo-map.md`](./02-repo-map.md) whenever you ask “where do I change X?”
5. Keep [`10-faq-doubts.md`](./10-faq-doubts.md) open — add your own questions at the bottom.

---

## Doc index

| File | What it answers |
|------|-----------------|
| [`00-audit.md`](./00-audit.md) | Phase 1 findings: what exists, what is wrong, open questions (now answered). |
| [`01-architecture.md`](./01-architecture.md) | System overview, stack, Mermaid diagrams, why each choice. |
| [`02-repo-map.md`](./02-repo-map.md) | “Where do I find X?” lookup table. |
| [`03-database.md`](./03-database.md) | Tables, columns, ER diagram, triggers, RPCs, indexes. |
| [`04-security-rls.md`](./04-security-rls.md) | Every RLS policy in plain English + role × table matrix. |
| [`05-flows.md`](./05-flows.md) | Sequence diagrams for auth, order, rider, rating, RIO. |
| [`06-rio-assistant.md`](./06-rio-assistant.md) | RIO tools, prompts, LLM switch, RAG, limits, known gaps. |
| [`07-mind-map.md`](./07-mind-map.md) | Mermaid mindmap + memorize-able summary. |
| [`08-decisions.md`](./08-decisions.md) | Architecture Decision Records (CONFIRMED vs INFERRED). |
| [`09-glossary.md`](./09-glossary.md) | Plain-language dictionary. |
| [`10-faq-doubts.md`](./10-faq-doubts.md) | Beginner Q&A + your ongoing doubts. |
| [`11-fix-plan.md`](./11-fix-plan.md) | Phase 3 numbered fix proposals — approve IDs before Phase 4. |

### Supporting / topic folders

| Path | Purpose |
|------|---------|
| [`setup.md`](./setup.md) | How to run apps and link Supabase. |
| [`requirements.md`](./requirements.md) | Original assignment brief. |
| [`seed-data-spec.md`](./seed-data-spec.md) | Large seed contract (Assessment-era). |
| [`rag/`](./rag/) | RAG eval reports and queries. |
| [`ml/`](./ml/) | Offline menu-category classifier. |
| [`dct/`](./dct/) | Assessment / DCT submission helpers. |
| [`historical/`](./historical/) | Older audits (do not treat as current truth). |

### Older root docs (still useful, not the Phase track)

`architecture.md`, `system-flow.md`, `planning.md`, `implementation.md`, `delivery-status.md` — written earlier. Prefer Phase 2 files when they disagree; note the conflict in `10-faq-doubts.md`.

---

## Decisions from your Phase 1 answers (summary)

| Topic | Your call | Doc impact |
|-------|-----------|------------|
| Database home | Cloud Supabase is what you use; local Docker is optional via CLI | `01`, `08` |
| Seed wipe | OK to rebuild later with fresh test characters (keep admin careful) | Phase 3 seed plan |
| RAG | Need a **proper** RAG; current corpus is not trusted as “correct” | `06`, `08` |
| Roles | **Single-role** forever (one `profiles.role` per account) — CONFIRMED | `01`, `04`, `08` |
| RIO | Needs a deliberate agent architecture (not just 9 vs 10 tools) | `06` |
| Service role in manager | Unknown to you; code shows helper exists but **no route imports it** | `08`, `10` |
| Order timeout | **Yes — implement** auto-cancel / timeout for ignored `placed` orders | `05`, `08` |
| Android | Package `com.sjinnovation.quickbite`; EAS is the path | `01`, `08` |
| Quarantine folder | Explained in FAQ; not needed at runtime | `10` |
| Old audits | Moved to [`historical/`](./historical/) | this file |

---

## Rules for this docs track

- Phases 1–3: docs only under `/docs` (no silent source/DB edits).
- Never guess: unresolved items stay in FAQ / Open Questions.
- After Phase 4 changes, update the affected docs so they do not drift.
