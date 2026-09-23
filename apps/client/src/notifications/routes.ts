import type { Href } from 'expo-router';

export function routeFromNotification(data: Record<string, unknown>): Href | null {
  if (data.type === 'new_delivery') {
    return '/(rider)/(tabs)';
  }
  if (data.audience === 'rider') return '/(rider)/delivery';

  const orderId = typeof data.orderId === 'string' ? data.orderId : null;
  if (!orderId) return null;

  return {
    pathname: '/(customer)/orders/[id]',
    params: { id: orderId },
  } as unknown as Href;
}
