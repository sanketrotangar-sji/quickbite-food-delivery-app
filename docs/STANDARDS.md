# QuickBite — engineering standards

How we write code. Product law stays in [`REQUIREMENTS.md`](./REQUIREMENTS.md). Status stays in [`PROGRESS.md`](./PROGRESS.md).

Agents: start at [`AGENTS.md`](../AGENTS.md), then this file, then `.cursor/rules/`.

This is the **current** layout after the structure migration. **New code follows this.**

---

## 1. Laws

1. **SQL is the law.** Order status, fees, 8 km, roles live in RPCs. Apps call them. Apps do not `UPDATE` / `INSERT` / `DELETE` `orders` or `order_items`.
2. **One account = one `profiles.role`.** Never invent multi-role.
3. **Smallest change.** One job per change. Do not “improve” a neighbor file.
4. **Ask before** new/altered tables, columns, RLS, RPCs, cloud wipes, or deleting files.
5. **No service role in the browser.** Never put `SUPABASE_SERVICE_ROLE_KEY` in `EXPO_PUBLIC_*` or `VITE_*`.
6. **Migrations = schema / RPC / RLS / indexes only.** Demo rows go in `supabase/seed.sql` / `supabase/seeds/`.

---

## 2. Tree

```text
apps/
  client/          # Expo — customer + rider UI only (src/features/<name>/)
  manager/         # dashboard — kitchen + admin UI only (features/auth|kitchen|admin)
  landing/         # marketing only (also embedded on dashboard / for newcomers)

packages/
  domain/          # pure rules: statuses, fees, range, roles (@quickbite/domain)
  db/              # generated Supabase types once (@quickbite/db)
  api/             # RPC/view wrappers; apps call bindSupabase(client)
  shared/          # deprecated re-export of @quickbite/domain

supabase/
  migrations/
  functions/       # secrets, webhooks, RIO, vendors
    _shared/
  seed.sql         # base local seed
  seeds/goa_demo.sql  # Margao demo cast (@goa.quickbite.demo); runs after seed.sql

docs/              # REQUIREMENTS, STANDARDS, PROGRESS, PLAN, architecture
.cursor/rules/     # agents read
.cursor/hooks/     # agents cannot skip
```

Expo-only modules stay in the app (`api/auth.ts`, `api/payments.ts`, `api/supabaseClient.ts`).

### Schema evolution

- Prefer **side tables** for vendor/payment/role-extension state (`order_payments`, `notification_jobs`, `rider_profiles`, `customer_preferences`).
- **Dual-write** new tables with legacy compatibility columns on `orders` / `profiles` before dropping mirrors.
- Product browse uses `restaurant_browse` (excludes `is_synthetic`). Keep eval corpus in base tables; do not delete synthetic rows for RAG.
- Checkout discounts: only kitchen `offer_percent` + CRM campaigns (`private.resolve_checkout_offer`). Do not invent a third discount path in UI.

---

## 3. Feature shape (apps)

Every feature looks the same:

```text
features/<name>/
  api.ts           # calls packages/api (or today’s src/api)
  hooks.ts
  screens/
  components/
```

**Screens do not talk to Supabase.** No `.from(` / `.rpc(` / `functions.invoke(` in a screen or presentational component. That belongs in feature/`api` or `@quickbite/api`.

**RIO is not a second checkout.** Edge tools call the same place / cart / status RPCs. Do not invent a parallel order machine.

**One landing.** Marketing UI lives in `apps/landing`. Dashboard `/` embeds it for newcomers; logout goes to `/login`.

**One screen, one read.** Customer screens load through their screen RPC (`home_feed`, `browse_restaurants`, `restaurant_detail`, `order_tracking`). Lists are paged on the server (limit + cursor + filters); never fetch every restaurant and filter on the phone.

---

## 3a. Client UI (`apps/client`)

Use the library, not a hand-rolled copy:

| Need | Use | Not |
|------|-----|-----|
| Motion | `react-native-reanimated` (`ReduceMotion.System`) | `Animated` from `react-native` |
| Long / mixed lists | `@shopify/flash-list` | `FlatList`, `SectionList`, `ScrollView` + `.map` over data |
| Bottom sheets | `@/components/Sheet` (`@gorhom/bottom-sheet`) | custom `Modal` slide-ups |
| One-line feedback | `toast` from `sonner-native` | `Alert.alert` |
| Confirm / multi-button | `showDialog` from `@/lib/dialog` | `Alert` directly |
| Press feedback | `PressableScale` / `Button` (scale + optional haptic) | ad-hoc `pressed` opacity styles |
| Loading / error / empty | `QueryView` + `Skeleton` + `EmptyState`, copy from `errorCopy()` | spinners, raw `error.message` |
| Images | `RemoteImage` (branded placeholder on empty / failed URL) | raw `Image` with stock-photo fallbacks |

Tokens come from `@/constants/theme` (`colors`, `radii`, `type`, `motion`, `elevation`; source `@quickbite/domain` brand tokens). Text sizes use `AppText variant` (caption / meta / body / bodyLg / title / heading / display). No hex literals or literal `fontSize` in new screens.

`npm run lint` in `apps/client` enforces the banned imports and data-access imports in screens/components (errors) and warns on hex / `fontSize` literals.

## 3b. Client state

| Kind | Where |
|------|-------|
| Server data | React Query. Every key from `src/lib/query-keys.ts` (`queryKeys.*`) — no inline arrays |
| Device prefs (location, veg toggle, recent searches, login skipped, last role, hearts) | zustand `persist` on MMKV (`@/lib/storage`) — synchronous, no hydration flash |
| Session / profile | `AuthProvider` |
| Screen-local UI | `useState` |

- Location keys use `pointKey()` (3-decimal rounding) so tiny GPS drift does not refetch.
- Use `keepPreviousData` when filters or location change; prefetch Home on boot.
- Cart and order writes are optimistic with rollback.
- Realtime only while it matters: order channels while an order is active, rider channel only for riders.
- `onlineManager` follows NetInfo; queries pause offline and `QueryView` shows the offline state.

---

## 4. Third-party services

Secret, webhook, or “talks to the vendor” → **Edge function**.  
User-facing button → **feature UI**.  
Our backend call → **`packages/api`** (today: `src/api`).

| Piece | Lives here |
|-------|------------|
| Secret | Supabase Edge secrets — never `EXPO_PUBLIC_*` / `VITE_*` |
| Vendor SDK / signature verify | `supabase/functions/<job>/` |
| App call (JWT) | api wrapper → `functions.invoke(...)` |
| Screen | `features/<name>/screens/` |
| Result in our DB | RPC, or service-role write **inside Edge only** |

Do **not** put `stripe` / `twilio` (or similar) in Expo or Vite. Public-only SDKs (MapLibre, fonts) may live in the app. Public Sentry DSN is OK.

New vendor checklist: ask before schema → Edge function → api wrapper → feature UI → `.env.example` placeholder → verify inbound signatures.

---

## 5. Docs

| File | Job |
|------|-----|
| `docs/REQUIREMENTS.md` | Product, tables, RPCs, RLS |
| `docs/STANDARDS.md` | How we write code (this file) |
| `docs/PROGRESS.md` | Done / next / decisions |
| `docs/PLAN.md` | Backlog |
| `docs/architecture.md` | Diagrams |
| `README.md` | Pitch / setup |
| `AGENTS.md` | First stop for agents |
| `.cursor/rules/` | Always-on agent rules (product, architecture, UI, Ponytail) |
| `.cursor/skills/` | Ponytail skills: review, audit, debt, gain, help |

Do not add extra markdown novels. Assignment reports stay under `docs/dct/`, `docs/ml/`, `docs/rag-a3/`.

---

## 6. Hooks

| Layer | What it stops |
|-------|----------------|
| **Git pre-commit** | Committing `.env` / service-role leaking into apps |
| **Cursor `beforeShellExecution`** | Agent silently running destructive git / docker / db reset |
| **CI** | Real gate on push (`check:secrets`, unit, Edge) |

Cursor policy (encoded in `.cursor/hooks/`):

- **Deny:** force-push, `reset --hard`, `clean -fd`, `rm -rf`, docker prune / `down -v`, `supabase db reset`, writing `.env`, printing service-role, `git config`
- **Ask the human:** commit, push, checkout, docker compose, `db push`, functions deploy
- **Allow:** `git status` / `diff` / `log`, tests, search

`npm install` copies `.githooks/pre-commit` into `.git/hooks` (no `git config`). Do not skip git hooks (`--no-verify`) unless the human explicitly asked.
