import type { ImageSourcePropType } from 'react-native';
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
  image: ImageSourcePropType;
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
  image: ImageSourcePropType;
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
