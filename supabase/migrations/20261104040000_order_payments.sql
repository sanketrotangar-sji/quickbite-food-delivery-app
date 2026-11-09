-- P3: order_payments side table + dual-write from orders payment columns.
-- orders.payment_* / stripe_* remain compatibility mirrors (no drop).

create table if not exists public.order_payments (
  order_id uuid primary key references public.orders(id) on delete cascade,
  provider text not null default 'none'
    check (provider in ('none', 'stripe', 'cash')),
  method text not null default 'cash',
  status text not null default 'unpaid',
  paid_at timestamptz,
  refunded_at timestamptz,
  refund_note text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists order_payments_stripe_pi_idx
  on public.order_payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists order_payments_stripe_cs_idx
  on public.order_payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on table public.order_payments is
  'Payment / refund state for an order. Dual-written with orders.* mirrors.';

alter table public.order_payments enable row level security;

drop policy if exists "order_payments: customer reads own" on public.order_payments;
create policy "order_payments: customer reads own"
  on public.order_payments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = (select auth.uid())
    )
  );

drop policy if exists "order_payments: admin reads all" on public.order_payments;
create policy "order_payments: admin reads all"
  on public.order_payments for select to authenticated
  using ( private.has_role('admin') );

grant select on public.order_payments to authenticated;
grant select, insert, update, delete on public.order_payments to service_role;

-- Backfill from existing order columns.
insert into public.order_payments (
  order_id,
  provider,
  method,
  status,
  paid_at,
  refunded_at,
  refund_note,
  stripe_payment_intent_id,
  stripe_checkout_session_id
)
select
  o.id,
  case
    when o.stripe_payment_intent_id is not null
      or o.stripe_checkout_session_id is not null
      or o.payment_method = 'card' then 'stripe'
    when coalesce(o.payment_method, 'cash') = 'cash' then 'cash'
    else 'none'
  end,
  coalesce(nullif(trim(o.payment_method), ''), 'cash'),
  coalesce(nullif(trim(o.payment_status), ''), 'unpaid'),
  o.paid_at,
  o.refunded_at,
  o.refund_note,
  o.stripe_payment_intent_id,
  o.stripe_checkout_session_id
from public.orders o
on conflict (order_id) do nothing;

-- Keep order_payments in sync when orders payment columns change.
create or replace function private.sync_order_payments_from_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_payments (
    order_id,
    provider,
    method,
    status,
    paid_at,
    refunded_at,
    refund_note,
    stripe_payment_intent_id,
    stripe_checkout_session_id,
    updated_at
  )
  values (
    new.id,
    case
      when new.stripe_payment_intent_id is not null
        or new.stripe_checkout_session_id is not null
        or new.payment_method = 'card' then 'stripe'
      when coalesce(new.payment_method, 'cash') = 'cash' then 'cash'
      else 'none'
    end,
    coalesce(nullif(trim(new.payment_method), ''), 'cash'),
    coalesce(nullif(trim(new.payment_status), ''), 'unpaid'),
    new.paid_at,
    new.refunded_at,
    new.refund_note,
    new.stripe_payment_intent_id,
    new.stripe_checkout_session_id,
    now()
  )
  on conflict (order_id) do update set
    provider = excluded.provider,
    method = excluded.method,
    status = excluded.status,
    paid_at = excluded.paid_at,
    refunded_at = excluded.refunded_at,
    refund_note = excluded.refund_note,
    stripe_payment_intent_id = excluded.stripe_payment_intent_id,
    stripe_checkout_session_id = excluded.stripe_checkout_session_id,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists orders_sync_order_payments on public.orders;
create trigger orders_sync_order_payments
  after insert or update of
    payment_method,
    payment_status,
    paid_at,
    refunded_at,
    refund_note,
    stripe_payment_intent_id,
    stripe_checkout_session_id
  on public.orders
  for each row
  execute function private.sync_order_payments_from_orders();

revoke all on function private.sync_order_payments_from_orders() from public, anon, authenticated;
