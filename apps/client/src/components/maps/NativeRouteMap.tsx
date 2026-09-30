import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type CameraRef,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { DeliveryCoordinate } from '@/api/deliveries';
import { getDrivingRoute, type RouteLine } from '@/api/routes';
import { AppText } from '@/components/AppText';
import { MAP_LAND, QUICKBITE_MAP_STYLE, ROUTE_ORANGE } from '@/components/maps/quickbite-map-style';
import { colors, radii } from '@/constants/theme';
import { distanceKm, formatKm } from '@/lib/geo';

const MAP_STYLE = QUICKBITE_MAP_STYLE as unknown as React.ComponentProps<typeof Map>['mapStyle'];

export type NativeRouteMapProps = {
  rider: DeliveryCoordinate | null;
  restaurant: DeliveryCoordinate | null;
  customer: DeliveryCoordinate | null;
  destination?: 'restaurant' | 'customer' | 'auto';
  height?: number | 'fill';
  borderRadius?: number;
  waitingForRiderMessage?: string | null;
  restaurantLabel?: string | null;
  customerLabel?: string | null;
  compact?: boolean;
  /** Live tracking badge + recenter + optional full-map CTA */
  showChrome?: boolean;
  live?: boolean;
  onViewFullMap?: () => void;
  /** Hide full-map CTA (e.g. already fullscreen) */
  hideFullMapButton?: boolean;
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

function mergeRoutes(legs: RouteLine[]): RouteLine | null {
  if (legs.length === 0) return null;
  const coordinates: [number, number][] = [];
  let distanceMeters = 0;
  let durationSeconds = 0;
  for (const leg of legs) {
    distanceMeters += leg.distanceMeters;
    durationSeconds += leg.durationSeconds;
    for (const coord of leg.coordinates) {
      const last = coordinates[coordinates.length - 1];
      if (last && last[0] === coord[0] && last[1] === coord[1]) continue;
      coordinates.push(coord);
    }
  }
  if (coordinates.length < 2) return null;
  return { coordinates, distanceMeters, durationSeconds };
}

function straightFallback(from: DeliveryCoordinate, to: DeliveryCoordinate): RouteLine {
  return {
    coordinates: [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
    distanceMeters: 0,
    durationSeconds: 0,
  };
}

function Pin({
  coordinate,
  kind,
  label,
  subtitle,
  compact,
}: {
  coordinate: DeliveryCoordinate;
  kind: PinKind;
  label?: string | null;
  subtitle?: string | null;
  compact?: boolean;
}) {
  const icon: keyof typeof Ionicons.glyphMap =
    kind === 'rider' ? 'bicycle' : kind === 'restaurant' ? 'restaurant' : 'home';
  const size = kind === 'rider' ? (compact ? 36 : 42) : compact ? 30 : 36;
  const iconSize = kind === 'rider' ? (compact ? 16 : 18) : compact ? 14 : 16;

  return (
    <Marker id={`route-${kind}`} lngLat={[coordinate.longitude, coordinate.latitude]} anchor="center">
      <View style={styles.markerWrap}>
        {label ? (
          <View style={[styles.callout, kind === 'rider' && styles.riderCallout]}>
            <AppText weight="semibold" numberOfLines={1} style={styles.calloutText}>
              {label}
            </AppText>
            {subtitle ? (
              <AppText numberOfLines={1} style={styles.calloutSub}>
                {subtitle}
              </AppText>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.pinShadow, { width: size + 4, height: size + 4, borderRadius: (size + 4) / 2 }]}>
          <View style={[styles.pin, { width: size, height: size, borderRadius: size / 2 }]}>
            <Ionicons name={icon} size={iconSize} color={ROUTE_ORANGE} />
          </View>
        </View>
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
  borderRadius = 20,
  waitingForRiderMessage = null,
  restaurantLabel = null,
  customerLabel = null,
  compact = false,
  showChrome = false,
  live = false,
  onViewFullMap,
  hideFullMapButton = false,
}: NativeRouteMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const [route, setRoute] = useState<RouteLine | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapOffline, setMapOffline] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const fill = height === 'fill';
  // Quantize rider GPS so tiny ticks don't abort/refetch road routes constantly.
  const riderLatKey = rider ? Math.round(rider.latitude * 400) / 400 : null;
  const riderLngKey = rider ? Math.round(rider.longitude * 400) / 400 : null;

  useEffect(() => {
    if (!restaurant || !customer) {
      setRoute(null);
      setRouteError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let alive = true;
    const debounceMs = rider ? 800 : 0;

    const timer = setTimeout(() => {
      setLoading(true);
      setRouteError(null);

      async function load() {
        try {
          if (destination === 'restaurant' && rider) {
            const leg = await getDrivingRoute(rider, restaurant!, controller.signal);
            if (!controller.signal.aborted && alive) {
              setRoute(leg);
              setRouteError(null);
            }
            return;
          }
          if (destination === 'customer' && rider) {
            const leg = await getDrivingRoute(rider, customer!, controller.signal);
            if (!controller.signal.aborted && alive) {
              setRoute(leg);
              setRouteError(null);
            }
            return;
          }

          if (rider) {
            const results = await Promise.allSettled([
              getDrivingRoute(restaurant!, rider, controller.signal),
              getDrivingRoute(rider, customer!, controller.signal),
            ]);
            if (controller.signal.aborted || !alive) return;
            const legs = results
              .filter((result): result is PromiseFulfilledResult<RouteLine> => result.status === 'fulfilled')
              .map((result) => result.value);
            if (legs.length === 0) {
              setRouteError('Road route unavailable. Showing a direct line instead.');
              setRoute(straightFallback(restaurant!, customer!));
              return;
            }
            if (legs.length < 2) {
              setRouteError('Part of the road route is unavailable.');
            } else {
              setRouteError(null);
            }
            setRoute(mergeRoutes(legs) ?? straightFallback(restaurant!, customer!));
            return;
          }

          const leg = await getDrivingRoute(restaurant!, customer!, controller.signal);
          if (!controller.signal.aborted && alive) {
            setRoute(leg);
            setRouteError(null);
          }
        } catch (error: unknown) {
          if (controller.signal.aborted || !alive) return;
          if (restaurant && customer) {
            setRoute((current) => current ?? straightFallback(restaurant, customer));
            setRouteError(
              error instanceof Error ? error.message : 'Road route unavailable. Showing a direct line instead.',
            );
          } else {
            setRoute(null);
            setRouteError(error instanceof Error ? error.message : 'Could not load this route.');
          }
        } finally {
          if (alive && !controller.signal.aborted) setLoading(false);
        }
      }

      void load();
    }, debounceMs);

    return () => {
      alive = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    customer?.latitude,
    customer?.longitude,
    destination,
    restaurant?.latitude,
    restaurant?.longitude,
    riderLatKey,
    riderLngKey,
  ]);

  const points = useMemo(
    () => [rider, restaurant, customer].filter((point): point is DeliveryCoordinate => point != null),
    [customer, restaurant, rider],
  );
  const cameraBounds = points.length ? boundsFor(points) : null;
  const pad = compact ? 36 : fill ? 64 : 48;

  useEffect(() => {
    if (!mapReady || !cameraBounds) return;
    const frame = requestAnimationFrame(() => {
      cameraRef.current?.fitBounds(cameraBounds, {
        padding: { top: pad, right: pad, bottom: pad, left: pad },
        duration: 650,
        easing: 'ease',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    cameraBounds?.[0],
    cameraBounds?.[1],
    cameraBounds?.[2],
    cameraBounds?.[3],
    mapReady,
    pad,
  ]);

  const line = route
    ? ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: route.coordinates },
      } as const)
    : null;

  const riderAwayKm =
    rider && customer ? distanceKm(rider, customer) : rider && restaurant ? distanceKm(rider, restaurant) : null;
  const riderSubtitle = riderAwayKm != null ? `${formatKm(riderAwayKm)} away` : null;

  function recenter() {
    if (!cameraBounds || !mapReady) return;
    cameraRef.current?.fitBounds(cameraBounds, {
      padding: { top: pad, right: pad, bottom: pad, left: pad },
      duration: 500,
      easing: 'ease',
    });
  }

  if (!restaurant || !customer) {
    return (
      <MapMessage
        height={fill ? undefined : (height as number)}
        borderRadius={borderRadius}
        message="This order is missing pickup or drop coordinates."
      />
    );
  }
  if (destination !== 'auto' && !rider) {
    return (
      <MapMessage
        height={fill ? undefined : (height as number)}
        borderRadius={borderRadius}
        loading
        message="Waiting for your GPS location…"
      />
    );
  }

  const lineWidth = compact ? 4 : 6;
  const casingWidth = compact ? 7 : 10;

  return (
    <View style={[styles.container, fill ? styles.fill : { height: height as number }, { borderRadius }]}>
      <Map
        mapStyle={MAP_STYLE}
        style={StyleSheet.absoluteFill}
        logo={false}
        attribution={false}
        compass={false}
        onDidFinishLoadingMap={() => {
          setMapOffline(false);
          setMapReady(true);
        }}
        onDidFailLoadingMap={() => {
          setMapOffline(true);
          setMapReady(false);
        }}>
        {cameraBounds ? (
          <Camera
            ref={cameraRef}
            initialViewState={{
              bounds: cameraBounds,
              padding: { top: pad, right: pad, bottom: pad, left: pad },
            }}
          />
        ) : null}
        {line ? (
          <GeoJSONSource id="delivery-route" data={line}>
            <Layer
              id="delivery-route-casing"
              type="line"
              paint={{ 'line-color': '#FFFFFF', 'line-width': casingWidth, 'line-opacity': 0.92 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
            <Layer
              id="delivery-route-line"
              type="line"
              paint={{ 'line-color': ROUTE_ORANGE, 'line-width': lineWidth, 'line-opacity': 0.98 }}
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            />
          </GeoJSONSource>
        ) : null}
        {restaurant ? (
          <Pin key="pin-restaurant" coordinate={restaurant} kind="restaurant" label={restaurantLabel} compact={compact} />
        ) : null}
        {customer ? (
          <Pin
            key="pin-customer"
            coordinate={customer}
            kind="customer"
            label={customerLabel ?? 'Your location'}
            compact={compact}
          />
        ) : null}
        {rider ? (
          <Pin
            key="pin-rider"
            coordinate={rider}
            kind="rider"
            label={live || showChrome ? 'Rider is on the way' : null}
            subtitle={live || showChrome ? riderSubtitle : null}
            compact={compact}
          />
        ) : null}
      </Map>

      {showChrome ? (
        <>
          <View style={styles.livePill}>
            <View style={[styles.liveDot, !live && styles.liveDotOff]} />
            <AppText weight="semibold" style={styles.livePillText}>
              {live ? 'Live Tracking' : 'Tracking'}
            </AppText>
          </View>
          <Pressable onPress={recenter} style={styles.recenter} accessibilityLabel="Recenter map">
            <Ionicons name="locate-outline" size={20} color={colors.text} />
          </Pressable>
          {!hideFullMapButton && onViewFullMap ? (
            <Pressable onPress={onViewFullMap} style={styles.fullMap} accessibilityLabel="View full map">
              <AppText weight="semibold" style={styles.fullMapText}>
                View full map
              </AppText>
              <Ionicons name="arrow-up-outline" size={14} color={colors.text} />
            </Pressable>
          ) : null}
        </>
      ) : null}

      {loading && !compact && !showChrome ? <Overlay loading message="Finding the best driving route…" /> : null}
      {routeError ? <Overlay message={routeError} /> : null}
      {mapOffline ? <Overlay message="Map tiles are offline. Reconnect to view the route." /> : null}
      {!rider && waitingForRiderMessage && !showChrome ? (
        <View style={styles.waiting}>
          <AppText weight="semibold" style={styles.waitingText}>
            {waitingForRiderMessage}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function MapMessage({
  height,
  message,
  loading,
  borderRadius = 20,
}: {
  height?: number;
  message: string;
  loading?: boolean;
  borderRadius?: number;
}) {
  return (
    <View style={[styles.message, height != null ? { height } : styles.fill, { borderRadius }]}>
      {loading ? (
        <ActivityIndicator color={ROUTE_ORANGE} />
      ) : (
        <Ionicons name="map-outline" size={24} color={ROUTE_ORANGE} />
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
        <ActivityIndicator size="small" color={ROUTE_ORANGE} />
      ) : (
        <Ionicons name="warning-outline" size={18} color={ROUTE_ORANGE} />
      )}
      <AppText weight="semibold" style={styles.overlayText}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: MAP_LAND },
  fill: { flex: 1, width: '100%' },
  markerWrap: { alignItems: 'center', gap: 4 },
  callout: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 140,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  riderCallout: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 160,
    gap: 1,
  },
  calloutText: { fontSize: 10, color: colors.text },
  calloutSub: { fontSize: 9, color: colors.textMuted },
  pinShadow: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: '#F0EEEC',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  livePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveDotOff: { backgroundColor: '#A3A3A3' },
  livePillText: { fontSize: 11, color: colors.text },
  recenter: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fullMap: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fullMapText: { fontSize: 12, color: colors.text },
  message: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 28,
    backgroundColor: MAP_LAND,
    overflow: 'hidden',
  },
  messageText: { textAlign: 'center', fontSize: 13, lineHeight: 18, color: colors.textMuted },
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
  overlayText: { flex: 1, fontSize: 12, color: colors.text },
  waiting: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  waitingText: { fontSize: 11, color: colors.text },
});
