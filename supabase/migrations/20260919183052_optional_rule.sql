-- ------------------------------------------------------------
-- 4. optional: stamp delivered_at, clear the rider's live pin
-- ------------------------------------------------------------
create or replace function public.on_order_delivered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set delivered_at = now() where id = new.id;
  delete from public.rider_locations where order_id = new.id;
  return null;
end;
$$;

create trigger orders_on_delivered
  after update of status on public.orders
  for each row
  when (new.status = 'delivered' and old.status is distinct from 'delivered')
  execute function public.on_order_delivered();