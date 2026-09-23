-- Remote already recorded 20260921133000, so those enum values never landed.
-- New values must commit in their own migration before any statement uses them.
alter type public.app_role add value if not exists 'restaurant_owner';
alter type public.app_role add value if not exists 'admin';
