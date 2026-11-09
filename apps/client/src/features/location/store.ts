import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

export type GeoPoint = { latitude: number; longitude: number };

export type LocationSource = 'gps' | 'address' | 'search' | 'fallback';

export const MARGAO_FALLBACK = {
  point: { latitude: 15.2736, longitude: 73.9581 },
  label: 'Margao, Goa',
} as const;

type LocationState = {
  point: GeoPoint | null;
  label: string | null;
  source: LocationSource | null;
  addressId: string | null;
  setLocation: (input: { point: GeoPoint; label: string; source: LocationSource; addressId?: string | null }) => void;
  applyFallback: () => void;
};

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      point: null,
      label: null,
      source: null,
      addressId: null,
      setLocation: ({ point, label, source, addressId = null }) =>
        set({ point, label, source, addressId }),
      applyFallback: () =>
        set({
          point: { ...MARGAO_FALLBACK.point },
          label: MARGAO_FALLBACK.label,
          source: 'fallback',
          addressId: null,
        }),
    }),
    {
      name: 'qb.location',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ point, label, source, addressId }) => ({ point, label, source, addressId }),
    },
  ),
);

/** Rounded so tiny GPS jitter does not create new cache keys. */
export function pointKey(point: GeoPoint | null) {
  if (!point) return 'none';
  return `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`;
}
