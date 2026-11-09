-- Security-definer overview counts for the admin dashboard so loadAdminSummary()
-- does not pull every profile, restaurant, and application row into the browser.
-- Rollback: drop function if exists public.admin_overview();

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_restaurants integer;
  v_owners integer;
  v_open integer;
  v_active_orders integer;
  v_apps jsonb;
  v_roles jsonb;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can read overview stats.' using errcode = '42501';
  end if;

  select
    count(*)::integer,
    count(distinct owner_id)::integer,
    count(*) filter (where is_open)::integer
  into v_restaurants, v_owners, v_open
  from public.restaurants;

  select coalesce(jsonb_object_agg(status::text, cnt), '{}'::jsonb)
  into v_apps
  from (
    select status, count(*)::integer as cnt
    from public.applications
    group by status
  ) s;

  select coalesce(jsonb_object_agg(role::text, cnt), '{}'::jsonb)
  into v_roles
  from (
    select role, count(*)::integer as cnt
    from public.profiles
    group by role
  ) r;

  select count(*)::integer
  into v_active_orders
  from public.orders
  where status in ('placed', 'preparing', 'ready');

  return jsonb_build_object(
    'restaurants', coalesce(v_restaurants, 0),
    'owners', coalesce(v_owners, 0),
    'open_restaurants', coalesce(v_open, 0),
    'applications_by_status', coalesce(v_apps, '{}'::jsonb),
    'profiles_by_role', coalesce(v_roles, '{}'::jsonb),
    'active_orders', coalesce(v_active_orders, 0)
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated, service_role;
