# Delivery quarantine (not runtime)

This folder is a **parking lot** for Assessment / tooling leftovers. The Expo app and manager **do not** import anything from here.

| Path | Keep? | Notes |
|------|-------|--------|
| `seed-data-generated/` | Yes if graders need Assessment corpus | Large JSON/CSV; regenerable via `npm run seed:generate` |
| `tmp/`, `tmp-supabase/` | Safe to delete locally | Temp copies |
| `manager-test-results/` | Safe to delete | Old Playwright output |
| `assignment2.md`, `REMAINING.md` | Optional | Notes only |

The folder is gitignored except this README. Prefer the small local seed at `supabase/seed.sql` (`@quickbite.demo`) for day-to-day `db reset`.

**Before a cloud wipe (P7):** take a Dashboard backup or `pg_dump` — see [`docs/12-environments.md`](../docs/12-environments.md#backups).
