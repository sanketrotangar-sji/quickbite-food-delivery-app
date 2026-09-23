import { Camera, GeoJSONSource, Layer, Map, Marker, type LngLatBounds } from '@maplibre/maplibre-react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { DeliveryCoordinate } from '@/api/deliveries';
import { getDrivingRoute, type RouteLine } from '@/api/routes';
import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster' as const, source: 'osm' }],
};

export type NativeRouteMapProps = {
  rider: DeliveryCoordinate | null;
  restaurant: DeliveryCoordinate | null;
  customer: DeliveryCoordinate | null;
  destination?: 'restaurant' | 'customer' | 'auto';
  height?: number;
  waitingForRiderMessage?: string | null;
};

type PinKind = 'rider' | 'restaurant' | 'customer';

function boundsFor(points: DeliveryCoordinate[]): LngLatBounds {
  const longitudes = points.map((point) => point.longitude);
  const latitudes = points.map((point) => point.latitude);
  const padding = 0.004;
  return [
    Math.min(...longitudes) - padding,
    Math.min(...latitudes) - padding,
    Math.max(...longitudes) + padding,
    Math.max(...latitudes) + padding,
  ];
}

function Pin({ coordinate, kind }: { coordinate: DeliveryCoordinate; kind: PinKind }) {
  const icon: keyof typeof Ionicons.glyphMap =
    kind === 'rider' ? 'bicycle' : kind === 'restaurant' ? 'restaurant' : 'home';
  return (
    <Marker id={`route-${kind}`} lngLat={[coordinate.longitude, coordinate.latitude]} anchor="bottom">
      <View
        style={[
          styles.pin,
          kind === 'rider' && styles.riderPin,
          kind === 'customer' && styles.customerPin,
        ]}>
        <Ionicons name={icon} size={16} color={colors.white} />
      </View>
    </Marker>
  );
}

export function NativeRouteMap({
  rider,
  restaurant,
  customer,
  destination = 'auto',
  height = 280,
  waitingForRiderMessage = null,
}: NativeRouteMapProps) {
  const [route, setRoute] = useState<RouteLine | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapOffline, setMapOffline] = useState(false);
  const [loading, setLoading] = useState(false);

  const target =
    destination === 'restaurant'
      ? restaurant
      : destination === 'customer'
        ? customer
        : customer;
  const routeStart = destination === 'auto' ? rider ?? restaurant : rider;

  useEffect(() => {
    if (!routeStart || !target) {
      setRoute(null);
      setRouteError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setRouteError(null);
    getDrivingRoute(routeStart, target, controller.signal)
      .then(setRoute)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setRoute(null);
          setRouteError(error instanceof Error ? error.message : 'Could not load this route.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [routeStart?.latitude, routeStart?.longitude, target?.latitude, target?.longitude]);

  const points = useMemo(
    () => [rider, restaurant, customer].filter((point): point is DeliveryCoordinate => point != null),
    [customer, restaurant, rider],
  );
  const cameraBounds = points.length ? boundsFor(points) : null;
  const line = route
    ? ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: route.coordinates },
      } as const)
    : null;

  if (!restaurant || !customer) {
    return <MapMessage height={height} message="This order is missing pickup or drop coordinates." />;
  }
  if (destination !== 'auto' && !rider) {
    return <MapMessage height={height} loading message="Waiting for your GPS location…" />;
  }

  return (
    <View style={[styles.container, { height }]}>
      <Map
        mapStyle={MAP_STYLE}
        style={StyleSheet.absoluteFill}
        logo={false}
        attribution
        compass={false}
        onDidFinishLoadingMap={() => setMapOffline(false)}
        onDidFailLoadingMap={() => setMapOffline(true)}>
        {cameraBounds ? (
          <Camera
            initialViewState={{
              bounds: cameraBounds,
              padding: { top: 48, right: 48, bottom: 48, left: 48 },
            }}
          />
        ) : null}
        {line ? (
          <GeoJSONSource id="delivery-route" data={line}>
            <Layer
              id="delivery-route-line"
              type="line"
              paint={{ 'line-color': colors.primary, 'line-width': 5, 'line-opacity': 0.94 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {restaurant ? <Pin coordinate={restaurant} kind="restaurant" /> : null}
        {customer ? <Pin coordinate={customer} kind="customer" /> : null}
        {rider ? <Pin coordinate={rider} kind="rider" /> : null}
      </Map>
      {loading ? <Overlay loading message="Finding the best driving route…" /> : null}
      {routeError ? <Overlay message={routeError} /> : null}
      {mapOffline ? <Overlay message="Map tiles are offline. Reconnect to view the route." /> : null}
      {!rider && waitingForRiderMessage ? (
        <View style={styles.waiting}>
          <AppText weight="semibold" style={styles.waitingText}>
            {waitingForRiderMessage}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function MapMessage({ height, message, loading }: { height: number; message: string; loading?: boolean }) {
  return (
    <View style={[styles.message, { height }]}>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Ionicons name="map-outline" size={24} color={colors.primary} />
      )}
      <AppText muted style={styles.messageText}>
        {message}
      </AppText>
    </View>
  );
}

function Overlay({ message, loading }: { message: string; loading?: boolean }) {
  return (
    <View style={styles.overlay}>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="warning-outline" size={18} color={colors.primary} />
      )}
      <AppText weight="semibold" style={styles.overlayText}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#E7F0EA' },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderWidth: 3,
    borderColor: colors.white,
  },
  riderPin: { backgroundColor: colors.primary },
  customerPin: { backgroundColor: colors.success },
  message: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    backgroundColor: '#E7F0EA',
  },
  messageText: { textAlign: 'center', fontSize: 13, lineHeight: 18 },
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  overlayText: { flex: 1, fontSize: 12 },
  waiting: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  waitingText: { fontSize: 11 },
});
