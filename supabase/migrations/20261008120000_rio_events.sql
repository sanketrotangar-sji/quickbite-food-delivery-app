-- Phase 7: per-turn RIO observability events.
-- Rollback: drop table public.rio_events;

create table if not exists public.rio_events (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null references public.profiles(id) on delete cascade,
  thread_id     uuid references public.rio_threads(id) on delete set null,
  provider      text,
  model         text,
  tools         text[] not null default '{}',
  latency_ms    integer,
  token_estimate integer,
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists rio_events_actor_created_idx
  on public.rio_events (actor_id, created_at desc);

alter table public.rio_events enable row level security;

drop policy if exists "rio_events: admin reads" on public.rio_events;
create policy "rio_events: admin reads"
  on public.rio_events for select to authenticated
  using ( private.has_role('admin') );

grant select on public.rio_events to authenticated;
grant select, insert on public.rio_events to service_role;

-- Authenticated users may insert their own event rows (edge uses user JWT).
drop policy if exists "rio_events: actor inserts own" on public.rio_events;
create policy "rio_events: actor inserts own"
  on public.rio_events for insert to authenticated
  with check ( actor_id = (select auth.uid()) );

grant insert on public.rio_events to authenticated;
