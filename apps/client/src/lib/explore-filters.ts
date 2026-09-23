import { formatInr } from '@/constants/theme';
import type { HomeDish, HomePlace, DietFilter } from '@/lib/home-mock';
import { filterHomeDishes, filterHomePlaces, POPULAR_CATEGORY_ID, VEG_CATEGORY_ID } from '@/lib/home-mock';
import { placePresentation } from '@/lib/home-presentation';

export const OFFER_MIN_DISCOUNT = 25;

export type QuickFilter = 'all' | 'veg' | 'fast' | 'offers' | 'top' | 'budget';

export type ExploreFilters = {
  diet: DietFilter;
  minRating: number;
  maxMinutes: number;
  maxPrice: number;
  cuisineId: string;
  offersOnly: boolean;
};

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  diet: 'all',
  minRating: 0,
  maxMinutes: 0,
  maxPrice: 0,
  cuisineId: POPULAR_CATEGORY_ID,
  offersOnly: false,
};

export function exploreFilterCount(filters: ExploreFilters) {
  let count = 0;
  if (filters.diet !== 'all') count += 1;
  if (filters.minRating > 0) count += 1;
  if (filters.maxMinutes > 0) count += 1;
  if (filters.maxPrice > 0) count += 1;
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
    offersOnly: false,
  };
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
    filters.offersOnly,
  ].filter(Boolean).length;
  if (active === 0) return 'all';
  if (active !== 1) return null;
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
  const constrained = filters.minRating > 0 || filters.maxMinutes > 0 || filters.offersOnly;
  return filterHomeDishes(dishes, categoryIdFor(filters), query, dietFor(filters)).filter((dish) => {
    if (filters.maxPrice > 0 && dish.price > filters.maxPrice) return false;
    if (constrained && !allowed.has(dish.restaurantId)) return false;
    return true;
  });
}
