-- RAG: support order history sources + text source_id (status history uses bigint ids).
-- Corpus targets after backfill: menu_items + ratings + orders + order_items + order_status_history ≥ 5k on seed.

-- Allow non-uuid source keys (order_status_history.id is bigint).
alter table public.embeddings
  alter column source_id type text using source_id::text;

-- CREATE OR REPLACE cannot change OUT/return row types (uuid → text). Drop first.
drop function if exists public.match_embeddings(extensions.vector, integer, text[]);

create function public.match_embeddings(
  query_embedding extensions.vector(768),
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
    limit match_count
  )
  select
    r.source_table,
    r.source_id,
    r.similarity,
    case r.source_table
      when 'menu_items' then coalesce(
        nullif(trim(concat_ws(' · ', mi.name, mi.category, mi.description)), ''),
        'menu item'
      )
      when 'ratings' then coalesce(nullif(trim(ra.comment), ''), format('Food rating %s/5', ra.food_rating))
      when 'orders' then coalesce(
        nullif(trim(concat_ws(
          ' · ',
          format('Order %s', left(replace(o.id::text, '-', ''), 6)),
          o.status::text,
          rest_o.name,
          o.delivery_address
        )), ''),
        'order'
      )
      when 'order_items' then coalesce(
        nullif(trim(concat_ws(
          ' · ',
          oi.item_name,
          format('x%s', oi.quantity),
          format('₹%s', oi.unit_price),
          rest_oi.name,
          o_oi.status::text
        )), ''),
        'order item'
      )
      when 'order_status_history' then coalesce(
        nullif(trim(concat_ws(
          ' · ',
          format('Status %s', osh.status::text),
          rest_osh.name,
          to_char(osh.changed_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
        )), ''),
        'status history'
      )
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
      when 'orders' then jsonb_build_object(
        'status', o.status,
        'restaurant_id', o.restaurant_id,
        'restaurant_name', rest_o.name,
        'total_amount', o.total_amount,
        'delivery_address', o.delivery_address,
        'placed_at', o.placed_at
      )
      when 'order_items' then jsonb_build_object(
        'item_name', oi.item_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'order_id', oi.order_id,
        'restaurant_id', o_oi.restaurant_id,
        'restaurant_name', rest_oi.name,
        'order_status', o_oi.status
      )
      when 'order_status_history' then jsonb_build_object(
        'status', osh.status,
        'changed_at', osh.changed_at,
        'order_id', osh.order_id,
        'restaurant_id', o_osh.restaurant_id,
        'restaurant_name', rest_osh.name
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
  left join public.orders o
    on r.source_table = 'orders' and o.id::text = r.source_id
  left join public.restaurants rest_o
    on o.restaurant_id = rest_o.id
  left join public.order_items oi
    on r.source_table = 'order_items' and oi.id::text = r.source_id
  left join public.orders o_oi
    on oi.order_id = o_oi.id
  left join public.restaurants rest_oi
    on o_oi.restaurant_id = rest_oi.id
  left join public.order_status_history osh
    on r.source_table = 'order_status_history' and osh.id::text = r.source_id
  left join public.orders o_osh
    on osh.order_id = o_osh.id
  left join public.restaurants rest_osh
    on o_osh.restaurant_id = rest_osh.id;
end;
$$;

revoke all on function public.match_embeddings(extensions.vector, integer, text[]) from public;
grant execute on function public.match_embeddings(extensions.vector, integer, text[]) to authenticated, service_role;

comment on function public.match_embeddings is
  'Cosine RAG over embeddings (menu_items, ratings, orders, order_items, order_status_history).';
