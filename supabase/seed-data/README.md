# Seed data

## Local demo seed (P8) — preferred

File: [`../seed.sql`](../seed.sql) (loaded by `supabase db reset` via `config.toml`).

| | |
|--|--|
| **Domain** | `*@quickbite.demo` |
| **Password** | `sanket123` (demo only) |
| **Marker** | Order notes / notification bodies contain `[SEED_DEMO]` |
| **Cloud** | **Do not apply** until wipe plan **P7** is approved |

### Logins

| Role | Email |
|------|-------|
| Admin | `admin@quickbite.demo` |
| Owner | `owner@quickbite.demo` |
| Manager | `manager@quickbite.demo` |
| Rider | `rider@quickbite.demo` |
| Customers | `customer1@quickbite.demo` … `customer3@quickbite.demo` |

### Reset locally

```bash
supabase start   # Docker required
supabase db reset
```

### Remove demo rows

```sql
delete from auth.users where email like '%@quickbite.demo';
```

## Assessment bulk seed (historical)

Generated JSON under `_delivery_quarantine/seed-data-generated/` and scripts:

- `npm run seed:generate`
- `npm run seed:push` (needs service role; **not** for casual cloud use)

See [`docs/seed-data-spec.md`](../../docs/seed-data-spec.md).
