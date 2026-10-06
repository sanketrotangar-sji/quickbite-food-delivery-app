# 12 — Environments & migrations hygiene

How local Docker Supabase and cloud Supabase relate, which env files matter, and the rule that keeps schema history clean.

---

## Local vs cloud

| | **Local** (`supabase start`) | **Cloud** (linked project) |
|--|------------------------------|----------------------------|
| Purpose | Dev, `db reset`, seed demos, function serve | Real users / Assessment / staging you already use |
| Schema | Migrations under `supabase/migrations/` | Same files via `supabase db push` |
| Demo data | `supabase/seed.sql` runs on **`db reset` only** | **Not** applied by this batch — seed stays local until an explicit wipe (P7) |
| Source of truth for SQL | Migration files in git | Applied history on the project (must match git after push) |

- **`supabase db push`** — applies pending migrations to the **linked** (usually cloud) database. Does **not** run seed.
- **`supabase db reset`** — wipes **local** DB, re-applies all migrations, then runs `[db.seed]` → `./seed.sql` (`supabase/config.toml`).

Never treat Assessment cloud as a place to casually `db reset`.

---

## Env files (what goes where)

| File | Used by | Safe public vars | Never put here |
|------|---------|------------------|----------------|
| Repo root `.env` | CLI scripts, Edge secret sync helpers | Project URL for scripts | Commit secrets; prefer `.env.example` as the template |
| `apps/client/.env` | Expo | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Service role, webhook secrets, Groq keys |
| `apps/manager/.env` | Vite manager | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Service role (`VITE_*` is bundled to the browser) |
| `apps/landing/.env` | Landing site | Public site URL / anon if needed | Service role |
| Supabase Dashboard / `supabase secrets` | Edge functions | — | Store `WEBHOOK_SECRET`, `GROQ_API_KEY`, `OLLAMA_BASE_URL`, etc. as **function secrets**, not `EXPO_PUBLIC_*` / `VITE_*` |

**Hard rule:** never put the **service role** key in `EXPO_PUBLIC_*` or `VITE_*`. Those prefixes mean “shipped to every client.” Use anon + RLS (and Edge secrets for privileged jobs).

Templates: `.env.example`, `apps/client/.env.example`, `apps/manager/.env.example`.

A full **dev vs prod cloud project split** is optional later — this batch documents hygiene only; you can keep one cloud project until you explicitly create a second.

---

## Migrations as source of truth

1. **New migrations = schema / RPC / RLS / indexes only.** Do **not** add demo `INSERT` data in new migration files. Demo rows go in `supabase/seed.sql` (P8) for local reset.
2. **Never edit an already-applied migration** — add a new timestamped file.
3. Seed path is configured: `supabase/config.toml` → `[db.seed]` → `sql_paths = ["./seed.sql"]`.

See also [`03-database.md`](./03-database.md) and [`setup.md`](./setup.md).

---

## Quick commands

```bash
# Local stack + seed
supabase start
supabase db reset

# Cloud schema only (no seed)
supabase link --project-ref <ref>
supabase db push
```

---

## Backups

Do this **before** any destructive cloud work (P7 wipe) or major migration experiments.

1. **Supabase Dashboard** → Project Settings → Database → **Backups** (PITR / daily backups if your plan includes them). Restore from there if a wipe goes wrong.
2. **Manual dump** (optional extra safety):

```bash
# From a machine with DB password (Dashboard → Database → connection string)
pg_dump "$DATABASE_URL" --format=custom --file="quickbite-$(date +%Y%m%d).dump"
```

3. **Local Assessment artifacts** live under `_delivery_quarantine/` (gitignored except its README). Keep `seed-data-generated/` if graders still need the large corpus; delete `tmp*` anytime.

Quarantine details: [`_delivery_quarantine/README.md`](../_delivery_quarantine/README.md) and FAQ item 12 in [`10-faq-doubts.md`](./10-faq-doubts.md).
