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
supabase functions deploy notify-new-order
supabase functions deploy directions
```

Create a Database Webhook for `public.orders` with `INSERT` and `UPDATE`
events. Point it to
`https://<project-ref>.supabase.co/functions/v1/notify-new-order` and add an
`x-webhook-secret` header matching `WEBHOOK_SECRET`. Both events are required:
customer placement uses `INSERT`, while rider broadcasts and status pushes use
state transitions from `UPDATE`.

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
- [ ] `notify-new-order` deployed; INSERT + UPDATE webhook and secret set
- [ ] Expo push credentials configured; push tested on a physical dev build
- [ ] OpenRouteService key configured as a Supabase Function secret
- [ ] Lovable manager → `apps/manager`  
- [ ] Expo client → `apps/client` (env + EAS development build)
- [ ] Both apps share one Supabase project  
- [ ] Vercel: manager project, correct root directory + env vars  
- [ ] README explains architecture and how to run  

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
