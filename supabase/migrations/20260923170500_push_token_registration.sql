-- Device tokens can outlive an auth session on a shared/reused device.
-- Register through an RPC so a token can be safely reassigned to the current
-- user without granting cross-user table updates to clients.

create or replace function public.register_push_device(
  p_token    text,
  p_platform text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.push_device_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_row  public.push_device_tokens;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  if p_platform not in ('ios', 'android')
     or coalesce(trim(p_token), '') = ''
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'Invalid push device.' using errcode = '22023';
  end if;

  insert into public.push_device_tokens (
    user_id, token, platform, metadata, enabled, last_seen_at
  )
  values (
    v_user, trim(p_token), p_platform, coalesce(p_metadata, '{}'::jsonb), true, now()
  )
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        metadata = excluded.metadata,
        enabled = true,
        last_seen_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.register_push_device(text, text, jsonb) from public;
grant execute on function public.register_push_device(text, text, jsonb) to authenticated;
