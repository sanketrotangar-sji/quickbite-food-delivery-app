-- Product rule: 1 active manager membership per user. Owners may still own many restaurants.

-- Keep earliest active membership per user; revoke extras.
with ranked as (
  select
    restaurant_id,
    user_id,
    row_number() over (partition by user_id order by created_at asc, restaurant_id asc) as rn
  from public.restaurant_members
  where status = 'active'
)
update public.restaurant_members m
   set status = 'revoked',
       updated_at = now()
  from ranked r
 where m.restaurant_id = r.restaurant_id
   and m.user_id = r.user_id
   and m.status = 'active'
   and r.rn > 1;

create unique index if not exists restaurant_members_one_active_user
  on public.restaurant_members (user_id)
  where status = 'active';

-- ------------------------------------------------------------
-- owner_invite_manager(): reject if email already manages another kitchen
-- ------------------------------------------------------------
create or replace function public.owner_invite_manager(
  p_restaurant_id uuid,
  p_email         text
)
returns public.manager_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_row   public.manager_invites;
  v_existing_user uuid;
  v_other_kitchen uuid;
begin
  if not private.owns_restaurant(p_restaurant_id) then
    raise exception 'Only the restaurant owner can invite managers.' using errcode = '42501';
  end if;

  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid email is required.' using errcode = '22023';
  end if;

  if v_email = lower((select email from public.profiles where id = (select auth.uid()))) then
    raise exception 'You cannot invite yourself.' using errcode = 'P0001';
  end if;

  select id into v_existing_user from public.profiles where lower(email) = v_email limit 1;
  if v_existing_user is not null then
    select m.restaurant_id into v_other_kitchen
      from public.restaurant_members m
     where m.user_id = v_existing_user
       and m.status = 'active'
       and m.restaurant_id is distinct from p_restaurant_id
     limit 1;
    if v_other_kitchen is not null then
      raise exception 'That person already manages another restaurant. Each manager can only run one kitchen.'
        using errcode = 'P0001';
    end if;
  end if;

  insert into public.manager_invites (restaurant_id, email, invited_by)
  values (p_restaurant_id, v_email, (select auth.uid()))
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'That email already has a pending invite for this branch.' using errcode = 'P0001';
end;
$$;

-- ------------------------------------------------------------
-- accept_manager_invite(): accept at most one kitchen; skip/revoke extras
-- ------------------------------------------------------------
create or replace function public.accept_manager_invite(p_invite_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
  v_inv   public.manager_invites;
  v_has_active boolean;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select email into v_email from public.profiles where id = v_user;

  select exists (
    select 1 from public.restaurant_members
     where user_id = v_user and status = 'active'
  ) into v_has_active;

  for v_inv in
    select *
    from public.manager_invites
    where status = 'pending'
      and email = lower(v_email)
      and (p_invite_id is null or id = p_invite_id)
    order by created_at asc
    for update
  loop
    if v_has_active or v_count > 0 then
      -- Already managing a kitchen: revoke leftover invites instead of multi-assigning.
      update public.manager_invites
         set status = 'revoked'
       where id = v_inv.id;
      continue;
    end if;

    begin
      insert into public.restaurant_members (restaurant_id, user_id, status)
      values (v_inv.restaurant_id, v_user, 'active')
      on conflict (restaurant_id, user_id) do update
        set status = 'active';
    exception
      when unique_violation then
        update public.manager_invites
           set status = 'revoked'
         where id = v_inv.id;
        continue;
    end;

    perform private.grant_role(v_user, 'restaurant_manager');

    update public.manager_invites
       set status = 'accepted', accepted_at = now()
     where id = v_inv.id;

    v_count := v_count + 1;
    v_has_active := true;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.owner_invite_manager(uuid, text) from public, anon;
revoke execute on function public.accept_manager_invite(uuid) from public, anon;
grant execute on function public.owner_invite_manager(uuid, text) to authenticated;
grant execute on function public.accept_manager_invite(uuid) to authenticated;
