# QuickBite architecture

```text
┌──────────────────────────────┐  ┌─────────────────────┐
│  apps/manager                │  │  apps/client        │
│  admin, owner, and manager   │  │  customer (+ rider) │
└──────────────┬───────────────┘  └──────────┬──────────┘
               │                             │
               └──────────────┬──────────────┘
                              ▼
                   Supabase Auth · Postgres · RLS
```

## Roles

Everyone signs up as a **customer**. Extra roles are granted after approval via `private.grant_role`.

Authorization uses a **single** `profiles.role`. Grants **never downgrade** precedence:

`admin > restaurant_owner > restaurant_manager > rider > customer`

So an owner who accepts a manager invite stays `restaurant_owner`.

| Role | App | How they get it |
|------|-----|-----------------|
| `customer` | `apps/client` | Every signup (email/password or Google) |
| `rider` | `apps/client` deliveries | Apply in Settings; admin approves |
| `restaurant_owner` | `apps/manager` all branches | Apply in Settings; admin approves |
| `restaurant_manager` | `apps/manager` assigned branch | Owner email invite |
| `admin` | `apps/manager` `/admin` | SQL seed only |

Same account cannot order from / deliver / kitchen-handle its own restaurant (RPC guards).

## Backend (`/supabase`)

| Path | Purpose |
|------|---------|
| `migrations/` | Schema, RLS, RPCs, grants, realtime, intelligence automations |
| `functions/notify-new-order` | Orders UPDATE webhook → FCM on accept (`preparing`) + delivered |
| `functions/rio` | Customer ordering assistant (tools + RAG grounding) |
| `functions/_shared/llm.ts` | Chat via `llm_config` (Groq or Ollama) |
| `functions/_shared/embeddings.ts` | Always Ollama `nomic-embed-text` (768-d) |
| `config.toml` | Local + function settings |

**One Supabase project** for all apps. Access control = RLS + RPCs, not separate databases.

## Intelligence layer

| Piece | What it does |
|-------|----------------|
| `embeddings` + `match_embeddings` | Vector index over **menu items, rating comments, orders, order lines, and status history**; cosine retrieval for RIO |
| RIO tools `retrieve_context`, `check_delivery_status`, `escalate_complaint` | Ground answers in DB rows; open `support_tickets` with urgency heuristics |
| Auto rider assign | `BEFORE UPDATE` when status becomes `ready` and `rider_id` is null — nearest online rider |
| Kitchen-load alerts | `pg_cron` every 5 min → `run_kitchen_load_alerts()` bumps `eta_minutes` past threshold |
| `automation_events` / `automation_config` | Audit trail + tunables (threshold 8, bump 15 min, cooldown 30 min) |
| Offline classifier | `scripts/classify_menu_category.py` — embeddings → `menu_items.category` metrics under `docs/ml/` |

**RAG counts (Assessment 2):** domain seed ≥5k rows; embedding backfill `--source all` targets ≈5.6k vectors (menu + ratings + order history). See [`docs/rag/README.md`](./rag/README.md) and [`docs/seed-data-spec.md`](./seed-data-spec.md) §9.

Plain language: RIO must not invent dishes; riders are claimed when the bag is ready (not while cooking); ETA bumps when a kitchen is slammed so customers are not left guessing.

## Quality (Part 3)

| Layer | Location |
|-------|----------|
| Unit tests | Vitest — `apps/client`, `apps/manager`, `packages/shared` |
| Edge shared tests | Deno — `supabase/functions/_shared/*.test.ts` |
| Order happy path | `tests/integration/order-happy-path.mjs` (service role) |
| Web smoke | Playwright — `apps/manager/e2e/` |
| RAG eval | `docs/rag/eval-queries.json` + `npm run rag:eval` |

Run everything: `npm test` from the repo root (see [setup.md](./setup.md)).

## Frontends

Web dashboard (`apps/manager`, Vite):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Client (Expo):

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Sensitive keys (`service_role`, `WEBHOOK_SECRET`) stay in Supabase secrets / server only.

Nothing in `apps/client` outside `src/api/` calls `supabase-js`.

## Deploy targets

| App | Host | Root directory |
|------|------|----------------|
| Web (admin + restaurant, by `profiles.role`) | Vercel | `apps/manager` |
| Client (customer + rider) | Expo Go / EAS APK | `apps/client` (`com.sjinnovation.quickbite`) |
| DB / functions | Supabase | linked project |

One web app, `apps/manager`, serves every dashboard role from a single login. `admin` lands on `/admin`, owners and managers land on the kitchen, and everyone else lands on `/blocked`. Vercel root directory stays `apps/manager`.

Mobile APK: from `apps/client` run `eas init`, set `EXPO_PUBLIC_*` via EAS env, then `npm run build:apk`. See [`apps/client/README.md`](../apps/client/README.md).
