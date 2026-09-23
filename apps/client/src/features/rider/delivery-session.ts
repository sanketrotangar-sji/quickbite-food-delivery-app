import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import type { OrderStatus } from '@/constants/orderStatus';

export type DeliveryStep = 'to_pickup' | 'at_pickup' | 'picked_up' | 'at_customer' | 'completed';

const ORDER: DeliveryStep[] = ['to_pickup', 'at_pickup', 'picked_up', 'at_customer', 'completed'];
const STORAGE_KEY = '@quickbite/rider-delivery-steps';
const steps = new Map<string, DeliveryStep>();
const listeners = new Set<() => void>();
let hydrated = false;
let hydration: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function backendStep(status: OrderStatus | null | undefined): DeliveryStep {
  if (status === 'out_for_delivery') return 'picked_up';
  if (status === 'delivered') return 'completed';
  return 'to_pickup';
}

async function hydrate() {
  if (hydrated) return;
  if (!hydration) {
    hydration = AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const stored = JSON.parse(value) as Record<string, DeliveryStep>;
        Object.entries(stored).forEach(([orderId, step]) => {
          if (ORDER.includes(step)) steps.set(orderId, step);
        });
      })
      .catch(() => {})
      .finally(() => {
        hydrated = true;
        emit();
      });
  }
  await hydration;
}

function persist() {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(steps)));
}

export function getDeliveryStep(orderId: string | null, status?: OrderStatus | null) {
  if (!orderId) return backendStep(status);
  const stored = steps.get(orderId);
  const minimum = backendStep(status);
  if (!stored || ORDER.indexOf(stored) < ORDER.indexOf(minimum)) return minimum;
  return stored;
}

export function setDeliveryStep(orderId: string, next: DeliveryStep) {
  steps.set(orderId, next);
  persist();
  emit();
}

export function advanceDeliveryStep(orderId: string, status?: OrderStatus | null) {
  const index = ORDER.indexOf(getDeliveryStep(orderId, status));
  const next = ORDER[Math.min(index + 1, ORDER.length - 1)] ?? 'completed';
  setDeliveryStep(orderId, next);
}

export function resetDeliveryStep(orderId: string) {
  steps.delete(orderId);
  persist();
  emit();
}

export function deliveryStatusLabel(value: DeliveryStep) {
  if (value === 'to_pickup') return 'Going to pickup';
  if (value === 'at_pickup') return 'At the restaurant';
  if (value === 'picked_up') return 'Order picked up';
  if (value === 'at_customer') return 'At the customer';
  return 'Delivered';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDeliveryStep(orderId: string | null, status?: OrderStatus | null) {
  useEffect(() => {
    void hydrate();
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => getDeliveryStep(orderId, status),
    () => getDeliveryStep(orderId, status),
  );
}
