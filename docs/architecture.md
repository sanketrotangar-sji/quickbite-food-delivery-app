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

Everyone signs up as a **customer**. Extra roles are granted after approval (`user_roles`).

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
| `migrations/` | Schema, RLS, RPCs, grants, realtime |
| `functions/notify-new-order` | Webhook on new orders |
| `config.toml` | Local + function settings |

**One Supabase project** for all apps. Access control = RLS + RPCs, not separate databases.

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
