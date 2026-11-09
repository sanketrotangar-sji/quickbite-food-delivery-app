import { db } from '../supabase';
import { throwApiError } from '../errors';

export type GeoPoint = { latitude: number; longitude: number };

export type PlaceSort = 'relevance' | 'eta' | 'rating' | 'offer' | 'distance';

/** Restaurant card as returned by browse_restaurants / home_feed / restaurant_detail. */
export type PlaceCard = {
  id: string;
  name: string;
  cuisine: string | null;
  description: string | null;
  imageUrl: string | null;
  branchName: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  offerPercent: number | null;
  prepMinutes: number | null;
  costForTwo: number | null;
  isPureVeg: boolean;
  hasVeg: boolean;
  hasNonVeg: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  distanceKm: number | null;
  etaMin: number;
  etaMax: number;
  /** null when the caller sent no delivery point. */
  inRange: boolean | null;
};

export type FeedBanner = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  kind: 'offer' | 'video';
  restaurantId: string | null;
  restaurantName: string | null;
  badge: string;
  ctaLabel: string;
  endsAt: string | null;
};

export type FeedCategory = { label: string; count: number; imageUrl: string | null };

export type FeedDish = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isVeg: boolean;
  category: string | null;
  isBestseller: boolean;
  offerPercent: number | null;
};

export type HomeFeed = {
  banners: FeedBanner[];
  categories: FeedCategory[];
  popularDishes: FeedDish[];
  orderAgain: PlaceCard[];
  places: PlaceCard[];
  placesNextCursor: string | null;
  hasLocation: boolean;
};

export type BrowseFilters = {
  cuisine?: string | null;
  vegOnly?: boolean;
  offersOnly?: boolean;
  minRating?: number | null;
  openOnly?: boolean;
  query?: string | null;
  sort?: PlaceSort;
};

export type BrowsePage = { items: PlaceCard[]; nextCursor: string | null };

export type DetailMenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  is_bestseller: boolean;
  category: string | null;
};

export type MenuSection = { id: string; name: string; items: DetailMenuItem[] };

export type RestaurantDetail = {
  restaurant: PlaceCard;
  sections: MenuSection[];
  bestsellers: DetailMenuItem[];
};

type Row = Record<string, any>;

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapPlaceCard(row: Row): PlaceCard {
  return {
    id: row.id,
    name: row.name ?? '',
    cuisine: row.cuisine ?? null,
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    branchName: row.branch_name ?? null,
    address: row.address ?? null,
    lat: num(row.lat),
    lng: num(row.lng),
    isOpen: Boolean(row.is_open),
    opensAt: row.opens_at ?? null,
    closesAt: row.closes_at ?? null,
    offerPercent: num(row.offer_percent),
    prepMinutes: num(row.prep_minutes),
    costForTwo: num(row.cost_for_two),
    isPureVeg: Boolean(row.is_pure_veg),
    hasVeg: Boolean(row.has_veg),
    hasNonVeg: Boolean(row.has_nonveg),
    ratingAvg: num(row.rating_avg),
    ratingCount: num(row.rating_count) ?? 0,
    distanceKm: num(row.distance_km),
    etaMin: num(row.eta_min) ?? 30,
    etaMax: num(row.eta_max) ?? 40,
    inRange: row.in_range == null ? null : Boolean(row.in_range),
  };
}

function mapBanner(row: Row): FeedBanner {
  return {
    id: row.id,
    title: row.title ?? '',
    subtitle: row.subtitle ?? '',
    imageUrl: row.image_url,
    kind: row.kind === 'video' ? 'video' : 'offer',
    restaurantId: row.restaurant_id ?? null,
    restaurantName: row.restaurant_name ?? null,
    badge: row.badge ?? 'Offer',
    ctaLabel: row.cta_label ?? 'Order now',
    endsAt: row.ends_at ?? null,
  };
}

function mapDish(row: Row): FeedDish {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name ?? '',
    name: row.name ?? '',
    price: num(row.price) ?? 0,
    imageUrl: row.image_url ?? null,
    isVeg: Boolean(row.is_veg),
    category: row.category ?? null,
    isBestseller: Boolean(row.is_bestseller),
    offerPercent: num(row.offer_percent),
  };
}

function mapMenuItem(row: Row): DetailMenuItem {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name ?? '',
    description: row.description ?? null,
    price: num(row.price) ?? 0,
    image_url: row.image_url ?? null,
    is_veg: Boolean(row.is_veg),
    is_available: row.is_available !== false,
    is_bestseller: Boolean(row.is_bestseller),
    category: row.category ?? null,
  };
}

function originArgs(origin: GeoPoint | null | undefined) {
  return origin ? { p_lat: origin.latitude, p_lng: origin.longitude } : {};
}

export async function fetchHomeFeed(origin: GeoPoint | null): Promise<HomeFeed> {
  const { data, error } = await db().rpc('home_feed', originArgs(origin));
  if (error) throwApiError(error, 'Could not load restaurants near you.');
  const feed = (data ?? {}) as Row;
  return {
    banners: ((feed.banners ?? []) as Row[]).map(mapBanner),
    categories: ((feed.categories ?? []) as Row[]).map((row) => ({
      label: row.label ?? '',
      count: num(row.count) ?? 0,
      imageUrl: row.image_url ?? null,
    })),
    popularDishes: ((feed.popular_dishes ?? []) as Row[]).map(mapDish),
    orderAgain: ((feed.order_again ?? []) as Row[]).map(mapPlaceCard),
    places: ((feed.places ?? []) as Row[]).map(mapPlaceCard),
    placesNextCursor: (feed.places_next_cursor as string | null) ?? null,
    hasLocation: Boolean(feed.has_location),
  };
}

export async function browseRestaurants(input: {
  origin: GeoPoint | null;
  filters?: BrowseFilters;
  cursor?: string | null;
  limit?: number;
}): Promise<BrowsePage> {
  const f = input.filters ?? {};
  const { data, error } = await db().rpc('browse_restaurants', {
    ...originArgs(input.origin),
    p_cuisine: f.cuisine ?? undefined,
    p_veg_only: f.vegOnly ?? false,
    p_offers_only: f.offersOnly ?? false,
    p_min_rating: f.minRating ?? undefined,
    p_open_only: f.openOnly ?? false,
    p_query: f.query?.trim() || undefined,
    p_sort: f.sort ?? 'relevance',
    p_cursor: input.cursor ?? undefined,
    p_limit: input.limit ?? 20,
  });
  if (error) throwApiError(error, 'Could not load restaurants.');
  const page = (data ?? {}) as Row;
  return {
    items: ((page.items ?? []) as Row[]).map(mapPlaceCard),
    nextCursor: (page.next_cursor as string | null) ?? null,
  };
}

export async function fetchRestaurantDetail(
  id: string,
  origin: GeoPoint | null,
): Promise<RestaurantDetail | null> {
  const { data, error } = await db().rpc('restaurant_detail', { p_id: id, ...originArgs(origin) });
  if (error) throwApiError(error, 'Could not load this restaurant.');
  if (!data) return null;
  const detail = data as Row;
  return {
    restaurant: mapPlaceCard(detail.restaurant ?? {}),
    sections: ((detail.sections ?? []) as Row[]).map((section) => ({
      id: String(section.id),
      name: section.name ?? 'Menu',
      items: ((section.items ?? []) as Row[]).map(mapMenuItem),
    })),
    bestsellers: ((detail.bestsellers ?? []) as Row[]).map(mapMenuItem),
  };
}
