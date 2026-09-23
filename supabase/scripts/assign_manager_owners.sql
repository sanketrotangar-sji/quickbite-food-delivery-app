-- DEPRECATED: managers are no longer self-assigned on signup.
-- First admin: supabase/scripts/seed_admin.sql
-- Restaurant owners: apply in the customer app; admin approves.
-- Branch managers: restaurant owner invites by email.
--
-- Kept so existing environments can still one-shot-link a restaurant if needed.

update public.restaurants r
set owner_id = p.id
from public.profiles p
where p.email = '<OWNER_EMAIL>'
  and r.name = '<RESTAURANT_NAME>';

insert into public.user_roles (user_id, role)
select p.id, 'restaurant_owner'::public.app_role
from public.profiles p
where p.email = '<OWNER_EMAIL>'
on conflict do nothing;
