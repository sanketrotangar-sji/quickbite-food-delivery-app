import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { DeliveryCoordinate } from '@/api/deliveries';
import { AppText } from '@/components/AppText';
import { MAP_LAND } from '@/components/maps/quickbite-map-style';
import { colors, radii } from '@/constants/theme';
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
        message="Live delivery maps need an EAS development or preview build. Expo Go cannot load MapLibre."
      />
    );
  }

  // Native MapLibre is only required in custom builds, never in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NativeRouteMap } = require('../../../components/maps/NativeRouteMap') as typeof import('../../../components/maps/NativeRouteMap');
  return <NativeRouteMap {...props} />;
}

function MapUnavailable({
  height,
  message,
  borderRadius,
}: {
  height: number;
  message: string;
  borderRadius: number;
}) {
  return (
    <View style={[styles.message, { height, borderRadius }]}>
      <Ionicons name="phone-portrait-outline" size={24} color={colors.primary} />
      <AppText muted style={styles.messageText}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    backgroundColor: MAP_LAND,
    overflow: 'hidden',
  },
  messageText: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
