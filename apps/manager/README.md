# `apps/manager` — Web dashboard

One login for platform admins and restaurant partners. `admin` lands on `/admin`. `restaurant_owner` and `restaurant_manager` land on the kitchen. Everyone else lands on `/blocked`.

## What belongs here

- Login / sign-up (email + Google)
- Restaurant dashboard, menu CRUD, incoming orders, order history, profile
- Supabase client using the **same** project as `apps/client`

## How code gets here (Lovable → GitHub)

1. Create a Lovable project: e.g. `quickbite-manager`.
2. In Lovable: **Connect Supabase** → pick the QuickBite project.
3. In Lovable: **Connect GitHub** → use this monorepo (see root `docs/setup.md`).
4. After sync, ensure generated files live under **`apps/manager/`** (not the repo root).
5. Env vars (Lovable / Vercel):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`

Google sign-in uses PKCE and redirects back to `window.location.origin`. Add that origin (for example `http://localhost:8080` locally, and the Vercel URL in production) under Supabase → Authentication → URL Configuration → Redirect URLs. Do not hardcode a production domain in the app.

Restaurant ownership is assigned in SQL (one owner per restaurant). Run [`supabase/scripts/assign_manager_owners.sql`](../../supabase/scripts/assign_manager_owners.sql) in the SQL editor after filling the email/name placeholders. There is no in-app onboarding yet.

## Local run (after Lovable code exists)

```bash
cd apps/manager
cp ../../.env.example .env   # fill URL + anon key
npm install
npm run dev
```

Deploy on **Vercel** with Root Directory = `apps/manager`.

## Do not

- Do not put SQL migrations here — they live in `/supabase/migrations`.
- Do not create a second Supabase project for this app.
