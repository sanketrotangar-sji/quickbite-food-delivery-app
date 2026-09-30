# Setup — GitHub, Supabase, Lovable (manager), Expo (client)

## 0. Repo layout (this monorepo)

```text
QuickBite/
├── apps/
│   ├── manager/     # Lovable — restaurant manager
│   └── client/      # Expo Router — customer + rider
├── supabase/        # migrations, edge functions, config
├── packages/shared/ # optional shared types
├── docs/            # architecture, this setup guide
└── README.md
```

---

## 1. Push this repo to GitHub

If the remote is not set yet:

1. Create an empty GitHub repo (e.g. `quickbite` or `quickbite-food-delivery`).
2. Do **not** initialize it with a README (this repo already has one).
3. From the project root:

```bash
git remote add origin https://github.com/<your-org-or-user>/quickbite.git
git branch -M main
git add .
git status          # confirm .env is NOT listed
git commit -m "chore: monorepo structure for manager, client, and supabase"
git push -u origin main
```

**Hygiene**

- Never commit `.env` (only `.env.example`).
- Prefer commits scoped by area: `supabase: …`, `apps/manager: …`, `docs: …`.

---

## 2. Supabase ↔ this GitHub repo

You already use the **Supabase CLI** with a linked project. That is the main integration.

### A. CLI (required — source of truth for SQL)

```bash
# once per machine
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# apply migrations
supabase db push

# edge function
supabase secrets set WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase secrets set EXPO_ACCESS_TOKEN=<optional-expo-access-token>
supabase secrets set OPENROUTESERVICE_API_KEY=<openrouteservice-api-key>
# Optional: directions falls back to public OSRM when ORS is missing or rate-limited.
# RIO chat + RAG embeddings (Ollama must be reachable from the edge runtime)
supabase secrets set GROQ_API_KEY=<groq_api_key>
supabase secrets set OLLAMA_BASE_URL=<reachable-ollama-base-url>
supabase functions deploy notify-new-order
supabase functions deploy directions
supabase functions deploy rio
```

### Intelligence / RAG (after seed)

1. Install Ollama and pull embeddings: `ollama pull nomic-embed-text`
2. Apply migrations (includes `match_embeddings` for order history): `npm run db:push`
3. Backfill vectors (≥5k on full seed): `npm run embeddings:backfill -- --source all`
4. Smoke-test: `npm run intelligence:verify`
5. Optional offline classifier: see [`docs/ml/README.md`](./ml/README.md)
6. RAG eval report: `npm run rag:eval` → [`docs/rag/evaluation-report.md`](./rag/evaluation-report.md)

Cloud edge functions cannot reach `127.0.0.1` on your laptop — set `OLLAMA_BASE_URL` to a host the edge runtime can call. Local `supabase functions serve` can use `http://host.docker.internal:11434` (see `.env.example`).

Create a Database Webhook for `public.orders` with **UPDATE** events
(demo FCM only needs status transitions). Point it to
`https://<project-ref>.supabase.co/functions/v1/notify-new-order` and add an
`x-webhook-secret` header matching `WEBHOOK_SECRET`.

### Push demo (FCM) — accept + delivered only

`notify-new-order` sends OS pushes for **two** transitions:

| Transition | Who gets a push |
|------------|-----------------|
| `placed` → `preparing` (kitchen accept) | Customer + all **online** riders |
| any → `delivered` | Customer only |

Other statuses (`placed`, `ready`, `out_for_delivery`, cancel) do **not** send FCM in this demo build.

#### One-time setup

```bash
# from repo root — requires `supabase login` first
bash scripts/setup-push-demo.sh
# or manually:
supabase secrets set WEBHOOK_SECRET="$(grep '^WEBHOOK_SECRET=' .env | cut -d= -f2-)"
supabase functions deploy notify-new-order
```

Then Dashboard → **Database** → **Webhooks** → Create (if missing):

1. Table: `public.orders`
2. Events: **UPDATE** (and INSERT is fine too)
3. URL: `https://motqehtswgjbbvoazarh.supabase.co/functions/v1/notify-new-order`
4. HTTP header: `x-webhook-secret` = the **same** `WEBHOOK_SECRET` value from `.env`

If the Edge secret and the webhook header drift, function logs return **401 unauthorized** and no pushes fire. After `supabase secrets set WEBHOOK_SECRET=…`, update the webhook header to match.

Android devices must use the **EAS development/preview APK** (not Expo Go), with
FCM V1 service account uploaded via `eas credentials` and `GOOGLE_SERVICES_JSON`
set as an EAS file env (see `apps/client/README.md`).

#### Demo checklist

1. Customer signed into the APK → row in `push_device_tokens` (`enabled=true`)
2. Rider signed in, duty **online** → `profiles.is_online=true` + push token
3. Manager/owner: move order `placed` → `preparing` → customer + rider OS alerts
4. Complete the order to `delivered` → customer OS alert again
5. Edge Function logs for `notify-new-order` should show `pushMessages > 0`

Quick probe (lists tokens / online riders; optional invoke):

```bash
npm run push:verify
npm run push:verify -- --order <order-uuid>
```

Migrations in `supabase/migrations/` are versioned in GitHub. Pushing them with `db push` updates the cloud DB.


### B. Dashboard GitHub integration (optional)

Supabase can also connect GitHub for **branching / preview** features:

1. [Dashboard](https://supabase.com/dashboard) → your project  
2. **Project Settings** → **Integrations** → **GitHub**  
3. Authorize and select this repo  

Useful later; not required for the assignment if you use the CLI.

### C. Lovable ↔ Supabase (required for frontends)

In each Lovable project:

1. **Connect Supabase** (Cloud / Supabase icon)  
2. Authorize and select the **same** QuickBite project  
3. Prefer approving SQL in **this** repo’s migrations rather than letting Lovable drift the schema — keep `/supabase/migrations` as the source of truth  

Keys for the **manager** app (Settings → API):

- Project URL → `VITE_SUPABASE_URL`
- `anon` / publishable key → `VITE_SUPABASE_ANON_KEY`

Keys for the **Expo client**:

- Project URL → `EXPO_PUBLIC_SUPABASE_URL`
- `anon` / publishable key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- OpenRouteService key stays in the `directions` Edge Function secret; do not
  expose it as an `EXPO_PUBLIC_*` variable.

Remote notifications, MapLibre, and background rider location use native
modules. Test them with an EAS development or preview build, not Expo Go:

```bash
cd apps/client
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --environment preview
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --environment preview
npm run build:apk
```

---

## 3. Lovable ↔ GitHub (manager only)

Lovable syncs best to a GitHub repo. With a **monorepo**, keep generated UI under `apps/manager` so it never overwrites `supabase/` or the Expo client.

### Recommended flow

#### Manager (`apps/manager`)

1. [lovable.dev](https://lovable.dev) → New project → `quickbite-manager`
2. **GitHub**: connect account → link to **this** monorepo  
   - If Lovable asks for a path / subdirectory, set **`apps/manager`**
   - If it only syncs to repo root: after first sync, move files into `apps/manager/` and add a short note in the Lovable project that the canonical path is `apps/manager`
3. **Supabase**: connect the QuickBite project
4. Prompt for manager sidebar + pages (see `docs/requirements.md`)
5. Commit/push so GitHub shows code under `apps/manager/`

#### Client (`apps/client`)

Expo Router app — **not** Lovable. See [`apps/client/README.md`](../apps/client/README.md) and [`apps/client/REMAINING.md`](../apps/client/REMAINING.md).

### Protect the backend folder

Tell Lovable explicitly:

> Do not modify anything under `/supabase`. Database changes belong in migrations reviewed in GitHub.

Optional: [`LOVABLE.md`](../LOVABLE.md) is for the manager project only.

### Two hosts from one repo

1. [vercel.com](https://vercel.com) → Import the GitHub monorepo for **manager**
2. Root Directory = `apps/manager`
3. Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Client ships with EAS from `apps/client` (`EXPO_PUBLIC_*` keys)

---

## 4. How to run locally

### Prerequisites

- Docker (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Node 20+
- Accounts: Supabase, GitHub, Lovable, Vercel

### Backend (Supabase)

```bash
# from repo root
supabase start                 # local stack → Studio http://127.0.0.1:54323
supabase status                # print URL + anon + secret keys
supabase db reset              # optional: replay all migrations locally

# edge function (optional)
supabase functions serve notify-new-order --no-verify-jwt
```

Against **cloud** instead of local:

```bash
supabase db push
supabase functions deploy notify-new-order
supabase functions deploy directions
```

Use cloud URL + anon key in the apps’ `.env` when testing against production DB.

### Frontends

```bash
# Manager
cd apps/manager
cp ../../.env.example .env     # set VITE_SUPABASE_* keys
npm install
npm run dev

# Client (another terminal)
cd apps/client
cp .env.example .env           # set EXPO_PUBLIC_SUPABASE_* keys
npm install
npx expo start --dev-client
```

### Typical demo flow

1. `supabase start` **or** use cloud project  
2. Run `apps/manager` + `apps/client`  
3. Sign up three users (or set roles in `profiles`)  
4. Walk order: place → prepare → claim → deliver → rate  

---

## 5. Checklist for a clean GitHub

- [ ] Monorepo pushed; `.env` not in git  
- [ ] `supabase/migrations` up to date; `db push` applied on cloud  
- [ ] `notify-new-order` deployed; orders **UPDATE** webhook + `x-webhook-secret` set
- [ ] FCM demo verified: preparing → customer+riders; delivered → customer
- [ ] Expo FCM V1 credentials + `GOOGLE_SERVICES_JSON` configured on EAS
- [ ] OpenRouteService key configured as a Supabase Function secret
- [ ] Lovable manager → `apps/manager`  
- [ ] Expo client → `apps/client` (env + EAS development build)
- [ ] Both apps share one Supabase project  
- [ ] Supabase project region is **Mumbai (`ap-south-1`)** (US regions add ~200ms+ per round-trip from India)  
- [ ] Vercel: manager project, correct root directory + env vars  
- [ ] README explains architecture and how to run  

---

## 5b. Hosted Auth checklist (production)

`supabase/config.toml` is for **local** DX (confirmations off, short passwords). On the **hosted** Supabase project, set:

- [ ] **Confirm email** enabled (Auth → Providers / Email)
- [ ] Stronger **password policy** (min length ≥ 8; prefer letters+numbers)
- [ ] Sign-up **rate limits** / captcha if available on your plan
- [ ] Review redirect URLs for Expo (`quickbite://`) and manager Vercel origin
- [ ] Rotate `WEBHOOK_SECRET` periodically; store only in Edge Function secrets

### EAS env (client release / preview)

Local `.env` is **not** uploaded to EAS. Before `eas build`:

```bash
eas env:list
# Required for preview + production:
# EXPO_PUBLIC_SUPABASE_URL
# EXPO_PUBLIC_SUPABASE_ANON_KEY
```

Release builds log an error if these are missing (`supabaseConfigured === false`).

### Optimize Storage images (Free plan)

No Image Transformations required. From repo root with service role:

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
npm run images:optimize:dry   # list sizes
npm run images:optimize       # overwrite + write *.sm.webp thumbs
```

Never commit the service role key.

### Tests and RAG evaluation

From repo root after `npm install`:

```bash
npm test
```

| Phase | What it needs |
|-------|----------------|
| Vitest (client, manager, shared) | Nothing beyond `npm install` |
| Deno edge tests | Auto-uses `npx deno@2.1.4` if Deno is not on PATH |
| Integration happy path | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in root `.env` |
| Playwright | `cd apps/manager && npx playwright install chromium` (skipped gracefully if missing) |

RAG retrieval metrics (separate from `npm test`):

```bash
ollama pull nomic-embed-text
npm run embeddings:backfill -- --source menu_items
npm run embeddings:backfill -- --source ratings
npm run rag:eval
```

See [`docs/rag/README.md`](./rag/README.md) and the generated [`docs/rag/evaluation-report.md`](./rag/evaluation-report.md).

Playwright is **off by default** in `npm test`. After `npx playwright install chromium`, run `PLAYWRIGHT=1 npm run test:e2e`. Use `PLAYWRIGHT_SKIP=1` to force-skip.

---

## 6. Useful links

| Item | URL pattern |
|------|-------------|
| Supabase project | `https://supabase.com/dashboard/project/<ref>` |
| Database Webhooks | `…/integrations/webhooks/overview` |
| Edge Functions | `…/functions` |
| Function URL | `https://<ref>.supabase.co/functions/v1/notify-new-order` |
| Local Studio | `http://127.0.0.1:54323` |
| Local API | `http://127.0.0.1:54321` |
