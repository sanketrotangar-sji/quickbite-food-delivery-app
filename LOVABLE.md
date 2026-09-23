# Lovable projects for this monorepo

| Lovable project (suggested name) | GitHub path | Supabase |
|----------------------------------|-------------|----------|
| `quickbite-manager` | `apps/manager` | Same QuickBite project |

`apps/client` is **Expo**, not Lovable. Do not point a Lovable project at that folder.

## Rules for prompts (manager)

1. Connect **Supabase** before building data screens.
2. Connect **GitHub** to this monorepo; keep output under `apps/manager`.
3. **Never** edit `/supabase` from Lovable — migrations are reviewed in GitHub.
4. This app serves `admin`, `restaurant_owner`, and `restaurant_manager`. Role routing is already in the app; do not add a second login.
5. Browser env: only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

See [docs/setup.md](./docs/setup.md) for step-by-step wiring.
