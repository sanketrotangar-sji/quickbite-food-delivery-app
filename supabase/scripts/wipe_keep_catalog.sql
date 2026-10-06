-- QuickBite cloud wipe — KEEP catalog + RAG (Wave 0 / P7 custom)
--
-- KEEPS: restaurants, menu_items, embeddings, llm_config, automation_config, home_highlights
-- CLEARS: orders stack, carts, ratings, tickets, notifications, GPS, addresses, push, invites, applications
-- USERS: deletes auth.users not in keep_emails (owners of remaining restaurants auto-kept)
--
-- DO NOT RUN until backup is done and you explicitly approve.
-- Apply in Supabase SQL Editor (or psql) against the linked cloud project.
--
-- Keep list (approved):
--   admin@quickbite.test
--   managers (15) — see insert below
--   customers: aisha@, divya@
--   riders: anushka@, aparna@
--   + every restaurants.owner_id email

begin;

-- ---------------------------------------------------------------------------
-- 1) Transactional / noise data
-- ---------------------------------------------------------------------------
truncate table
  public.notification_dispatch_log,
  public.automation_events,
  public.support_tickets,
  public.notifications,
  public.ratings,
  public.order_status_history,
  public.order_items,
  public.orders,
  public.cart_items,
  public.rider_locations,
  public.customer_addresses,
  public.push_device_tokens,
  public.manager_invites,
  public.applications
cascade;

-- ---------------------------------------------------------------------------
-- 2) Keep emails
-- ---------------------------------------------------------------------------
create temporary table keep_emails (email text primary key);

insert into keep_emails (email) values
  ('admin@quickbite.test'),
  -- managers (active kitchen staff)
  ('nikhil@quickbite.test'),
  ('meera@quickbite.test'),
  ('aniket@quickbite.test'),
  ('vivek@quickbite.test'),
  ('anish@quickbite.test'),
  ('isha@quickbite.test'),
  ('rohan@quickbite.test'),
  ('diya@quickbite.test'),
  ('karan@quickbite.test'),
  ('ananya@quickbite.test'),
  ('anjali@quickbite.test'),
  ('ankita@quickbite.test'),
  ('ansh@quickbite.test'),
  ('anurag@quickbite.test'),
  ('anupam@quickbite.test'),
  -- customers
  ('aisha@quickbite.test'),
  ('divya@quickbite.test'),
  -- riders
  ('anushka@quickbite.test'),
  ('aparna@quickbite.test');

-- Every restaurant owner (required while kitchens remain)
insert into keep_emails (email)
select distinct lower(p.email)
from public.restaurants r
join public.profiles p on p.id = r.owner_id
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3) Drop users not kept (cascades profiles + orphaned memberships)
-- ---------------------------------------------------------------------------
delete from auth.users u
where lower(u.email) not in (select lower(email) from keep_emails);

commit;

-- ---------------------------------------------------------------------------
-- 4) Verify (run after commit)
-- ---------------------------------------------------------------------------
-- select role, count(*) from public.profiles group by 1 order by 1;
-- select count(*) as restaurants from public.restaurants;
-- select count(*) as menu_items from public.menu_items;
-- select count(*) as orders from public.orders;
-- select count(*) as embeddings from public.embeddings;
-- select email, role from public.profiles order by role, email;
