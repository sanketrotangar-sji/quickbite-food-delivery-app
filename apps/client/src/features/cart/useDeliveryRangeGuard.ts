import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { toast } from 'sonner-native';

import type { HomeFeed } from '@quickbite/api/mobile/catalog';
import { useAddresses } from '@/features/addresses/hooks';
import { useDeliveryPoint } from '@/features/location/hooks';
import {
  assertWithinDeliveryRange,
  deliveryOriginFromAddress,
  DeliveryRangeError,
  NEAR_ME_MAX_KM,
} from '@/lib/delivery-range';
import { queryKeys } from '@/lib/query-keys';

type KitchenPin = {
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
};

/**
 * Browse adds check against the delivery point; checkout checks against the chosen address.
 * The server re-checks in place_order either way.
 */
export function useDeliveryRangeGuard(target: 'browse' | 'checkout' = 'browse') {
  const queryClient = useQueryClient();
  const { selected } = useAddresses();
  const { point } = useDeliveryPoint();
  const origin = target === 'checkout' ? deliveryOriginFromAddress(selected) : point;

  const resolveKitchen = useCallback(
    (restaurantId: string, fallback?: KitchenPin): KitchenPin => {
      const feeds = queryClient.getQueriesData<HomeFeed>({ queryKey: queryKeys.home.all });
      for (const [, feed] of feeds) {
        const place = feed?.places.find((row) => row.id === restaurantId);
        if (place) return { lat: place.lat, lng: place.lng, name: place.name };
      }
      return fallback ?? {};
    },
    [queryClient],
  );

  /** Inline check: null when deliverable (or unknown), otherwise the reason. */
  const rangeProblem = useCallback(
    (restaurantId: string, fallback?: KitchenPin): string | null => {
      try {
        assertWithinDeliveryRange(origin, resolveKitchen(restaurantId, fallback), NEAR_ME_MAX_KM);
        return null;
      } catch (error) {
        return error instanceof DeliveryRangeError ? error.message : 'This kitchen is outside our delivery range.';
      }
    },
    [origin, resolveKitchen],
  );

  const ensureDeliverable = useCallback(
    (restaurantId: string, fallback?: KitchenPin): boolean => {
      const message = rangeProblem(restaurantId, fallback);
      if (message == null) return true;
      if (!origin) {
        toast('Delivery address needed', {
          description: message,
          action: { label: 'Add address', onClick: () => router.push('/(customer)/addresses') },
        });
      } else {
        toast('Outside delivery range', {
          description: message,
          action: { label: 'Show nearby', onClick: () => router.push('/(customer)/(tabs)/picks') },
        });
      }
      return false;
    },
    [origin, rangeProblem],
  );

  return { ensureDeliverable, rangeProblem, origin, maxKm: NEAR_ME_MAX_KM };
}
