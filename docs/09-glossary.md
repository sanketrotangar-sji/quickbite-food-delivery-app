# 09 — Glossary

Plain-language definitions used across QuickBite docs. First time you see a bold term in other docs, it should match this list.

| Term | Meaning | Why you care |
|------|---------|--------------|
| **Anon key** | Public Supabase API key shipped in the app. | Safe to expose; does **not** bypass RLS. |
| **API layer** | Folders like `apps/client/src/api/` that talk to Supabase. | Keeps screens from inventing random queries. |
| **Auth** | Supabase login system (email/password, Google). | Creates `auth.users`; your trigger creates `profiles`. |
| **Check constraint** | DB rule on a column (e.g. price ≥ 0). | Stops bad data even if the app bugs. |
| **Composite primary key** | Two+ columns together identify a row (e.g. `user_id + role`). | No single `id` column on that table. |
| **Cron / pg_cron** | Scheduled SQL job inside Postgres. | Used for kitchen-load alerts. |
| **Cursor / pagination** | Loading the next page of results instead of everything. | Missing in several list UIs today. |
| **Deno** | JS runtime used by Supabase Edge Functions. | RIO and other functions run here. |
| **EAS** | Expo Application Services — cloud builds for Android/iOS. | How you produce APKs (`eas.json`). |
| **Edge function** | Small server program hosted by Supabase. | Holds secrets; can call LLM/maps APIs. |
| **Embedding** | A list of numbers representing text meaning. | Used for similarity search (RAG). |
| **Enum** | Fixed set of allowed strings in Postgres. | Order statuses cannot be random text. |
| **Expo Router** | File-based navigation for the mobile app. | Files under `apps/client/app/` become screens. |
| **FK (foreign key)** | Column pointing at another table’s id. | Keeps orders tied to real customers/restaurants. |
| **HNSW** | Fast index type for vector search. | Speeds up `match_embeddings`. |
| **Idempotent** | Safe to run twice with the same result. | Important for seed scripts and webhooks. |
| **JWT** | Signed login token. | Sent as `Authorization: Bearer …`; RLS uses it. |
| **Migration** | Numbered SQL file that changes the schema. | History of the database; don’t rewrite old ones. |
| **Monorepo** | One git repo with multiple apps. | This project. |
| **N+1 query** | Fetching a list, then one query per row. | Slow; look for loops of Supabase calls. |
| **OAuth / PKCE** | Secure Google sign-in flow. | Used by client and manager Google buttons. |
| **pgvector** | Postgres extension storing vectors. | Powers RAG. |
| **PK (primary key)** | Unique id for a row. | Usually `id` uuid. |
| **Policy** | One RLS rule (who can SELECT/INSERT/…). | Written in migrations. |
| **Quarantine folder** | `_delivery_quarantine/` — parked generated files, not runtime code. | Safe to ignore while coding features; see FAQ. |
| **RAG** | Retrieve docs/chunks, then ask the LLM. | RIO’s `retrieve_context`. |
| **Realtime** | Live push of DB changes to clients. | Kitchen board and tracking maps. |
| **RLS** | Row Level Security — per-row access rules. | Core of QuickBite security. |
| **RPC** | Remote Procedure Call — a Postgres function callable from the client. | `place_order`, status changes, etc. |
| **Security definer** | Function runs with owner privileges (can bypass RLS). | Must check permissions itself. |
| **Seed data** | Fake/demo rows for testing. | `@quickbite.test` users; large Assessment corpus. |
| **Service role key** | Secret key that **bypasses RLS**. | Scripts/edge only — never in Expo public env. |
| **Snapshot (order item)** | Copy of name/price at purchase time. | Menu edits don’t rewrite old orders. |
| **Trigger** | Automatic SQL on insert/update/delete. | History logging, cart rules, auto-assign. |
| **View** | Saved SELECT that looks like a table. | `restaurant_browse` hides sensitive columns. |
| **Webhook** | HTTP call when something happens (e.g. order update). | Feeds `notify-new-order`. |
| **Workspace** | npm feature linking `apps/*` and `packages/*`. | Root `package.json`. |

### Role words

| Product word | DB `app_role` |
|--------------|---------------|
| Customer | `customer` |
| Delivery rider | `rider` |
| Restaurant manager | `restaurant_manager` |
| Restaurant owner | `restaurant_owner` |
| Admin | `admin` |

### Order status words

`placed` → `preparing` → `ready` → `out_for_delivery` → `delivered` (or `cancelled` early).
