# 06 — RIO assistant

**RIO** = QuickBite’s AI ordering assistant for the **signed-in customer**.  
It lives as a Supabase **Edge Function** (Deno server code next to your project): `supabase/functions/rio/`.

**Your call (CONFIRMED):** do not obsess over “9 vs 10 tools” — design a **proper agent architecture**. This doc describes **what exists today**, then what that implies for redesign.

---

## How a turn works

1. Customer opens RIO UI (`apps/client/src/screens/customer/RioScreen.tsx`).  
2. App POSTs to the `rio` function with the user **JWT** (`apps/client/src/api/rio.ts`).  
3. Gateway: `verify_jwt = true` (`supabase/config.toml`).  
4. Function builds a Supabase client with the **same Bearer token** + **anon key** so every DB call runs as that customer (**RLS applies**).  
5. Chat model (Groq or Ollama) receives a system prompt + tool definitions.  
6. Model may call tools; results return as text + optional **cards** (restaurants, menu, cart, order, ticket).  
7. Checkout is **two-step**: tool `request_checkout` only shows confirm UI; placing calls `place_order` via a dedicated action (not a “typed yes”).

Evidence: `supabase/functions/rio/index.ts` (system prompt + `TOOLS` + HTTP actions).

---

## LLM provider switching

| Piece | Role |
|-------|------|
| Table `llm_config` | Rows for `groq` and `ollama`; exactly one `is_active` |
| RPC `activate_llm_config` | Admin flips active provider |
| `_shared/llm.ts` | Reads active config; calls provider API |
| Secrets | `GROQ_API_KEY`, optional `GROQ_MODEL`; `OLLAMA_BASE_URL` |

**Embeddings do not follow chat provider.** They always use Ollama `nomic-embed-text` (768 dimensions) so the `embeddings` index stays consistent (`_shared/embeddings.ts`, migration comments).

---

## System prompt (intent)

File: `rio/index.ts` constant `SYSTEM`.

Plain rules the model is told:

- Never invent restaurants, dishes, prices, or statuses — only tool results.  
- Prefer `retrieve_context` then `search_restaurants` for cravings.  
- Pass real food words into search; use `exclude_restaurant_ids` for “show more”.  
- Cart totals include delivery fee from tools.  
- `request_checkout` does not place; Confirm button does.  
- Complaints → `escalate_complaint`.

---

## Tools today (10 LLM tools)

| Tool | What it does | Main tables / RPCs | Bounds |
|------|----------------|--------------------|--------|
| `retrieve_context` | RAG over menu, ratings, order history | Ollama embed + `match_embeddings` | `top_k` ≤ 12; RPC match ≤ 20 |
| `search_restaurants` | Find kitchens/dishes by mood/query | `restaurant_browse`, `menu_items` | fetch ≤ 40; show ≤ 8 places |
| `get_menu` | Available menu for one restaurant | `menu_items` | ≤ 10 items |
| `view_cart` | Read cart | `cart_items` | ≤ 10 lines |
| `add_to_cart` | Add / increment item | `cart_items`, `menu_items` | cart read ≤ 20 |
| `update_cart_quantity` | Set qty; 0 removes | `cart_items` | one line |
| `request_checkout` | Show confirm card | cart read only | — |
| `track_order` | Latest orders or one id | `orders`, history | 1–3 orders; ≤ 5 history each |
| `check_delivery_status` | Focused status for one order | wraps `track_order` | one id |
| `escalate_complaint` | Open support ticket | `support_tickets` | one insert |

**Non-tool HTTP actions:** `replace_cart`, place-order confirm (`placeCustomerOrder` → `place_order`).

Code: `supabase/functions/rio/tools.ts`.

---

## RAG pipeline (as implemented)

```text
User query
  → embed with Ollama nomic-embed-text (768-d)
  → match_embeddings(query_vector, k, source_tables[])
  → filter / diversify chunks
  → return previews + meta to the LLM
```

**Sources backfilled for Assessment:** `menu_items`, `ratings`, `orders`, `order_items`, `order_status_history` (`scripts/backfill-embeddings.mjs`, `--source all`).

**Production retrieve (P4):** RIO `retrieve_context` requests **`menu_items` + `ratings` only**. `match_embeddings` never returns `delivery_address`; order-history sources only surface for the calling customer’s own rows (`20261006220000_match_embeddings_scope_pii.sql`).

**Your assessment (CONFIRMED):** a proper RAG is needed, but the **current corpus feels wrong / not trustworthy**. Treat today’s ≥5k vectors as **grader-oriented**, not production-quality retrieval. Redesign should decide:

- What is safe to embed (menus/reviews vs private orders)?  
- How to scope retrieval to the caller?  
- How to evaluate quality (`docs/rag/`, `npm run rag:eval`).

**Critical bug (fixed in P4):** Older `match_embeddings` could return other customers’ `delivery_address`. Mitigated by ownership filter + address strip + RIO menu/ratings-only retrieve (`20261006220000_match_embeddings_scope_pii.sql`).

---

## Limits & safety (today)

| Control | Present? |
|---------|----------|
| JWT required | Yes |
| RLS on cart/orders tools | Yes (user-scoped client) |
| Tool row limits | Yes (see table) |
| Tool result cache | `_toolCache.ts` for some reads |
| PII-safe RAG | **Yes (P4)** — address stripped; order sources owner-scoped; RIO uses menu/ratings |
| Rate limiting / abuse budget | Not documented in code |
| Multi-agent / planner / memory store | Not present — single chat loop |

---

## Agent architecture (direction for redesign)

You asked for a proper design. A solid target (proposal detail in Phase 3) looks like:

1. **Router / intent** — browse vs cart vs track vs complaint vs chitchat.  
2. **Grounded tools only** — menus/public ratings first; personal order tools second; never global order embeddings.  
3. **Confirm gates** — money moves only via explicit UI confirm (already partly true).  
4. **Observability** — log tool names, latency, empty retrievals (no PII).  
5. **Eval harness** — keep `rag:eval` but against a **clean, intentional** corpus.

Do not shrink tools just to hit the number “9”. Merge only if two tools share one job (e.g. `track_order` + `check_delivery_status`).

---

## Related files

| Path | Role |
|------|------|
| `supabase/functions/rio/index.ts` | Entry, prompt, tool schema, stream/JSON |
| `supabase/functions/rio/tools.ts` | Implementations |
| `supabase/functions/_shared/llm.ts` | Chat providers |
| `supabase/functions/_shared/embeddings.ts` | Embed + retrieve |
| `supabase/migrations/20260929140000_llm_config_and_embeddings.sql` | Tables |
| `supabase/migrations/20260929160000_intelligence_layer.sql` | First `match_embeddings` |
| `supabase/migrations/20261001120000_match_embeddings_order_history.sql` | Order history RAG + PII surface |
| `apps/client/src/screens/customer/RioScreen.tsx` | UI + cards |
| `apps/client/app/(customer)/(tabs)/assistant.tsx` | Route |
