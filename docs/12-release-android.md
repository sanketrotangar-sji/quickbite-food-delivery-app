# 12 — Android / EAS release checklist

Ship the Expo customer+rider app (`apps/client`) as an installable Android build. Prefer this doc for Assessment handoff; deeper notes live in [`apps/client/README.md`](../apps/client/README.md).

---

## Identity

| Setting | Value | Where |
|---------|--------|--------|
| Android package | `com.sjinnovation.quickbite` | `apps/client/app.json` → `expo.android.package` |
| iOS bundle (if used) | `com.sjinnovation.quickbite` | `expo.ios.bundleIdentifier` |
| EAS project | Linked via `eas.json` / Expo account | run builds from `apps/client` |

---

## EAS profiles (`apps/client/eas.json`)

| Profile | Android artifact | Use |
|---------|------------------|-----|
| `development` | **APK** + development client | Dev client, MapLibre/push that Expo Go cannot do |
| `preview` | **APK** (internal) | Stakeholder / Assessment installs |
| `production` | **AAB** (`app-bundle`) | Play Store |

```bash
cd apps/client
npx eas-cli login   # once
npx eas-cli build -p android --profile preview
# download APK from the Expo build page when finished
```

First Android build: let EAS generate a keystore unless you already have one.

---

## Required env (EAS — not local `.env`)

EAS builds **do not** read `apps/client/.env`. Set per environment (`development` / `preview` / `production`):

| Variable | Notes |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | Cloud project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key only — **never** service role |

Example:

```bash
cd apps/client
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://YOUR_REF.supabase.co" \
  --environment preview --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "your_anon_key" \
  --environment preview --visibility plaintext
```

Repeat for `production` when shipping store builds. See also [`12-environments.md`](./12-environments.md).

---

## FCM / `google-services.json`

Push (order accept / delivered) needs a **dev or preview APK**, not Expo Go.

1. Place `google-services.json` next to `app.json` (gitignored).
2. Upload as an EAS **file** env (disk alone is not enough on EAS workers):

```bash
cd apps/client
npx eas-cli env:create --name GOOGLE_SERVICES_JSON \
  --type file --value ./google-services.json \
  --environment preview --visibility sensitive
```

3. Upload FCM V1 service account via `eas credentials` when Expo prompts.
4. Optional: `EXPO_ACCESS_TOKEN` as a Supabase Edge secret so `notify-new-order` can talk to Expo Push.

Webhook + `WEBHOOK_SECRET` setup: [`setup.md`](./setup.md) (push demo section).

---

## Smoke checklist (after installing the APK)

- [ ] App opens; splash → auth
- [ ] **Login** with a real customer account (cloud)
- [ ] Home loads kitchens / dishes
- [ ] **Place order** from cart (address selected)
- [ ] Order appears in tracking / history
- [ ] **RIO**: send a message → logout → login → same cloud thread restores
- [ ] **Push** (if FCM configured): kitchen accept → customer notification; optional rider online + pool
- [ ] **Rider**: cannot go offline with an active assigned order; location gate before duty/claim
- [ ] **Rider earnings**: after deliver, Earnings tab shows `rider_earning` (+ tips/bonuses)
- [ ] Manager web can advance kitchen status for the same order; Performance shows real counts
- [ ] Admin: summary coherent; Applications approve; Restaurants Open/Close; AI Activate

If login works but pushes fail: check webhook secret match, `notification_dispatch_log`, and Expo push receipts — not the APK package id.

---

## Admin smoke (manager web, after wipe)

- [ ] Sign in as `admin@quickbite.test`
- [ ] Dashboard stats: restaurants / people non-zero; recent orders empty until first test order
- [ ] Applications: approve or reject one pending app
- [ ] Restaurants: Open/Close one kitchen
- [ ] Highlights: create or toggle active
- [ ] AI: Activate Groq or Ollama

---

## Related

- Environments / secrets: [`12-environments.md`](./12-environments.md)
- Client build notes: [`apps/client/README.md`](../apps/client/README.md)
- Setup / webhook: [`setup.md`](./setup.md)
- Catalog wipe (manual): [`supabase/scripts/wipe_keep_catalog.sql`](../supabase/scripts/wipe_keep_catalog.sql)
