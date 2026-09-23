-- Home offer cards: link each highlight to a restaurant for Order Now CTA.
alter table public.home_highlights
  add column if not exists restaurant_id uuid references public.restaurants (id) on delete set null,
  add column if not exists badge text,
  add column if not exists cta_label text;

create index if not exists home_highlights_restaurant_idx
  on public.home_highlights (restaurant_id)
  where restaurant_id is not null;

-- Refresh seed offers so the home carousel has three restaurant-linked cards.
delete from public.home_highlights;

insert into public.home_highlights (title, subtitle, image_url, kind, sort_order, badge, cta_label, restaurant_id)
select
  seed.title,
  seed.subtitle,
  seed.image_url,
  'offer',
  seed.sort_order,
  seed.badge,
  'Order Now',
  r.id
from (
  values
    (
      'Spice Villa feast',
      'North Indian favourites from Green Park',
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=1200&q=80',
      0,
      '20% OFF',
      'Spice Villa'
    ),
    (
      'Tandoori nights',
      'Smoky grills ready for pickup',
      'https://images.unsplash.com/photo-1606491956689-2ea866880067?w=1200&q=80',
      1,
      '15% OFF',
      'The Tandoori Kitchen'
    ),
    (
      'Crispy dosa hour',
      'South Indian stacks under 20 mins',
      'https://images.unsplash.com/photo-1630383249896-424e482df921?w=1200&q=80',
      2,
      'Free delivery',
      'Dosa Plaza'
    )
) as seed(title, subtitle, image_url, sort_order, badge, restaurant_name)
left join public.restaurants r on r.name = seed.restaurant_name;
