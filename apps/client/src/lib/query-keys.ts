import type { BrowseFilters } from '@quickbite/api/mobile/catalog';

/**
 * Every React Query key in the app comes from here so invalidation stays exact.
 * `pk` is the rounded delivery point from `pointKey()`.
 */
export const queryKeys = {
  home: {
    all: ['home'] as const,
    feed: (pk: string) => ['home', 'feed', pk] as const,
  },
  places: {
    all: ['places'] as const,
    browse: (pk: string, filters: BrowseFilters) => ['places', 'browse', pk, filters] as const,
  },
  restaurant: {
    all: ['restaurant'] as const,
    detail: (id: string, pk: string) => ['restaurant', id, 'detail', pk] as const,
    ratings: (id: string) => ['restaurant', id, 'ratings'] as const,
    similar: (id: string) => ['restaurant', id, 'similar'] as const,
  },
  cart: {
    all: ['cart'] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: ['orders', 'list'] as const,
    active: ['orders', 'active'] as const,
    tracking: (id: string) => ['orders', 'tracking', id] as const,
  },
  favorites: {
    catalog: (ids: string) => ['favorites', 'catalog', ids] as const,
  },
  notifications: {
    mine: ['notifications', 'mine'] as const,
  },
  careers: {
    myApplications: ['careers', 'my-applications'] as const,
  },
  vision: {
    all: ['vision'] as const,
  },
  rider: {
    orders: ['rider', 'orders'] as const,
    history: ['rider', 'history'] as const,
    notices: ['rider', 'notices'] as const,
    rating: ['rider', 'rating'] as const,
  },
} as const;
