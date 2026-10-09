-- Phase D: admin audit log, force status, refund, ticket status RPC, restaurant ops RPC, capacity_threshold.
-- Rollback: drop RPCs/table/columns added here; restore prior ticket update policy from git.

-- ---------------------------------------------------------------------------
-- Kitchen capacity (manager dashboard + admin editor)
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists capacity_threshold integer not null default 8
    check (capacity_threshold between 1 and 50);

comment on column public.restaurants.capacity_threshold is
  'Preparing-order threshold for Quiet/Normal/Busy (default 8).';

-- ---------------------------------------------------------------------------
-- COD refund ledger fields on orders
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_note text;

comment on column public.orders.refunded_at is
  'When an admin marked a COD refund (no payment provider).';
comment on column public.orders.refund_note is
  'Admin note for COD refund.';

-- ---------------------------------------------------------------------------
-- Admin audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references public.profiles(id) on delete restrict,
  action     text not null check (char_length(trim(action)) > 0),
  order_id   uuid references public.orders(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_order_idx
  on public.admin_audit_log (order_id);

alter table public.admin_audit_log enable row level security;

drop policy if exists "admin_audit_log: admin reads" on public.admin_audit_log;
create policy "admin_audit_log: admin reads"
  on public.admin_audit_log for select to authenticated
  using ( private.has_role('admin') );

grant select on public.admin_audit_log to authenticated;
grant select, insert on public.admin_audit_log to service_role;

-- ---------------------------------------------------------------------------
-- Ticket status-only RPC (prevent rewriting order_id / customer_id)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status
)
returns public.support_tickets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.support_tickets;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can update tickets.' using errcode = '42501';
  end if;

  update public.support_tickets
     set status = p_status
   where id = p_ticket_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Ticket not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_id, action, order_id, payload)
  values (
    (select auth.uid()),
    'ticket_set_status',
    v_row.order_id,
    jsonb_build_object('ticket_id', v_row.id, 'status', p_status)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_set_ticket_status(uuid, public.ticket_status) from public, anon;
grant execute on function public.admin_set_ticket_status(uuid, public.ticket_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Force order status (any status; audited)
-- ---------------------------------------------------------------------------
create or replace function public.admin_force_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_note text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can force order status.' using errcode = '42501';
  end if;
  if v_note is null then
    raise exception 'A note is required.' using errcode = '22023';
  end if;

  update public.orders
     set status = p_status,
         updated_at = now(),
         delivered_at = case
           when p_status = 'delivered' then coalesce(delivered_at, now())
           else delivered_at
         end
   where id = p_order_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_id, action, order_id, restaurant_id, payload)
  values (
    (select auth.uid()),
    'force_order_status',
    v_row.id,
    v_row.restaurant_id,
    jsonb_build_object('status', p_status, 'note', v_note)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_force_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.admin_force_order_status(uuid, public.order_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- COD refund mark (audited; cancels order)
-- ---------------------------------------------------------------------------
create or replace function public.admin_mark_order_refunded(
  p_order_id uuid,
  p_note text
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can mark refunds.' using errcode = '42501';
  end if;
  if v_note is null then
    raise exception 'A refund note is required.' using errcode = '22023';
  end if;

  update public.orders
     set status = 'cancelled',
         refunded_at = now(),
         refund_note = v_note,
         updated_at = now()
   where id = p_order_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Order not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_id, action, order_id, restaurant_id, payload)
  values (
    (select auth.uid()),
    'mark_order_refunded',
    v_row.id,
    v_row.restaurant_id,
    jsonb_build_object('note', v_note, 'total_amount', v_row.total_amount)
  );

  return v_row;
end;
$$;

revoke all on function public.admin_mark_order_refunded(uuid, text) from public, anon;
grant execute on function public.admin_mark_order_refunded(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Column-scoped restaurant ops update
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_restaurant_ops(
  p_restaurant_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_address text default null,
  p_offer_percent integer default null,
  p_prep_minutes integer default null,
  p_capacity_threshold integer default null
)
returns public.restaurants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.restaurants;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can edit kitchen ops.' using errcode = '42501';
  end if;

  if p_offer_percent is not null and (p_offer_percent < 0 or p_offer_percent > 100) then
    raise exception 'offer_percent must be between 0 and 100.' using errcode = '22023';
  end if;
  if p_prep_minutes is not null and p_prep_minutes < 1 then
    raise exception 'prep_minutes must be at least 1.' using errcode = '22023';
  end if;
  if p_capacity_threshold is not null and (p_capacity_threshold < 1 or p_capacity_threshold > 50) then
    raise exception 'capacity_threshold must be between 1 and 50.' using errcode = '22023';
  end if;

  update public.restaurants
     set lat = coalesce(p_lat, lat),
         lng = coalesce(p_lng, lng),
         address = coalesce(nullif(trim(p_address), ''), address),
         offer_percent = coalesce(p_offer_percent, offer_percent),
         prep_minutes = coalesce(p_prep_minutes, prep_minutes),
         capacity_threshold = coalesce(p_capacity_threshold, capacity_threshold),
         updated_at = now()
   where id = p_restaurant_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Restaurant not found.' using errcode = 'P0002';
  end if;

  insert into public.admin_audit_log (actor_id, action, restaurant_id, payload)
  values (
    (select auth.uid()),
    'update_restaurant_ops',
    v_row.id,
    jsonb_build_object(
      'lat', v_row.lat,
      'lng', v_row.lng,
      'address', v_row.address,
      'offer_percent', v_row.offer_percent,
      'prep_minutes', v_row.prep_minutes,
      'capacity_threshold', v_row.capacity_threshold
    )
  );

  return v_row;
end;
$$;

revoke all on function public.admin_update_restaurant_ops(uuid, double precision, double precision, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_update_restaurant_ops(uuid, double precision, double precision, text, integer, integer, integer) to authenticated;
