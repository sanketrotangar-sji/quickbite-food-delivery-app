import { useLocalSearchParams } from 'expo-router';

import { RestaurantDetailScreen } from '@/screens/customer/RestaurantDetailScreen';

export default function RestaurantRoute() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const restaurantId = Array.isArray(params.id) ? params.id[0] : params.id;
  return <RestaurantDetailScreen restaurantId={restaurantId} />;
}
