import type { DeliveryCoordinate } from '@quickbite/api/mobile/deliveries';
import { MapUnavailable } from '@/components/order/CustomerOrderMap';
import { radii } from '@/constants/theme';
import { supportsNativeMaps } from '@/lib/runtime';

type Props = {
  rider: DeliveryCoordinate | null;
  restaurant: DeliveryCoordinate | null;
  customer: DeliveryCoordinate | null;
  destination: 'restaurant' | 'customer' | 'auto';
  height?: number;
  borderRadius?: number;
  restaurantLabel?: string | null;
  customerLabel?: string | null;
  compact?: boolean;
};

export function RiderRouteMap(props: Props) {
  if (!supportsNativeMaps()) {
    return (
      <MapUnavailable
        height={props.height ?? 260}
        borderRadius={props.borderRadius ?? radii.lg}
        icon="phone-portrait-outline"
        message="Live delivery maps need an EAS development or preview build. Expo Go cannot load MapLibre."
      />
    );
  }

  // Native MapLibre is only required in custom builds, never in Expo Go.
  const { NativeRouteMap } = require('../../../components/maps/NativeRouteMap') as typeof import('../../../components/maps/NativeRouteMap');
  return <NativeRouteMap {...props} />;
}
