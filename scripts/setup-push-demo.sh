#!/usr/bin/env bash
# One-shot ops setup for the FCM accept + delivered demo.
# Run from repo root after: supabase login
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env (need WEBHOOK_SECRET)"
  exit 1
fi

SECRET="$(grep '^WEBHOOK_SECRET=' .env | cut -d= -f2-)"
if [[ -z "$SECRET" ]]; then
  echo "WEBHOOK_SECRET missing in .env"
  exit 1
fi

export DO_NOT_TRACK=1

echo "→ Syncing WEBHOOK_SECRET to Edge Function secrets…"
supabase secrets set "WEBHOOK_SECRET=${SECRET}" --project-ref motqehtswgjbbvoazarh

echo "→ Deploying notify-new-order…"
supabase functions deploy notify-new-order --project-ref motqehtswgjbbvoazarh

echo
echo "→ Create / update Database Webhook (Dashboard) if not already:"
echo "   Table:  public.orders"
echo "   Events: UPDATE"
echo "   URL:    https://motqehtswgjbbvoazarh.supabase.co/functions/v1/notify-new-order"
echo "   Header: x-webhook-secret = (WEBHOOK_SECRET from .env)"
echo
echo "→ Probe tokens / online riders:"
echo "   npm run push:verify"
echo
echo "Done. Demo: manager sets order → preparing (customer+riders), then → delivered (customer)."
