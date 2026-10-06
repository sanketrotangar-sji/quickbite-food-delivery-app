import type { DeliveryCoordinate } from '@/api/deliveries';

export type RiderHomePhase = 'loading' | 'error' | 'ready';

export type RiderStop = {
  address: string;
  distanceKm: number;
  coordinate: DeliveryCoordinate | null;
};

export type RiderCurrentOrder = {
  id: string;
  code: string;
  restaurantName: string;
  cuisine: string;
  imageUrl: string | null;
  minutesToPickup: number;
  earning: number;
  itemCount: number;
  statusLabel: string;
  customerName: string | null;
  customerPhone: string | null;
  pickup: RiderStop;
  drop: RiderStop;
};

export type NearbyOrder = {
  id: string;
  restaurantName: string;
  cuisine: string;
  imageUrl: string | null;
  pickupKm: number;
  dropKm: number;
  earning: number;
};

export type RiderStats = {
  deliveries: number;
  earnings: number;
  activeTime: string;
  rating: string;
};
