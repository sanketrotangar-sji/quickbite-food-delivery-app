-- AI foundation: llm_config (chat provider switch) + generic embeddings (pgvector).
-- Embeddings stay pinned to Ollama nomic-embed-text (768-d) regardless of chat provider.
-- Default llm_config rows are operational bootstrap (not demo catalog).
-- Idempotent: safe to re-run after a partial apply that failed on vector(768).

create extension if not exists vector with schema extensions;

-- ------------------------------------------------------------
-- llm_config — which OpenAI-compatible chat backend is active
-- ------------------------------------------------------------
create table if not exists public.llm_config (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null check (provider in ('groq', 'ollama')),
  chat_model  text not null check (char_length(trim(chat_model)) > 0),
  is_active   boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- At most one active provider row.
create unique index if not exists llm_config_one_active
  on public.llm_config (is_active)
  where is_active;

create unique index if not exists llm_config_provider_unique
  on public.llm_config (provider);

drop trigger if exists llm_config_touch on public.llm_config;
create trigger llm_config_touch
  before update on public.llm_config
  for each row execute function public.touch_updated_at();

create or replace function public.llm_config_stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

drop trigger if exists llm_config_stamp_actor on public.llm_config;
create trigger llm_config_stamp_actor
  before insert or update on public.llm_config
  for each row execute function public.llm_config_stamp_actor();

alter table public.llm_config enable row level security;

drop policy if exists "llm_config: authenticated reads" on public.llm_config;
create policy "llm_config: authenticated reads"
  on public.llm_config for select to authenticated
  using ( true );

drop policy if exists "llm_config: admin inserts" on public.llm_config;
create policy "llm_config: admin inserts"
  on public.llm_config for insert to authenticated
  with check ( private.has_role('admin') );

drop policy if exists "llm_config: admin updates" on public.llm_config;
create policy "llm_config: admin updates"
  on public.llm_config for update to authenticated
  using ( private.has_role('admin') )
  with check ( private.has_role('admin') );

grant select on public.llm_config to authenticated;
grant insert, update on public.llm_config to authenticated;

-- Atomic activate: flip previous off, then target on (respects unique index).
create or replace function public.activate_llm_config(p_id uuid)
returns public.llm_config
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.llm_config;
begin
  if not private.has_role('admin') then
    raise exception 'Only QuickBite admins can switch the LLM provider.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.llm_config where id = p_id) then
    raise exception 'Unknown llm_config id.' using errcode = 'P0002';
  end if;

  update public.llm_config
     set is_active = false,
         updated_by = (select auth.uid())
   where is_active;

  update public.llm_config
     set is_active = true,
         updated_by = (select auth.uid())
   where id = p_id
   returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.activate_llm_config(uuid) from public;
grant execute on function public.activate_llm_config(uuid) to authenticated;

-- Bootstrap: Groq active (matches current RIO default), Ollama ready to switch.
insert into public.llm_config (provider, chat_model, is_active)
values
  ('groq', 'openai/gpt-oss-20b', true),
  ('ollama', 'llama3.2', false)
on conflict (provider) do nothing;

-- ------------------------------------------------------------
-- embeddings — generic RAG index across content types
-- ------------------------------------------------------------
create table if not exists public.embeddings (
  id            uuid primary key default gen_random_uuid(),
  source_table  text not null check (char_length(trim(source_table)) > 0),
  source_id     uuid not null,
  content_hash  text not null check (char_length(trim(content_hash)) > 0),
  -- nomic-embed-text outputs 768 dims; do not change without rebuilding the index.
  -- Type lives in extensions schema (not always on search_path during migrations).
  embedding     extensions.vector(768) not null,
  created_at    timestamptz not null default now(),
  unique (source_table, source_id)
);

create index if not exists embeddings_embedding_hnsw
  on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

-- No anon/authenticated policies: service role / backfill only until RAG RPCs land.
alter table public.embeddings enable row level security;

revoke all on public.embeddings from anon, authenticated;
grant all on public.embeddings to service_role;
