import type { FeedBanner, FeedCategory, FeedDish, PlaceCard } from '@quickbite/api/mobile/catalog';
import {
  categorySlug,
  POPULAR_CATEGORY_ID,
  type HomeCategory,
  type HomeDish,
  type HomeHighlight,
  type HomePlace,
} from '@/lib/home-catalog';

/** Map server cards to the shapes the existing home/explore components render. */
export function toHomePlace(card: PlaceCard): HomePlace {
  const cuisine = card.cuisine ?? 'Kitchen';
  return {
    id: card.id,
    name: card.name,
    cuisine,
    dishName: card.description ?? cuisine,
    rating: card.ratingAvg,
    ratingCount: card.ratingCount,
    imageUrl: card.imageUrl ?? '',
    address: card.address ?? '',
    isOpen: card.isOpen,
    opensAt: card.opensAt,
    veg: card.isPureVeg || (card.hasVeg && !card.hasNonVeg),
    hasNonVeg: card.hasNonVeg,
    categoryIds: cuisine
      .split(/[,/·]/)
      .map((part) => categorySlug(part))
      .filter(Boolean),
    offerPercent: card.offerPercent,
    prepMinutes: card.prepMinutes,
    lat: card.lat,
    lng: card.lng,
    distanceKm: card.distanceKm,
    etaMin: card.etaMin,
    etaMax: card.etaMax,
    costForTwo: card.costForTwo,
    inRange: card.inRange,
  };
}

export function toHomeDish(dish: FeedDish): HomeDish {
  return {
    id: dish.id,
    name: dish.name,
    restaurantName: dish.restaurantName,
    restaurantId: dish.restaurantId,
    category: dish.category ?? 'Popular',
    price: dish.price,
    imageUrl: dish.imageUrl ?? '',
    veg: dish.isVeg,
    discountPercent: dish.offerPercent ?? undefined,
  };
}

export function toHomeHighlight(banner: FeedBanner): HomeHighlight {
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle,
    imageUrl: banner.imageUrl,
    kind: banner.kind,
    restaurantId: banner.restaurantId,
    restaurantName: banner.restaurantName ?? '',
    badge: banner.badge,
    ctaLabel: banner.ctaLabel,
  };
}

export function toHomeCategories(categories: FeedCategory[], fallbackImage: string): HomeCategory[] {
  return [
    { id: POPULAR_CATEGORY_ID, label: 'Popular', imageUrl: fallbackImage },
    ...categories.map((category) => ({
      id: categorySlug(category.label),
      label: category.label,
      imageUrl: category.imageUrl ?? fallbackImage,
    })),
  ];
}
