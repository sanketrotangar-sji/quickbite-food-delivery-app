import { DELIVERY_MAX_KM } from '@quickbite/domain';
import type { BrowseFilters } from '@quickbite/api/mobile/catalog';
import { formatInr } from '@/constants/theme';
import type { HomeDish, HomePlace, DietFilter } from '@/lib/home-catalog';
import { filterHomeDishes, filterHomePlaces, POPULAR_CATEGORY_ID, VEG_CATEGORY_ID } from '@/lib/home-catalog';
import { placePresentation } from '@/lib/home-presentation';

export const OFFER_MIN_DISCOUNT = 15;
/** Explore “Near me” radius when address + kitchen coords exist. */
export const NEAR_ME_MAX_KM = DELIVERY_MAX_KM;

export type QuickFilter = 'all' | 'near' | 'veg' | 'fast' | 'offers' | 'top' | 'budget';

export type ExploreFilters = {
  diet: DietFilter;
  minRating: number;
  maxMinutes: number;
  maxPrice: number;
  maxDistanceKm: number;
  cuisineId: string;
  offersOnly: boolean;
};

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  diet: 'all',
  minRating: 0,
  maxMinutes: 0,
  maxPrice: 0,
  maxDistanceKm: NEAR_ME_MAX_KM,
  cuisineId: POPULAR_CATEGORY_ID,
  offersOnly: false,
};

export function exploreFilterCount(filters: ExploreFilters) {
  let count = 0;
  if (filters.diet !== 'all') count += 1;
  if (filters.minRating > 0) count += 1;
  if (filters.maxMinutes > 0) count += 1;
  if (filters.maxPrice > 0) count += 1;
  // Near me (8 km) is default — do not count it on the filter badge.
  if (filters.maxDistanceKm > 0 && filters.maxDistanceKm !== NEAR_ME_MAX_KM) count += 1;
  if (filters.offersOnly) count += 1;
  if (filters.cuisineId !== POPULAR_CATEGORY_ID && filters.cuisineId !== VEG_CATEGORY_ID) count += 1;
  return count;
}

export function applyQuickFilter(current: ExploreFilters, id: QuickFilter): ExploreFilters {
  const next: ExploreFilters = {
    ...current,
    diet: 'all',
    minRating: 0,
    maxMinutes: 0,
    maxPrice: 0,
    maxDistanceKm: 0,
    offersOnly: false,
  };
  if (id === 'near') next.maxDistanceKm = NEAR_ME_MAX_KM;
  if (id === 'veg') next.diet = 'veg';
  if (id === 'fast') next.maxMinutes = 30;
  if (id === 'offers') next.offersOnly = true;
  if (id === 'top') next.minRating = 4;
  if (id === 'budget') next.maxPrice = 200;
  return next;
}

export function quickFilterFrom(filters: ExploreFilters): QuickFilter | null {
  const active = [
    filters.diet !== 'all',
    filters.minRating > 0,
    filters.maxMinutes > 0,
    filters.maxPrice > 0,
    filters.maxDistanceKm > 0,
    filters.offersOnly,
  ].filter(Boolean).length;
  if (active === 0) return 'all';
  if (active !== 1) return null;
  if (filters.maxDistanceKm === NEAR_ME_MAX_KM) return 'near';
  if (filters.diet === 'veg') return 'veg';
  if (filters.maxMinutes === 30) return 'fast';
  if (filters.offersOnly) return 'offers';
  if (filters.minRating === 4) return 'top';
  if (filters.maxPrice === 200) return 'budget';
  return null;
}

export function formatPriceRange(prices: number[]) {
  if (prices.length === 0) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatInr(min);
  return `${formatInr(min)}–${formatInr(max)}`;
}

function categoryIdFor(filters: ExploreFilters) {
  if (filters.cuisineId === VEG_CATEGORY_ID) return POPULAR_CATEGORY_ID;
  return filters.cuisineId;
}

function dietFor(filters: ExploreFilters): DietFilter {
  if (filters.cuisineId === VEG_CATEGORY_ID) return 'veg';
  return filters.diet;
}

function placeMatchesExtras(place: HomePlace, dishes: HomeDish[], filters: ExploreFilters) {
  if (filters.offersOnly && placePresentation(place).discount < OFFER_MIN_DISCOUNT) return false;
  if (filters.minRating > 0 && (place.rating == null || place.rating < filters.minRating)) return false;
  if (filters.maxMinutes > 0 && placePresentation(place).minutesLow > filters.maxMinutes) return false;
  if (filters.maxDistanceKm > 0) {
    if (place.distanceKm == null || place.distanceKm > filters.maxDistanceKm) return false;
  }
  if (filters.maxPrice > 0) {
    const affordable = dishes.some((dish) => {
      if (dish.restaurantId !== place.id || dish.price > filters.maxPrice) return false;
      if (filters.diet === 'veg' && !dish.veg) return false;
      if (filters.diet === 'nonveg' && dish.veg) return false;
      return true;
    });
    if (!affordable) return false;
  }
  return true;
}

export function filterExplorePlaces(places: HomePlace[], dishes: HomeDish[], query: string, filters: ExploreFilters) {
  return filterHomePlaces(places, categoryIdFor(filters), query, dietFor(filters)).filter((place) =>
    placeMatchesExtras(place, dishes, filters),
  );
}

export function filterExploreDishes(dishes: HomeDish[], places: HomePlace[], query: string, filters: ExploreFilters) {
  const allowed = new Set(
    filterExplorePlaces(places, dishes, query, { ...filters, maxPrice: 0 }).map((place) => place.id),
  );
  const constrained =
    filters.minRating > 0 || filters.maxMinutes > 0 || filters.maxDistanceKm > 0 || filters.offersOnly;
  return filterHomeDishes(dishes, categoryIdFor(filters), query, dietFor(filters)).filter((dish) => {
    if (filters.maxPrice > 0 && dish.price > filters.maxPrice) return false;
    if (constrained && !allowed.has(dish.restaurantId)) return false;
    return true;
  });
}

/** Filters the browse RPC can apply server-side (veg, offers, rating, cuisine, search). */
export function toBrowseFilters(filters: ExploreFilters, query: string, cuisineLabel: string | null): BrowseFilters {
  const diet = dietFor(filters);
  return {
    cuisine: categoryIdFor(filters) === POPULAR_CATEGORY_ID ? null : cuisineLabel,
    vegOnly: diet === 'veg',
    offersOnly: filters.offersOnly,
    minRating: filters.minRating > 0 ? filters.minRating : null,
    query: query.trim() || null,
    sort: filters.minRating > 0 ? 'rating' : filters.maxMinutes > 0 ? 'eta' : filters.offersOnly ? 'offer' : 'relevance',
  };
}

/** What the server does not filter: ETA cap, distance cap, budget (cost for two), non-veg only. */
export function filterBrowsedPlaces(places: HomePlace[], filters: ExploreFilters) {
  return places.filter((place) => {
    if (dietFor(filters) === 'nonveg' && !place.hasNonVeg) return false;
    if (filters.maxMinutes > 0 && placePresentation(place).minutesLow > filters.maxMinutes) return false;
    if (filters.maxDistanceKm > 0 && place.distanceKm != null && place.distanceKm > filters.maxDistanceKm) return false;
    if (filters.maxPrice > 0 && place.costForTwo != null && place.costForTwo / 2 > filters.maxPrice) return false;
    return true;
  });
}
