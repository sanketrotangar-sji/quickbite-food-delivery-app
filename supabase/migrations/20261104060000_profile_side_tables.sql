-- P5: rider_profiles + customer_preferences. Dual-write with profiles columns.
-- Legacy profiles.is_online / vehicle_label / plate / rio_memory stay until a later drop.

create table if not exists public.rider_profiles (
  rider_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_label text,
  plate text,
  is_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rider_profiles is
  'Rider-specific fields. Dual-written with profiles.* compatibility columns.';

create table if not exists public.customer_preferences (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  rio_memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.customer_preferences is
  'Customer RIO prefs. Dual-written with profiles.rio_memory.';

alter table public.rider_profiles enable row level security;
alter table public.customer_preferences enable row level security;

drop policy if exists "rider_profiles: read own" on public.rider_profiles;
create policy "rider_profiles: read own"
  on public.rider_profiles for select to authenticated
  using ( rider_id = (select auth.uid()) or private.has_role('admin') );

drop policy if exists "customer_preferences: read own" on public.customer_preferences;
create policy "customer_preferences: read own"
  on public.customer_preferences for select to authenticated
  using ( customer_id = (select auth.uid()) or private.has_role('admin') );

grant select on public.rider_profiles to authenticated;
grant select on public.customer_preferences to authenticated;
grant select, insert, update, delete on public.rider_profiles to service_role;
grant select, insert, update, delete on public.customer_preferences to service_role;

insert into public.rider_profiles (rider_id, vehicle_label, plate, is_online)
select p.id, p.vehicle_label, p.plate, coalesce(p.is_online, false)
  from public.profiles p
 where p.role = 'rider'
on conflict (rider_id) do nothing;

insert into public.customer_preferences (customer_id, rio_memory)
select p.id, coalesce(p.rio_memory, '{}'::jsonb)
  from public.profiles p
 where p.role = 'customer'
on conflict (customer_id) do nothing;

-- Ensure rider row exists when role becomes rider (applications / grants).
create or replace function private.ensure_rider_profile(p_rider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.rider_profiles (rider_id, vehicle_label, plate, is_online)
  select p.id, p.vehicle_label, p.plate, coalesce(p.is_online, false)
    from public.profiles p
   where p.id = p_rider_id
  on conflict (rider_id) do nothing;
end;
$$;

create or replace function private.ensure_customer_preferences(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_preferences (customer_id, rio_memory)
  select p.id, coalesce(p.rio_memory, '{}'::jsonb)
    from public.profiles p
   where p.id = p_customer_id
  on conflict (customer_id) do nothing;
end;
$$;

revoke all on function private.ensure_rider_profile(uuid) from public, anon, authenticated;
revoke all on function private.ensure_customer_preferences(uuid) from public, anon, authenticated;

create or replace function private.grant_role(p_user_id uuid, p_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.app_role;
  v_next public.app_role;
begin
  select role into v_current from public.profiles where id = p_user_id;
  if not found then
    raise exception 'Profile not found for role grant.' using errcode = 'P0001';
  end if;

  if private.role_rank(p_role) >= private.role_rank(v_current) then
    v_next := p_role;
  else
    v_next := v_current;
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
     set role = v_next
   where id = p_user_id;

  if v_next = 'rider' then
    perform private.ensure_rider_profile(p_user_id);
  end if;
  if v_next = 'customer' then
    perform private.ensure_customer_preferences(p_user_id);
  end if;
end;
$$;

revoke execute on function private.grant_role(uuid, public.app_role)
  from public, anon, authenticated;

create or replace function public.rider_set_duty(p_is_online boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active int;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can change duty status.' using errcode = '42501';
  end if;

  if p_is_online is null then
    raise exception 'Duty status is required.' using errcode = '22023';
  end if;

  if p_is_online is false then
    select count(*)::int into v_active
      from public.orders
     where rider_id = v_uid
       and status in ('preparing', 'ready', 'out_for_delivery');
    if v_active > 0 then
      raise exception 'ACTIVE_DELIVERY' using
        message = 'Finish your active delivery before going off duty.',
        errcode = 'P0001';
    end if;
  end if;

  perform private.ensure_rider_profile(v_uid);

  update public.profiles
     set is_online = p_is_online
   where id = v_uid
     and role = 'rider';

  if not found then
    raise exception 'Rider profile not found.' using errcode = 'P0001';
  end if;

  update public.rider_profiles
     set is_online = p_is_online,
         updated_at = now()
   where rider_id = v_uid;

  return p_is_online;
end;
$$;

create or replace function public.rio_update_memory(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_next jsonb;
  v_diet text;
  v_spice text;
  v_budget numeric;
  v_notes text;
  v_cuisines jsonb;
  v_avoid jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'Memory patch must be a JSON object.' using errcode = '22023';
  end if;

  v_diet := nullif(lower(trim(coalesce(p_patch ->> 'diet', ''))), '');
  if v_diet is not null and v_diet not in ('veg', 'non_veg', 'any', 'eggetarian') then
    raise exception 'diet must be veg, non_veg, any, or eggetarian.' using errcode = '22023';
  end if;

  v_spice := nullif(lower(trim(coalesce(p_patch ->> 'spice', ''))), '');
  if v_spice is not null and v_spice not in ('mild', 'medium', 'spicy', 'any') then
    raise exception 'spice must be mild, medium, spicy, or any.' using errcode = '22023';
  end if;

  begin
    v_budget := nullif(trim(coalesce(p_patch ->> 'budget_max', '')), '')::numeric;
  exception when others then
    raise exception 'budget_max must be a number.' using errcode = '22023';
  end;
  if v_budget is not null and (v_budget < 50 or v_budget > 5000) then
    raise exception 'budget_max must be between 50 and 5000.' using errcode = '22023';
  end if;

  v_notes := nullif(trim(coalesce(p_patch ->> 'notes', '')), '');
  if v_notes is not null then
    v_notes := left(v_notes, 240);
  end if;

  if p_patch ? 'cuisines_like' then
    if jsonb_typeof(p_patch -> 'cuisines_like') is distinct from 'array' then
      raise exception 'cuisines_like must be an array of strings.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(to_jsonb(left(trim(x), 40))), '[]'::jsonb)
      into v_cuisines
      from (
        select value #>> '{}' as x
          from jsonb_array_elements(p_patch -> 'cuisines_like')
         limit 8
      ) s
     where nullif(trim(x), '') is not null;
  end if;

  if p_patch ? 'avoid' then
    if jsonb_typeof(p_patch -> 'avoid') is distinct from 'array' then
      raise exception 'avoid must be an array of strings.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(to_jsonb(left(trim(x), 40))), '[]'::jsonb)
      into v_avoid
      from (
        select value #>> '{}' as x
          from jsonb_array_elements(p_patch -> 'avoid')
         limit 8
      ) s
     where nullif(trim(x), '') is not null;
  end if;

  perform private.ensure_customer_preferences(v_uid);

  update public.profiles p
     set rio_memory = coalesce(p.rio_memory, '{}'::jsonb)
       || jsonb_strip_nulls(jsonb_build_object(
            'diet', v_diet,
            'spice', v_spice,
            'budget_max', v_budget,
            'notes', v_notes,
            'cuisines_like', v_cuisines,
            'avoid', v_avoid,
            'updated_at', to_jsonb(now())
          )),
         updated_at = now()
   where p.id = v_uid
   returning p.rio_memory into v_next;

  update public.customer_preferences
     set rio_memory = coalesce(v_next, '{}'::jsonb),
         updated_at = now()
   where customer_id = v_uid;

  return coalesce(v_next, '{}'::jsonb);
end;
$$;

revoke all on function public.rio_update_memory(jsonb) from public, anon;
grant execute on function public.rio_update_memory(jsonb) to authenticated;

-- Prefer side-table duty flag with profiles fallback (claim path).
create or replace function public.claim_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider    uuid := (select auth.uid());
  v_online   boolean;
  v_customer uuid;
  v_row      public.orders;
  v_default_pay numeric(10,2) := 45.00;
begin
  if v_rider is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if not private.has_role('rider') then
    raise exception 'Only riders can claim deliveries.' using errcode = '42501';
  end if;

  select coalesce(
           (select rp.is_online from public.rider_profiles rp where rp.rider_id = v_rider),
           (select p.is_online from public.profiles p where p.id = v_rider and p.role = 'rider')
         )
    into v_online;

  if v_online is not true then
    raise exception 'RIDER_OFFLINE' using
      message = 'Go online before claiming a delivery.',
      errcode = 'P0001';
  end if;

  select customer_id
    into v_customer
    from public.orders
   where id = p_order_id;

  if v_customer is null then
    raise exception 'Order not found.' using errcode = 'P0001';
  end if;

  if v_customer = v_rider then
    raise exception 'SELF_DELIVERY' using
      message = 'You cannot deliver an order you placed.',
      errcode = 'P0001';
  end if;

  update public.orders
     set rider_id = v_rider,
         rider_earning = coalesce(rider_earning, greatest(v_default_pay, round(delivery_fee * 0.6, 2)))
   where id = p_order_id
     and rider_id is null
     and status in ('preparing', 'ready')
     and customer_id is distinct from v_rider
  returning * into v_row;

  if v_row.id is null then
    raise exception 'ALREADY_CLAIMED' using
      message = 'This delivery is no longer available.',
      errcode = 'P0001';
  end if;

  return v_row;
end;
$$;
