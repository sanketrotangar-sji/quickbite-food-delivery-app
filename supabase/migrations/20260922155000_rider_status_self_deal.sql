-- rider_set_order_status: require the rider role, and block delivering your own order.
-- Status transitions are unchanged: ready -> out_for_delivery, out_for_delivery -> delivered,
-- and rider_id must still be the caller.
-- place_order, claim_delivery, and restaurant_set_order_status are not modified.

create or replace function public.rider_set_order_status(
  p_order_id uuid,
  p_status   public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.orders;
begin
  if not private.has_role('rider') then
    raise exception 'Only riders can update a delivery.' using errcode = '42501';
  end if;

  if p_status not in ('out_for_delivery', 'delivered') then
    raise exception 'A rider cannot set status %.', p_status using errcode = '22023';
  end if;

  select * into v_row from public.orders where id = p_order_id;

  if v_row.customer_id = (select auth.uid()) then
    raise exception 'You cannot deliver an order you placed.' using errcode = 'P0001';
  end if;

  update public.orders
     set status = p_status
   where id       = p_order_id
     and rider_id = (select auth.uid())
     and (
          (p_status = 'out_for_delivery' and status = 'ready')
       or (p_status = 'delivered'        and status = 'out_for_delivery')
     )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'INVALID_TRANSITION' using
      message = 'Not your delivery, or the order is not ready for that step.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;
