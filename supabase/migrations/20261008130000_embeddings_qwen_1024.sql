-- Curated RAG: switch embeddings from nomic 768-d to qwen3-embedding:0.6b 1024-d.
-- Prerequisite: DELETE FROM public.embeddings (or empty table) before applying —
-- pgvector cannot meaningfully cast existing 768 vectors to 1024.
--
-- Chat LLM (Groq / Ollama via llm_config) is unchanged.

-- Wipe first — old 768-d rows cannot cast into 1024-d space.
delete from public.embeddings;

drop index if exists public.embeddings_embedding_hnsw;

alter table public.embeddings drop column if exists embedding;
alter table public.embeddings
  add column embedding extensions.vector(1024) not null;

create index embeddings_embedding_hnsw
  on public.embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

drop function if exists public.match_embeddings(extensions.vector, integer, text[]);

create function public.match_embeddings(
  query_embedding extensions.vector(1024),
  match_count integer default 5,
  filter_source text[] default null
)
returns table (
  source_table text,
  source_id text,
  similarity double precision,
  preview text,
  meta jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if match_count is null or match_count < 1 then
    match_count := 5;
  end if;
  if match_count > 20 then
    match_count := 20;
  end if;

  return query
  with ranked as (
    select
      e.source_table,
      e.source_id,
      (1 - (e.embedding <=> query_embedding))::double precision as similarity
    from public.embeddings e
    where filter_source is null
       or e.source_table = any (filter_source)
    order by e.embedding <=> query_embedding
    limit greatest(match_count * 4, 20)
  )
  select
    r.source_table,
    r.source_id,
    r.similarity,
    case r.source_table
      when 'menu_items' then coalesce(
        nullif(trim(concat_ws(' · ', rest.name, mi.name, mi.category, mi.description)), ''),
        'menu item'
      )
      when 'ratings' then coalesce(nullif(trim(ra.comment), ''), 'rating')
      else r.source_table
    end as preview,
    case r.source_table
      when 'menu_items' then jsonb_build_object(
        'name', mi.name,
        'category', mi.category,
        'price', mi.price,
        'is_veg', mi.is_veg,
        'is_available', mi.is_available,
        'restaurant_id', mi.restaurant_id,
        'restaurant_name', rest.name,
        'cuisine', rest.cuisine
      )
      when 'ratings' then jsonb_build_object(
        'food_rating', ra.food_rating,
        'delivery_rating', ra.delivery_rating,
        'restaurant_id', ra.restaurant_id,
        'comment', ra.comment
      )
      else '{}'::jsonb
    end as meta
  from ranked r
  left join public.menu_items mi
    on r.source_table = 'menu_items' and mi.id::text = r.source_id
  left join public.restaurants rest
    on mi.restaurant_id = rest.id
  left join public.ratings ra
    on r.source_table = 'ratings' and ra.id::text = r.source_id
  where
    case r.source_table
      when 'menu_items' then mi.id is not null
      when 'ratings' then ra.id is not null and nullif(trim(ra.comment), '') is not null
      else false
    end
  order by r.similarity desc
  limit match_count;
end;
$$;

revoke all on function public.match_embeddings(extensions.vector, integer, text[]) from public;
grant execute on function public.match_embeddings(extensions.vector, integer, text[]) to authenticated, service_role;

comment on function public.match_embeddings is
  'Cosine RAG over curated embeddings (menu_items + ratings with comments). 1024-d qwen3-embedding:0.6b. Never returns delivery_address.';

comment on table public.embeddings is
  'RAG vectors for qwen3-embedding:0.6b (1024-d). Curated sources only: menu_items and comment ratings.';
