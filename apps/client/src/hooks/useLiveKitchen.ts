import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';

import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { ordersQueryKey } from '@/hooks/useOrders';

/** Only invalidate home catalog while the customer is on Home or Explore. */
function isCatalogFocused(pathname: string | null) {
  if (!pathname) return false;
  if (pathname.includes('/picks')) return true;
  if (/\/\(tabs\)\/?$/.test(pathname)) return true;
  if (pathname.endsWith('/(tabs)/index') || pathname.endsWith('/index')) {
    return pathname.includes('(tabs)') && !pathname.includes('/reorder') && !pathname.includes('/assistant');
  }
  return false;
}

export function useLiveKitchen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const pathname = usePathname();
  const kitchenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    if (!userId) return;

    const refreshKitchens = () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      void queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
      if (kitchenTimer.current) clearTimeout(kitchenTimer.current);
      kitchenTimer.current = setTimeout(() => {
        if (!isCatalogFocused(pathnameRef.current)) return;
        void queryClient.invalidateQueries({ queryKey: ['home-catalog'] });
        void queryClient.invalidateQueries({ queryKey: ['home-shell'] });
        void queryClient.invalidateQueries({ queryKey: ['home-dishes'] });
      }, 4000);
    };

    const channel = supabase
      .channel(`kitchen-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, refreshKitchens)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, refreshKitchens)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ordersQueryKey });
        },
      )
      .subscribe();

    return () => {
      if (kitchenTimer.current) clearTimeout(kitchenTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
