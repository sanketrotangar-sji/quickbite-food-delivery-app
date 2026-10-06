-- P20: Auto-cancel orders left in 'placed' longer than configured minutes.
-- Mirrors kitchen-load alerts: config row + security definer RPC + pg_cron.
--
-- Rollback:
--   select cron.unschedule('quickbite-order-accept-timeout'); -- if pg_cron present
--   drop function if exists public.run_order_accept_timeout();
--   delete from public.automation_config where key = 'order_accept_timeout_minutes';

insert into public.automation_config (key, value)
values ('order_accept_timeout_minutes', '30'::jsonb)
on conflict (key) do nothing;

create or replace function public.run_order_accept_timeout()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timeout int := 30;
  v_order record;
  v_cancelled int := 0;
begin
  select coalesce((value #>> '{}')::int, 30)
    into v_timeout
  from public.automation_config
  where key = 'order_accept_timeout_minutes';

  if v_timeout is null or v_timeout < 1 then
    v_timeout := 30;
  end if;

  for v_order in
    select o.id, o.customer_id, o.restaurant_id, o.placed_at
    from public.orders o
    where o.status = 'placed'
      and o.placed_at < now() - make_interval(mins => v_timeout)
    for update skip locked
  loop
    update public.orders
       set status = 'cancelled'
     where id = v_order.id
       and status = 'placed';

    if not found then
      continue;
    end if;

    v_cancelled := v_cancelled + 1;

    insert into public.automation_events (kind, order_id, restaurant_id, payload)
    values (
      'order_accept_timeout',
      v_order.id,
      v_order.restaurant_id,
      jsonb_build_object(
        'reason', 'kitchen_did_not_accept_in_time',
        'timeout_minutes', v_timeout,
        'placed_at', v_order.placed_at
      )
    );

    insert into public.notifications (user_id, title, body)
    values (
      v_order.customer_id,
      'Order cancelled',
      format(
        'The restaurant did not accept your order within %s minutes, so QuickBite cancelled it. You can place a new order anytime.',
        v_timeout
      )
    );
  end loop;

  return jsonb_build_object(
    'cancelled', v_cancelled,
    'timeout_minutes', v_timeout
  );
end;
$$;

revoke all on function public.run_order_accept_timeout() from public;
grant execute on function public.run_order_accept_timeout() to service_role;

comment on function public.run_order_accept_timeout is
  'Cancels placed orders older than automation_config.order_accept_timeout_minutes (default 30).';

do $$
begin
  create extension if not exists pg_cron;

  if exists (select 1 from cron.job where jobname = 'quickbite-order-accept-timeout') then
    perform cron.unschedule('quickbite-order-accept-timeout');
  end if;

  perform cron.schedule(
    'quickbite-order-accept-timeout',
    '*/5 * * * *',
    $cron$select public.run_order_accept_timeout();$cron$
  );
exception
  when others then
    raise notice 'pg_cron not available or schedule failed: %', sqlerrm;
end
$$;
