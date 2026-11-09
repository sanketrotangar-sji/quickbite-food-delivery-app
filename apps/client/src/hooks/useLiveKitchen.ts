import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';

import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';

/** Refetch the catalog immediately only on Home / Explore; elsewhere mark it stale for the next visit. */
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.restaurant.all });
      if (kitchenTimer.current) clearTimeout(kitchenTimer.current);
      kitchenTimer.current = setTimeout(() => {
        const refetchType = isCatalogFocused(pathnameRef.current) ? 'active' : 'none';
        void queryClient.invalidateQueries({ queryKey: queryKeys.home.all, refetchType });
        void queryClient.invalidateQueries({ queryKey: queryKeys.places.all, refetchType });
      }, 4000);
    };

    const channel = supabase
      .channel(`kitchen-live-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, refreshKitchens)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, refreshKitchens)
      .subscribe();

    return () => {
      if (kitchenTimer.current) clearTimeout(kitchenTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
