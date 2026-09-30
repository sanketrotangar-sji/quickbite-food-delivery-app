# Generated seed data (review before push)

Produced by:

```bash
npm run seed:generate
# or: node scripts/generate-seed-data.mjs
```

| File | Purpose |
|------|---------|
| `seed-bundle.json` | Full dataset (auth users, kitchens, menu, orders, …) |
| `manifest.json` | Counts + `targets_ok` + sample logins |
| `auth-users.csv` | email / password / role for quick review |

**Auth rules**

- Email: `<name>@quickbite.test` (lowercase first name from helper list)
- Password: `sanket123` for every user
- Roles assigned in alphabetical name order: 1 admin → 12 owners → 7 managers → 20 riders → 140 customers

**Not in the bundle (by design)**

- `order_status_history` — importer must walk each order’s `status_path`
- `embeddings` — run backfill after load

**Do not push until you say so.** Import script:

```bash
# Get service_role from Supabase Dashboard → Project Settings → API
SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed:push
```

Skips seed admin (`aaditya@quickbite.test`); keeps your existing admin. All other `@quickbite.test` users use password `sanket123`.
