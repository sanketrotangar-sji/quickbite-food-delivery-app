-- RIO chat threads synced per customer (production readiness Wave 2).
-- Rollback: drop table public.rio_messages; drop table public.rio_threads;

create table if not exists public.rio_threads (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists rio_threads_customer_updated_idx
  on public.rio_threads (customer_id, updated_at desc);

create table if not exists public.rio_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.rio_threads(id) on delete cascade,
  role        text not null check (role in ('rio', 'you')),
  content     text not null,
  cards       jsonb,
  conflict    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists rio_messages_thread_created_idx
  on public.rio_messages (thread_id, created_at asc);

alter table public.rio_threads enable row level security;
alter table public.rio_messages enable row level security;

drop policy if exists "rio_threads: owner all" on public.rio_threads;
create policy "rio_threads: owner all"
  on public.rio_threads for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));

drop policy if exists "rio_messages: owner all" on public.rio_messages;
create policy "rio_messages: owner all"
  on public.rio_messages for all to authenticated
  using (
    exists (
      select 1 from public.rio_threads t
      where t.id = rio_messages.thread_id
        and t.customer_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.rio_threads t
      where t.id = rio_messages.thread_id
        and t.customer_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.rio_threads to authenticated;
grant select, insert, update, delete on public.rio_messages to authenticated;

comment on table public.rio_threads is 'Per-customer RIO chat threads (cloud sync).';
comment on table public.rio_messages is 'RIO thread messages; cards/conflict stored as jsonb.';
