-- A3 T4 — additive RAG hybrid support (no drops of existing objects, no truncate).
-- Keeps public.match_embeddings unchanged for before/after comparison.
--
-- Adds:
--   menu_items.tags / canonical_key / is_synthetic
--   restaurants.is_synthetic
--   embeddings.content / metadata / fts (+ GIN FTS + trigram)
--   public.match_embeddings_hybrid(...) — vector + FTS + trigram fused with RRF
--
-- Filters: live menu_items.is_available / is_veg / category only (not metadata).
-- Does NOT recreate embeddings_embedding_hnsw or menu_items_restaurant_idx.

-- ---------------------------------------------------------------------------
-- pg_trgm — install if missing
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    create extension pg_trgm with schema extensions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- menu_items
-- ---------------------------------------------------------------------------
alter table public.menu_items
  add column if not exists tags text[] not null default '{}';

alter table public.menu_items
  add column if not exists canonical_key text;

alter table public.menu_items
  add column if not exists is_synthetic boolean not null default false;

create index if not exists menu_items_canonical_idx
  on public.menu_items (canonical_key);

-- ---------------------------------------------------------------------------
-- restaurants
-- ---------------------------------------------------------------------------
alter table public.restaurants
  add column if not exists is_synthetic boolean not null default false;

-- ---------------------------------------------------------------------------
-- embeddings — store the exact embedded string + backfill metadata
-- ---------------------------------------------------------------------------
alter table public.embeddings
  add column if not exists content text;

alter table public.embeddings
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Generated FTS document (simple config = no stemming surprises for dish names).
alter table public.embeddings
  add column if not exists fts tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

create index if not exists embeddings_fts_idx
  on public.embeddings using gin (fts);

-- Trigram index using whatever schema hosts pg_trgm (extensions or public).
do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  if v_schema is null then
    raise exception 'pg_trgm extension is not installed';
  end if;

  execute format(
    'create index if not exists embeddings_trgm_idx on public.embeddings using gin (content %I.gin_trgm_ops)',
    v_schema
  );
end;
$$;

-- Filters use live menu_items columns; metadata GIN is unused.
drop index if exists public.embeddings_metadata_gin_idx;

comment on column public.embeddings.content is
  'Exact string that was embedded. Null until re-backfill.';
comment on column public.embeddings.metadata is
  'Backfill hints: restaurant_id, category, is_veg, canonical_key, tags, is_available. Hybrid RPC filters live menu_items.';

-- ---------------------------------------------------------------------------
-- match_embeddings_hybrid — NEW RPC; old match_embeddings left intact
-- ---------------------------------------------------------------------------
create or replace function public.match_embeddings_hybrid(
  query_text text,
  query_embedding extensions.vector(1024),
  match_count integer default 10,
  filter_is_veg boolean default null,
  filter_category text default null
)
returns table (
  source_table text,
  source_id text,
  score double precision,
  vector_similarity double precision,
  content text
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_limit int;
  v_q text;
  v_tsquery tsquery;
begin
  v_q := nullif(trim(query_text), '');
  if v_q is null then
    return;
  end if;

  if match_count is null or match_count < 1 then
    v_limit := 10;
  elsif match_count > 20 then
    v_limit := 20;
  else
    v_limit := match_count;
  end if;

  -- OR terms so multi-word dish queries match any token.
  v_tsquery := replace(plainto_tsquery('simple', v_q)::text, '&', '|')::tsquery;

  perform set_config('pg_trgm.word_similarity_threshold', '0.3', true);

  return query
  with base as not materialized (
    select
      e.source_table,
      e.source_id,
      e.content,
      e.fts
    from public.embeddings e
    join public.menu_items mi
      on e.source_table = 'menu_items'
     and mi.id::text = e.source_id
    where mi.is_available is true
      and (filter_is_veg is null or mi.is_veg = filter_is_veg)
      and (
        filter_category is null
        or nullif(trim(filter_category), '') is null
        or lower(coalesce(mi.category, '')) = lower(trim(filter_category))
      )
  ),
  vec as (
    select
      b.source_table,
      b.source_id,
      b.content,
      row_number() over (order by e.embedding <=> query_embedding) as rn
    from base b
    join public.embeddings e
      on e.source_table = b.source_table
     and e.source_id = b.source_id
    order by e.embedding <=> query_embedding
    limit 50
  ),
  fts_hits as (
    select
      b.source_table,
      b.source_id,
      b.content,
      row_number() over (
        order by ts_rank_cd(b.fts, v_tsquery) desc, b.source_id
      ) as rn
    from base b
    where v_tsquery is not null
      and b.fts @@ v_tsquery
    order by ts_rank_cd(b.fts, v_tsquery) desc, b.source_id
    limit 50
  ),
  trgm_hits as (
    select
      b.source_table,
      b.source_id,
      b.content,
      row_number() over (
        order by word_similarity(v_q, coalesce(b.content, '')) desc, b.source_id
      ) as rn
    from base b
    where b.content is not null
      and v_q <% b.content
    order by word_similarity(v_q, coalesce(b.content, '')) desc, b.source_id
    limit 50
  ),
  candidates as (
    select v.source_table, v.source_id, v.content, v.rn, 'v'::text as channel
    from vec v
    union all
    select f.source_table, f.source_id, f.content, f.rn, 'f'::text as channel
    from fts_hits f
    union all
    select t.source_table, t.source_id, t.content, t.rn, 't'::text as channel
    from trgm_hits t
  ),
  fused as (
    select
      c.source_table,
      c.source_id,
      max(c.content) as content,
      sum(1.0 / (60.0 + c.rn))::double precision as score
    from candidates c
    group by c.source_table, c.source_id
  )
  select
    fused.source_table,
    fused.source_id,
    fused.score,
    (1 - (e.embedding <=> query_embedding))::double precision as vector_similarity,
    fused.content
  from fused
  join public.embeddings e
    on e.source_table = fused.source_table
   and e.source_id = fused.source_id
  order by fused.score desc, vector_similarity desc nulls last, fused.source_id
  limit v_limit;
end;
$$;

revoke all on function public.match_embeddings_hybrid(
  text, extensions.vector, integer, boolean, text
) from public;

grant execute on function public.match_embeddings_hybrid(
  text, extensions.vector, integer, boolean, text
) to authenticated, service_role;

comment on function public.match_embeddings_hybrid is
  'A3 hybrid RAG: top-50 vector + FTS + trigram, RRF k=60. Filters is_available/is_veg/category from live menu_items. Real cosine on every row. No addresses/PII.';
