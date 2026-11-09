-- P4: notification outbox. Writers enqueue; SMS/push keep dispatch_log for compat.

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  channel text not null check (channel in ('push', 'sms', 'in_app')),
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dedupe_key)
);

create index if not exists notification_jobs_status_idx
  on public.notification_jobs (status, created_at);

create index if not exists notification_jobs_order_idx
  on public.notification_jobs (order_id)
  where order_id is not null;

comment on table public.notification_jobs is
  'Outbound notification outbox (push / sms / in_app). Dedupe via dedupe_key.';

alter table public.notification_jobs enable row level security;

drop policy if exists "notification_jobs: admin reads" on public.notification_jobs;
create policy "notification_jobs: admin reads"
  on public.notification_jobs for select to authenticated
  using ( private.has_role('admin') );

grant select on public.notification_jobs to authenticated;
grant select, insert, update, delete on public.notification_jobs to service_role;

-- Enqueue helper: returns true when this caller won the dedupe race.
create or replace function public.enqueue_notification_job(
  p_user_id uuid,
  p_order_id uuid,
  p_channel text,
  p_template_key text,
  p_payload jsonb,
  p_dedupe_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted int;
begin
  if p_channel is null or p_channel not in ('push', 'sms', 'in_app') then
    raise exception 'Invalid notification channel.' using errcode = '22023';
  end if;
  if coalesce(trim(p_template_key), '') = '' then
    raise exception 'template_key is required.' using errcode = '22023';
  end if;
  if coalesce(trim(p_dedupe_key), '') = '' then
    raise exception 'dedupe_key is required.' using errcode = '22023';
  end if;

  insert into public.notification_jobs (
    user_id, order_id, channel, template_key, payload, dedupe_key, status
  )
  values (
    p_user_id,
    p_order_id,
    p_channel,
    trim(p_template_key),
    coalesce(p_payload, '{}'::jsonb),
    trim(p_dedupe_key),
    'pending'
  )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$$;

revoke all on function public.enqueue_notification_job(uuid, uuid, text, text, jsonb, text)
  from public, anon;
grant execute on function public.enqueue_notification_job(uuid, uuid, text, text, jsonb, text)
  to service_role;

create or replace function public.mark_notification_job(
  p_dedupe_key text,
  p_status text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('processing', 'sent', 'failed', 'skipped') then
    raise exception 'Invalid notification job status.' using errcode = '22023';
  end if;

  update public.notification_jobs
     set status = p_status,
         attempts = attempts + case when p_status in ('sent', 'failed', 'skipped') then 1 else 0 end,
         last_error = p_error,
         updated_at = now()
   where dedupe_key = trim(p_dedupe_key);
end;
$$;

revoke all on function public.mark_notification_job(text, text, text) from public, anon;
grant execute on function public.mark_notification_job(text, text, text) to service_role;
