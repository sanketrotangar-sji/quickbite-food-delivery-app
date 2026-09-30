# QuickBite Landing

Public marketing site — ecosystem front door for customers, restaurants, and delivery partners.

```bash
# from repo root
npm run landing          # http://localhost:5174
npm run build --workspace=landing
```

## CTAs

| Action | Target |
|--------|--------|
| Get the App / Download / store badges | `#download` — badges are **Coming soon** until store env vars are set |
| Dashboard Login | `VITE_DASHBOARD_URL` or `https://quickbite-nine-phi.vercel.app/login` |

Optional env (see `.env.example`):

- `VITE_DASHBOARD_URL`
- `VITE_APP_STORE_URL`
- `VITE_PLAY_STORE_URL`

Deploy as a separate Vercel project with root directory `apps/landing`.
