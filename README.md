# QuickBite

Food ordering & delivery (Swiggy/Zomato-style). Customers and riders use the phone app. Admins, owners, and restaurant managers share one web dashboard and land on different screens by role.

| Role | App |
|------|-----|
| Admin, owner, restaurant manager | [`apps/manager`](./apps/manager) (web dashboard) |
| Customer + rider | [`apps/client`](./apps/client) (Expo Router) |
| Auth, DB, RLS, functions | [`supabase`](./supabase) |

**Docs:** [Architecture](./docs/architecture.md) · [Setup & run](./docs/setup.md) · [Requirements](./docs/requirements.md) · [Client remaining slices](./apps/client/REMAINING.md)

---

## Repository structure

```text
QuickBite/
├── apps/
│   ├── manager/          # Web dashboard (admin + restaurant, by role)
│   └── client/           # Customer + rider Expo app
├── supabase/
│   ├── migrations/       # Schema, RLS, RPCs, grants
│   ├── functions/        # Edge Functions (e.g. notify-new-order)
│   └── config.toml
├── packages/
│   └── shared/           # Shared types / constants
├── docs/
├── .env.example
└── README.md
```

---

## Quick start

### 1. Backend

```bash
supabase start          # needs Docker
supabase status         # copy API URL + anon key
```

Or use the linked cloud project: `supabase db push`

### 2. Env

```bash
cp .env.example apps/manager/.env
cp apps/client/.env.example apps/client/.env
# Manager: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
# Client:  EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Frontends

```bash
cd apps/manager && npm install && npm run dev
cd apps/client  && npm install && npx expo start
```

Full GitHub / Lovable / Expo steps: **[docs/setup.md](./docs/setup.md)**.

---

## Scripts (root)

| Script | Purpose |
|--------|---------|
| `npm run supabase:start` | Local Supabase |
| `npm run db:push` | Push migrations to linked cloud DB |
| `npm run functions:serve` | Serve `notify-new-order` locally |
| `npm run functions:deploy` | Deploy edge function |
| `npm run types:client` | Regenerate Expo `database.ts` from the cloud schema |
| `npm run dashboard` | Start the web dashboard (`apps/manager`) |

---

## License / assignment

Intern assignment — SJ Innovation. See [`docs/requirements.md`](./docs/requirements.md).
