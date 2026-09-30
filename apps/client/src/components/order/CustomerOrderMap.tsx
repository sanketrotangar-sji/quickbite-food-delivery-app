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
  height?: number | 'fill';
  borderRadius?: number;
  restaurantLabel?: string | null;
  customerLabel?: string | null;
  compact?: boolean;
  showChrome?: boolean;
  live?: boolean;
  onViewFullMap?: () => void;
  hideFullMapButton?: boolean;
};

export function CustomerOrderMap(props: Props) {
  const height = props.height ?? 300;
  if (!supportsNativeMaps()) {
    return (
      <MapUnavailable
        height={height === 'fill' ? undefined : height}
        borderRadius={props.borderRadius ?? 20}
        message="Live order maps need an EAS development or preview build. Expo Go cannot load MapLibre."
      />
    );
  }

  // Native MapLibre is only required in custom builds, never in Expo Go.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NativeRouteMap } = require('../maps/NativeRouteMap') as typeof import('../maps/NativeRouteMap');
  return (
    <NativeRouteMap
      {...props}
      destination="auto"
      waitingForRiderMessage="Rider location will appear after assignment"
      customerLabel={props.customerLabel ?? 'Your location'}
    />
  );
}

function MapUnavailable({
  height,
  message,
  borderRadius,
}: {
  height?: number;
  message: string;
  borderRadius: number;
}) {
  return (
    <View style={[styles.message, height != null ? { height } : styles.fill, { borderRadius }]}>
      <Ionicons name="map-outline" size={26} color={colors.primary} />
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
    padding: 28,
    backgroundColor: MAP_LAND,
    overflow: 'hidden',
  },
  fill: { flex: 1, width: '100%' },
  messageText: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
