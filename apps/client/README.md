# `apps/client` — Customer + Rider (Expo)

Managed **Expo Router** app. After login, routes branch on `profiles.role`.

| Role | Tabs |
|------|------|
| `customer` | Home · Cart · Orders · Profile |
| `rider` | Available · My Deliveries · History · Profile |
| `restaurant_manager` / `admin` | Blocked — use the web app (`apps/manager`) |

Drill-in screens (stack, not tabs): restaurant menu, checkout, saved
addresses, and live order tracking.

## Run

```bash
cd apps/client
cp .env.example .env
# set EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start --dev-client
```

Use an EAS development/preview build for push notifications, MapLibre, and
background rider tracking. Expo Go can still preview screens that do not load
those native modules, but it cannot validate the delivery flow.

Google OAuth: in Supabase Auth → URL configuration, add `quickbite://`, `quickbite://*`, and Expo Go `exp://**`. Enable the Google provider.

## Build an Android APK (EAS)

Config is ready: `android.package` = `com.sjinnovation.quickbite`, [`eas.json`](./eas.json) preview profile outputs an **APK**.

### 1. One-time Expo account + project

```bash
npm i -g eas-cli   # if needed
cd apps/client
eas login
eas init           # creates Expo project + writes projectId into app.json
```

Accept the defaults. Do not change the package name after you ship installs.

### 2. Set build-time env (required)

EAS does **not** use your local `.env`. Create preview (and production) vars:

```bash
cd apps/client

eas env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://motqehtswgjbbvoazarh.supabase.co \
  --environment preview --visibility plaintext

eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value '<your-anon-or-publishable-key>' \
  --environment preview --visibility plaintext

# Same for production when you build an AAB for Play Store:
eas env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://motqehtswgjbbvoazarh.supabase.co \
  --environment production --visibility plaintext

eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value '<your-anon-or-publishable-key>' \
  --environment production --visibility plaintext
```

Or set them in [expo.dev](https://expo.dev) → Project → Environment variables.

### 3. Build + download APK

```bash
cd apps/client
npm run build:apk
# same as: eas build -p android --profile preview
```

When the cloud build finishes, open the build page and download the `.apk`. Install on a phone (allow unknown sources). First Android build will ask EAS to generate a keystore — choose yes unless you already have one.

### 4. Google Auth on the APK

Standalone builds redirect to `quickbite://…` (not Expo Go’s `exp://…`). Keep in Supabase Redirect URLs:

```text
quickbite://
quickbite://*
```

Google Cloud authorized redirect stays:

```text
https://motqehtswgjbbvoazarh.supabase.co/auth/v1/callback
```

### Play Store later

```bash
npm run build:aab   # production profile → .aab
```

Then submit via Play Console (`eas submit` optional).

## Rules

- Nothing outside `src/api/` imports `supabase-js`.
- `src/types/database.ts` is generated — `npm run types:client` from the repo root. Do not hand-edit.
- Status colors/labels live in `src/constants/orderStatus.ts`.
- Never put `service_role` or `WEBHOOK_SECRET` in the mobile app.

## Slices

Slice 0 (auth + role routing) and Slice 1 (customer order loop) are in this folder. **Remaining work:** [REMAINING.md](./REMAINING.md).

## Do not

- Do not duplicate the database — share migrations in `/supabase`.
- Do not put `service_role` in the app. Anon / publishable key only.
- Do not deploy this app on Vercel — use Expo Go / EAS only.
