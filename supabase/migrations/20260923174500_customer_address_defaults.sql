-- Keep changing the selected/default customer address atomic. Directly
-- setting a second row true can otherwise trip the partial unique index.

create or replace function public.set_default_customer_address(p_address_id uuid)
returns public.customer_addresses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := (select auth.uid());
  v_row public.customer_addresses;
begin
  if v_customer is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  -- Serialize default changes for this customer across devices.
  perform pg_advisory_xact_lock(hashtextextended(v_customer::text, 0));

  perform 1
    from public.customer_addresses
   where id = p_address_id
     and customer_id = v_customer;

  if not found then
    raise exception 'ADDRESS_NOT_FOUND' using
      message = 'That saved address does not belong to you.',
      errcode = 'P0001';
  end if;

  update public.customer_addresses
     set is_default = false
   where customer_id = v_customer
     and is_default;

  update public.customer_addresses
     set is_default = true
   where id = p_address_id
     and customer_id = v_customer
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_default_customer_address(uuid) from public;
grant execute on function public.set_default_customer_address(uuid) to authenticated;

-- If the current default is removed, promote the oldest remaining address.
create or replace function public.ensure_customer_address_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));

    update public.customer_addresses
       set is_default = true
     where id = (
       select id
         from public.customer_addresses
        where customer_id = new.customer_id
          and not exists (
            select 1
              from public.customer_addresses current_default
             where current_default.customer_id = new.customer_id
               and current_default.is_default
          )
        order by created_at, id
        limit 1
     );

    return new;
  end if;

  if old.is_default then
    perform pg_advisory_xact_lock(hashtextextended(old.customer_id::text, 0));

    update public.customer_addresses
       set is_default = true
     where id = (
       select id
         from public.customer_addresses
        where customer_id = old.customer_id
          and is_default = false
        order by created_at, id
        limit 1
     );
  end if;

  return old;
end;
$$;

create trigger customer_addresses_keep_default
  after insert or delete on public.customer_addresses
  for each row execute function public.ensure_customer_address_default();

revoke all on function public.ensure_customer_address_default()
  from public, anon, authenticated;
