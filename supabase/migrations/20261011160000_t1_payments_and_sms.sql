-- A3-T1: Stripe test payment fields + SMS dispatch events for Twilio outbound.
-- Rollback:
--   alter table public.notification_dispatch_log drop constraint if exists notification_dispatch_log_event_check;
--   alter table public.notification_dispatch_log
--     add constraint notification_dispatch_log_event_check check (event in ('preparing', 'delivered'));
--   alter table public.orders drop column if exists payment_method;
--   alter table public.orders drop column if exists payment_status;
--   alter table public.orders drop column if exists stripe_payment_intent_id;
--   alter table public.orders drop column if exists stripe_checkout_session_id;
--   alter table public.orders drop column if exists paid_at;
--   alter table public.admin_audit_log alter column actor_id set not null; -- only if no null rows

-- ---------------------------------------------------------------------------
-- Order payment ledger (cash default; Stripe test path optional)
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'card')),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'refunded')),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists paid_at timestamptz;

create unique index if not exists orders_stripe_payment_intent_id_uidx
  on public.orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists orders_stripe_checkout_session_id_uidx
  on public.orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.orders.payment_method is
  'cash (COD default) or card (Stripe test checkout).';
comment on column public.orders.payment_status is
  'unpaid | paid | refunded. Card paid/refunded via stripe-webhook only.';
comment on column public.orders.stripe_payment_intent_id is
  'Stripe PaymentIntent id (test mode).';
comment on column public.orders.stripe_checkout_session_id is
  'Stripe Checkout Session id (test mode).';
comment on column public.orders.paid_at is
  'When Stripe marked the order paid (payment_intent.succeeded).';

-- System / webhook audit rows may have no human actor.
alter table public.admin_audit_log
  alter column actor_id drop not null;

comment on column public.admin_audit_log.actor_id is
  'Acting profile; null for system webhooks (e.g. Stripe).';

-- ---------------------------------------------------------------------------
-- SMS dedupe events (Twilio send-order-sms)
-- ---------------------------------------------------------------------------
alter table public.notification_dispatch_log
  drop constraint if exists notification_dispatch_log_event_check;

alter table public.notification_dispatch_log
  add constraint notification_dispatch_log_event_check
  check (event in (
    'preparing',
    'delivered',
    'sms_placed',
    'sms_ready',
    'sms_out_for_delivery',
    'sms_delivered'
  ));

comment on table public.notification_dispatch_log is
  'Dedupes order push/inbox (preparing, delivered) and SMS (sms_*) events.';
