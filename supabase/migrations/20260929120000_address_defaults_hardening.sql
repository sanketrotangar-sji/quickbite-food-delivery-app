-- Harden customer address defaults (idempotent).
-- Fixes load/save failures when set_default_customer_address was missing
-- or raced with the keep-default trigger.

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
     and is_default
     and id is distinct from p_address_id;

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

create or replace function public.ensure_customer_address_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text, 0));

    if not exists (
      select 1
        from public.customer_addresses
       where customer_id = new.customer_id
         and is_default
    ) then
      update public.customer_addresses
         set is_default = true
       where id = new.id;
    end if;

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

drop trigger if exists customer_addresses_keep_default on public.customer_addresses;
create trigger customer_addresses_keep_default
  after insert or delete on public.customer_addresses
  for each row execute function public.ensure_customer_address_default();

revoke all on function public.ensure_customer_address_default()
  from public, anon, authenticated;
