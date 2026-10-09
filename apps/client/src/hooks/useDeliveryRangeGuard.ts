import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import { useAddresses } from '@/hooks/useAddresses';
import { useHomeCatalog } from '@/hooks/useHomeCatalog';
import {
  assertWithinDeliveryRange,
  deliveryOriginFromAddress,
  DeliveryRangeError,
  NEAR_ME_MAX_KM,
} from '@/lib/delivery-range';

type KitchenPin = {
  lat?: number | null;
  lng?: number | null;
  name?: string | null;
};

export function useDeliveryRangeGuard() {
  const { selected } = useAddresses();
  const catalog = useHomeCatalog();
  const origin = deliveryOriginFromAddress(selected);

  const resolveKitchen = useCallback(
    (restaurantId: string, fallback?: KitchenPin): KitchenPin => {
      const place = catalog.data?.places.find((row) => row.id === restaurantId);
      if (place) {
        return { lat: place.lat, lng: place.lng, name: place.name };
      }
      return fallback ?? {};
    },
    [catalog.data?.places],
  );

  const ensureDeliverable = useCallback(
    (restaurantId: string, fallback?: KitchenPin): boolean => {
      try {
        assertWithinDeliveryRange(origin, resolveKitchen(restaurantId, fallback), NEAR_ME_MAX_KM);
        return true;
      } catch (error) {
        const message =
          error instanceof DeliveryRangeError
            ? error.message
            : 'This kitchen is outside our delivery range.';
        const needsAddress = error instanceof DeliveryRangeError && !origin;
        Alert.alert(needsAddress ? 'Delivery address needed' : 'Outside delivery range', message, [
          { text: 'OK', style: 'cancel' },
          ...(needsAddress
            ? [
                {
                  text: 'Add address',
                  onPress: () => router.push('/(customer)/addresses'),
                },
              ]
            : [
                {
                  text: 'Show nearby',
                  onPress: () => router.push('/(customer)/(tabs)/explore'),
                },
              ]),
        ]);
        return false;
      }
    },
    [origin, resolveKitchen],
  );

  return { ensureDeliverable, origin, maxKm: NEAR_ME_MAX_KM };
}
