import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { ordersQueryKey } from '@/hooks/useOrders';

export function useLiveKitchen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const kitchenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const refreshKitchens = () => {
      void queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      void queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
      // Debounce full home catalog — avoid refetch storms on every menu row change.
      if (kitchenTimer.current) clearTimeout(kitchenTimer.current);
      kitchenTimer.current = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['home-catalog'] });
      }, 1500);
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
