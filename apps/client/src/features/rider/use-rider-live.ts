import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  claimDelivery,
  listAvailableDeliveries,
  listDeliveryHistory,
  listMyDeliveries,
  markDelivered,
  startDelivery,
  type RiderDelivery,
} from '@/api/deliveries';
import { listMyNotifications, markNotificationRead } from '@/api/notices';
import type { EarningsRange } from '@/features/rider/rider-content';
import type { NearbyOrder, RiderCurrentOrder, RiderStats } from '@/features/rider/rider-home';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/api/supabaseClient';
import { startRiderTracking, stopRiderTracking } from '@/features/rider/rider-tracking';
import { riderTrackingAction } from '@/features/rider/tracking-policy';
import type { OrderStatus } from '@/constants/orderStatus';

export const riderOrdersKey = ['rider-orders'] as const;
export const riderNoticesKey = ['rider-notices'] as const;

const FALLBACK_IMAGE = require('../../../assets/images/misal_pav.png');

function imageFor(url: string | null) {
  return url ? { uri: url } : FALLBACK_IMAGE;
}

function orderCode(order: RiderDelivery) {
  const note = order.notes?.trim();
  if (note && /^QB\d+$/i.test(note)) return note.toUpperCase();
  return order.id.replace(/-/g, '').slice(-6).toUpperCase();
}

export function toCurrentOrder(order: RiderDelivery): RiderCurrentOrder {
  return {
    id: order.id,
    code: orderCode(order),
    restaurantName: order.restaurantName,
    cuisine: order.cuisine,
    image: imageFor(order.imageUrl),
    minutesToPickup: order.etaMinutes ?? 15,
    earning: order.earning + order.bonus + order.tip,
    itemCount: order.itemCount,
    pickup: {
      address: order.restaurantAddress || order.restaurantName,
      distanceKm: order.pickupKm,
      coordinate: order.restaurantCoordinate,
    },
    drop: { address: order.address, distanceKm: order.dropKm, coordinate: order.customerCoordinate },
  };
}

export function toNearbyOrder(order: RiderDelivery): NearbyOrder {
  return {
    id: order.id,
    restaurantName: order.restaurantName,
    cuisine: order.cuisine,
    image: imageFor(order.imageUrl),
    pickupKm: order.pickupKm,
    dropKm: order.dropKm,
    earning: order.earning + order.bonus + order.tip,
  };
}

function payout(order: RiderDelivery) {
  return order.earning + order.tip + order.bonus;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function inRange(value: string | null, range: EarningsRange, now: Date) {
  if (!value) return false;
  const date = new Date(value);
  if (range === 'today') return date >= startOfDay(now);
  if (range === 'week') return date >= new Date(startOfDay(now).getTime() - 6 * 24 * 60 * 60 * 1000);
  return date >= new Date(now.getFullYear(), now.getMonth(), 1);
}

export function earningsSnapshot(orders: RiderDelivery[], range: EarningsRange, now = new Date()) {
  const rows = orders.filter((order) => order.status === 'delivered' && inRange(order.deliveredAt ?? order.placedAt, range, now));
  const deliveryPay = rows.reduce((sum, order) => sum + order.earning, 0);
  const bonuses = rows.reduce((sum, order) => sum + order.bonus, 0);
  const tips = rows.reduce((sum, order) => sum + order.tip, 0);
  return {
    total: deliveryPay + bonuses + tips,
    deliveries: rows.length,
    deliveryPay,
    bonuses,
    tips,
    rows,
  };
}

export function earningsBars(orders: RiderDelivery[], range: EarningsRange, now = new Date()) {
  const snapshot = earningsSnapshot(orders, range, now);
  if (range === 'today') {
    const slots = [9, 11, 13, 15, 17, 19];
    return slots.map((hour) => ({
      label: `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'p' : 'a'}`,
      amount: snapshot.rows
        .filter((order) => new Date(order.deliveredAt ?? order.placedAt).getHours() === hour)
        .reduce((sum, order) => sum + payout(order), 0),
    }));
  }
  if (range === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(startOfDay(now).getTime() - (6 - index) * 24 * 60 * 60 * 1000);
      const label = day.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3);
      return {
        label,
        amount: snapshot.rows
          .filter((order) => startOfDay(new Date(order.deliveredAt ?? order.placedAt)).getTime() === day.getTime())
          .reduce((sum, order) => sum + payout(order), 0),
      };
    });
  }
  return [1, 2, 3, 4].map((week) => ({
    label: `W${week}`,
    amount: snapshot.rows
      .filter((order) => {
        const day = new Date(order.deliveredAt ?? order.placedAt).getDate();
        return Math.ceil(day / 7) === week;
      })
      .reduce((sum, order) => sum + payout(order), 0),
  }));
}

export function recentEarnings(orders: RiderDelivery[]) {
  return orders
    .filter((order) => order.status === 'delivered')
    .slice(0, 6)
    .map((order) => ({
      id: order.id,
      title: order.restaurantName,
      detail: `Delivery pay · ${order.restaurantAddress || 'Pickup'} to ${order.address}`,
      amount: payout(order),
    }));
}

export function todayStats(history: RiderDelivery[], active: RiderDelivery | null): RiderStats {
  const now = new Date();
  const today = history.filter((order) => order.status === 'delivered' && inRange(order.deliveredAt ?? order.placedAt, 'today', now));
  const counted = active ? [...today, active] : today;
  const earnings = counted.reduce((sum, order) => sum + payout(order), 0);
  const times = counted.map((order) => new Date(order.placedAt).getTime());
  let activeTime = '—';
  if (times.length > 1) {
    const minutes = Math.max(0, Math.round((Math.max(...times) - Math.min(...times)) / 60000));
    const hours = Math.floor(minutes / 60);
    activeTime = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  } else if (times.length === 1) {
    activeTime = 'On shift';
  }
  return {
    deliveries: counted.length,
    earnings,
    activeTime,
    rating: 'New',
  };
}

export function pickActive(mine: RiderDelivery[]) {
  return (
    mine.find((order) => order.status === 'out_for_delivery') ??
    mine.find((order) => order.status === 'ready') ??
    mine.find((order) => order.status === 'preparing') ??
    null
  );
}

export function useRiderOrders() {
  const { session } = useAuth();
  return useQuery({
    queryKey: riderOrdersKey,
    queryFn: async () => {
      const [available, mine, history] = await Promise.all([
        listAvailableDeliveries(),
        listMyDeliveries(),
        listDeliveryHistory(),
      ]);
      const active = pickActive(mine);
      if (active) void startRiderTracking(active.id);
      else void stopRiderTracking();
      return { available, mine, history };
    },
    enabled: !!session,
  });
}

export function useClaimDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimDelivery,
    onSuccess: (_data, orderId) => {
      void startRiderTracking(orderId);
      void queryClient.invalidateQueries({ queryKey: riderOrdersKey });
    },
  });
}

export function useAdvanceRiderOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: 'start' | 'deliver' }) => {
      if (input.action === 'start') await startDelivery(input.id);
      else await markDelivered(input.id);
    },
    onSuccess: (_data, input) => {
      if (input.action === 'deliver') void stopRiderTracking(input.id);
      void queryClient.invalidateQueries({ queryKey: riderOrdersKey });
    },
  });
}

export function useRiderOrdersRealtime() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const channel = supabase
      .channel(`rider-orders-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const next = payload.new as { id?: string; rider_id?: string | null; status?: OrderStatus };
          const tracking = riderTrackingAction(next.status, next.rider_id, userId);
          if (tracking === 'start' && next.id) void startRiderTracking(next.id);
          if (tracking === 'stop') void stopRiderTracking(next.id);
          void queryClient.invalidateQueries({ queryKey: riderOrdersKey });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, session?.user.id]);
}

export function useRiderNotices() {
  const { session } = useAuth();
  return useQuery({
    queryKey: riderNoticesKey,
    queryFn: listMyNotifications,
    enabled: !!session,
  });
}

export function useMarkNoticeRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: riderNoticesKey });
    },
  });
}
