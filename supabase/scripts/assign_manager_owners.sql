-- SQL editor only. Do NOT run casually on production.
-- Assigns restaurant ownership and grants restaurant_owner via private.grant_role
-- (never-downgrade precedence). Replace placeholders before executing.

-- First admin: supabase/scripts/seed_admin.sql
-- Restaurant owners: apply in the customer app; admin approves.
-- Branch managers: restaurant owner invites by email.

do $$
declare
  v_owner uuid;
begin
  select id into v_owner
  from public.profiles
  where email = '<OWNER_EMAIL>';

  if v_owner is null then
    raise exception 'No profile for <OWNER_EMAIL>';
  end if;

  update public.restaurants
     set owner_id = v_owner
   where name = '<RESTAURANT_NAME>';

  -- Prefer grant_role so profiles.role stays authoritative.
  perform private.grant_role(v_owner, 'restaurant_owner'::public.app_role);
end;
$$;
