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

/** Flip this while reviewing empty, loading, and error layouts. Default is the populated reference. */
export const RIDER_HOME_PHASE: RiderHomePhase = 'ready';

export const RIDER_CURRENT_ORDER: RiderCurrentOrder | null = {
  id: 'qb7842',
  code: 'QB7842',
  restaurantName: 'Spice Villa',
  cuisine: 'North Indian · Pure Veg',
  image: require('../../../assets/images/chicken_tikka.png'),
  minutesToPickup: 12,
  earning: 126,
  itemCount: 3,
  pickup: { address: '12, Green Park Rd, Sector 14', distanceKm: 2.1, coordinate: null },
  drop: { address: '45, Lake View Apartments', distanceKm: 4.8, coordinate: null },
};

export const RIDER_STATS: RiderStats = {
  deliveries: 6,
  earnings: 1248,
  activeTime: '4h 32m',
  rating: '4.9',
};

export const RIDER_NEARBY: NearbyOrder[] = [
  {
    id: 'tandoori',
    restaurantName: 'The Tandoori Kitchen',
    cuisine: 'North Indian · Non-Veg',
    image: require('../../../assets/images/chicken_tikka.png'),
    pickupKm: 1.4,
    dropKm: 3.2,
    earning: 78,
  },
  {
    id: 'dosa',
    restaurantName: 'Dosa Plaza',
    cuisine: 'South Indian · Pure Veg',
    image: require('../../../assets/images/masala_dosa.png'),
    pickupKm: 2.8,
    dropKm: 5.1,
    earning: 92,
  },
  {
    id: 'burger',
    restaurantName: 'Burger Hub',
    cuisine: 'Burgers · Fast Food',
    image: require('../../../assets/images/misal_pav.png'),
    pickupKm: 3.6,
    dropKm: 6.4,
    earning: 66,
  },
];
