# QuickBite — delivery status (2026-10-01)

## Done

| Item | Status |
|------|--------|
| `supabase db push` | Applied `20260930220000_one_manager_one_restaurant` |
| Edge functions | Deployed `notify-new-order`, `directions`, `rio` |
| Image optimize | Ran `npm run images:optimize` on Storage bucket |
| Dashboard | Live at https://quickbite-nine-phi.vercel.app/ (Vercel check **success** on `cacc135`) |
| Cleanup | Moved noise into `_delivery_quarantine/` (not deleted) |
| Smoke | Order happy-path PASS; owner invite PASS; admin review RPC reachable |
| EAS preview env | `EXPO_PUBLIC_SUPABASE_URL` + `ANON_KEY` set; `GOOGLE_SERVICES_JSON` file env set |

## In progress

| Item | Status |
|------|--------|
| Final APK | EAS cloud preview build queued (free tier). Track: https://expo.dev/accounts/sanketrotangar-sji/projects/quickbite/builds |

Local APK builds failed on this machine (JDK 25 CMake / JDK 21 missing `javac`). Prefer the cloud EAS artifact.

```bash
cd apps/client
npx eas-cli build:list -p android --limit 5
# when Status=finished, download Application Archive URL
```

## Operator follow-ups (not blockers for handoff demo)

1. **`OPENROUTESERVICE_API_KEY`** — not in Supabase secrets; maps/directions need:
   ```bash
   supabase secrets set OPENROUTESERVICE_API_KEY=<key>
   supabase functions deploy directions
   ```
2. Hosted Auth checklist — confirm email / redirects for `quickbite://` + Vercel origin (`docs/setup.md` §5b).
3. Optional: deploy `apps/landing` as its own Vercel project.
4. After APK finishes, share the Expo download link for sideload.

## Quarantine (root `_delivery_quarantine/`)

Moved here instead of deleting: Playwright `test-results`, `REMAINING.md`, `tmp/`, seed CSV/bundle with demo passwords, assignment notes. Root `assets/` (README screenshots + `image.png`) stays in-repo — do not quarantine.

## Accepted gaps

Cash-only payments, Medium/Low polish, iOS.
