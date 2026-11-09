import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAddresses } from '@/features/addresses/hooks';
import { useLocationStore, type GeoPoint } from '@/features/location/store';

export type LocateResult =
  | { status: 'ok' }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable'; message: string };

function placeLabel(rows: Location.LocationGeocodedAddress[], fallback: string) {
  const row = rows[0];
  if (!row) return fallback;
  const area = row.district || row.subregion || row.street || row.name;
  const city = row.city && row.city !== area ? row.city : null;
  return [area, city].filter(Boolean).join(', ') || fallback;
}

async function labelFor(point: GeoPoint, fallback: string) {
  try {
    return placeLabel(await Location.reverseGeocodeAsync(point), fallback);
  } catch {
    return fallback;
  }
}

export function useDeliveryPoint() {
  const point = useLocationStore((s) => s.point);
  const label = useLocationStore((s) => s.label);
  const source = useLocationStore((s) => s.source);
  return { point, label, source, isFallback: source === 'fallback' };
}

/** Ask for GPS, read the position and store it as the delivery point. */
export function useLocateMe() {
  const setLocation = useLocationStore((s) => s.setLocation);
  const [locating, setLocating] = useState(false);

  const locate = useCallback(async (): Promise<LocateResult> => {
    setLocating(true);
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (!perm.granted) return { status: 'denied', canAskAgain: perm.canAskAgain };

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLocation({ point, label: await labelFor(point, 'Current location'), source: 'gps' });
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'Could not read your location.',
      };
    } finally {
      setLocating(false);
    }
  }, [setLocation]);

  return { locate, locating };
}

/** Forward-geocode a typed area ("Colva", "Panjim market") using the device geocoder. */
export function useAreaSearch() {
  const setLocation = useLocationStore((s) => s.setLocation);
  const [searching, setSearching] = useState(false);

  const search = useCallback(
    async (query: string): Promise<boolean> => {
      const text = query.trim();
      if (!text) return false;
      setSearching(true);
      try {
        const hits = await Location.geocodeAsync(/goa/i.test(text) ? text : `${text}, Goa, India`);
        const hit = hits[0];
        if (!hit) return false;
        const point = { latitude: hit.latitude, longitude: hit.longitude };
        setLocation({ point, label: await labelFor(point, text), source: 'search' });
        return true;
      } catch {
        return false;
      } finally {
        setSearching(false);
      }
    },
    [setLocation],
  );

  return { search, searching };
}

/** Choosing a saved address also moves the browse location to it. */
export function useSyncSelectedAddress() {
  const { hydrated, selected } = useAddresses();
  const lastSeen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!hydrated) return;
    const id = selected?.id ?? null;
    const first = lastSeen.current === undefined;
    lastSeen.current = id;
    if (!selected || selected.lat == null || selected.lng == null) return;

    const store = useLocationStore.getState();
    if (store.addressId === selected.id) return;
    // On cold start keep whatever the user chose last time (GPS, search, address).
    if (first && store.point && store.source !== 'fallback') return;

    store.setLocation({
      point: { latitude: Number(selected.lat), longitude: Number(selected.lng) },
      label: selected.area || selected.nickname,
      source: 'address',
      addressId: selected.id,
    });
  }, [hydrated, selected]);
}
