-- Home catalog: veg filter + platform offers/videos rail.
-- Categories stay derived from menu_items.category (no extra lookup table).
-- Distance / ETA / price-for-two stay out until restaurants have real geo.

alter table public.menu_items
  add column if not exists is_veg boolean not null default false;

create table if not exists public.home_highlights (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) > 0),
  subtitle    text,
  image_url   text not null check (length(trim(image_url)) > 0),
  kind        text not null check (kind in ('offer', 'video')),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists home_highlights_active_idx
  on public.home_highlights (is_active, sort_order);

alter table public.home_highlights enable row level security;

drop policy if exists "home_highlights: everyone reads active" on public.home_highlights;
create policy "home_highlights: everyone reads active"
  on public.home_highlights for select to authenticated
  using (is_active = true);

grant select on public.home_highlights to authenticated;

insert into public.home_highlights (title, subtitle, image_url, kind, sort_order)
select * from (
  values
    (
      '50% off first order',
      'Use WELCOME50 at checkout',
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&q=80',
      'offer',
      0
    ),
    (
      'Kitchen stories',
      'Watch tonight’s specials',
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&q=80',
      'video',
      1
    ),
    (
      'Monsoon bowls',
      'Free delivery above ₹249',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1200&q=80',
      'offer',
      2
    )
) as seed(title, subtitle, image_url, kind, sort_order)
where not exists (select 1 from public.home_highlights);
