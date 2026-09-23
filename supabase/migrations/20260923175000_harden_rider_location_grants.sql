-- Supabase's default table grants can include TRUNCATE, REFERENCES, and
-- TRIGGER. Rider locations must be writable only through the validated RPC.

revoke all on table public.rider_locations from anon, authenticated;
grant select on table public.rider_locations to authenticated;
