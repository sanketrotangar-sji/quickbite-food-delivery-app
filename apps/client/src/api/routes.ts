import type { DeliveryCoordinate } from './deliveries';
import { supabase } from './supabaseClient';

export type RouteLine = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
};

type OpenRouteServiceResponse = {
  features?: {
    geometry?: {
      type?: string;
      coordinates?: [number, number][];
    };
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
    };
  }[];
};

export async function getDrivingRoute(
  from: DeliveryCoordinate,
  to: DeliveryCoordinate,
  signal?: AbortSignal,
): Promise<RouteLine> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const { data, error } = await supabase.functions.invoke<OpenRouteServiceResponse>('directions', {
    body: { from, to },
  });
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error || !data) {
    throw new Error(error?.message.includes('429') ? 'Route service is busy. Try again shortly.' : 'Could not load this route.');
  }
  const feature = data.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== 'LineString' || !coordinates || coordinates.length < 2) {
    throw new Error('The route service returned no drivable route.');
  }

  return {
    coordinates,
    distanceMeters: Number(feature.properties?.summary?.distance ?? 0),
    durationSeconds: Number(feature.properties?.summary?.duration ?? 0),
  };
}
