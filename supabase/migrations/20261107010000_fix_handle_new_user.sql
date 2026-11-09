-- Fix sign-up trigger after 20261104010000_drop_user_roles dropped public.user_roles.
-- Rollback: re-run 20260921133100_roles_and_applications.sql lines 254-281 (only if user_roles exists).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'phone',
    'customer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
