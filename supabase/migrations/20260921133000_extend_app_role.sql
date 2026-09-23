-- New enum values cannot be used in the same transaction that adds them.
alter type public.app_role add value if not exists 'restaurant_owner';
alter type public.app_role add value if not exists 'admin';
