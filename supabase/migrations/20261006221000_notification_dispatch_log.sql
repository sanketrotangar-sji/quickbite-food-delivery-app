-- P5: Idempotent push/inbox dispatch log for order status notifications.
-- Edge notify-new-order claims a (order_id, event) row before fan-out so forged
-- webhook old_record cannot re-fire the same notification.
--
-- Rollback:
--   drop table if exists public.notification_dispatch_log;

create table if not exists public.notification_dispatch_log (
  order_id    uuid not null references public.orders(id) on delete cascade,
  event       text not null check (event in ('preparing', 'delivered')),
  created_at  timestamptz not null default now(),
  primary key (order_id, event)
);

create index if not exists notification_dispatch_log_created_idx
  on public.notification_dispatch_log (created_at desc);

alter table public.notification_dispatch_log enable row level security;

-- No authenticated policies: edge / service_role only.
revoke all on table public.notification_dispatch_log from anon, authenticated;
grant select, insert on table public.notification_dispatch_log to service_role;

comment on table public.notification_dispatch_log is
  'Dedupes order push/inbox events (preparing, delivered). Written by notify-new-order edge function.';
