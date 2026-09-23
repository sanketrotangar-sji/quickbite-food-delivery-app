-- Promote an existing QuickBite login to platform admin.
-- Run in the Supabase SQL editor as the database owner. Do not commit a real email.
-- profiles.role is the only authorization source. This overwrites that one value.

select private.grant_role(id, 'admin'::public.app_role)
from public.profiles
where email = '<ADMIN_EMAIL>';
