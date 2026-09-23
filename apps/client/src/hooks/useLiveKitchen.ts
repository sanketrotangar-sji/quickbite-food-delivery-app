import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { ordersQueryKey } from '@/hooks/useOrders';

export function useLiveKitchen() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    const refreshKitchens = () => {
      void queryClient.invalidateQueries({ queryKey: ['home-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['restaurants'] });
      void queryClient.invalidateQueries({ queryKey: ['restaurant'] });
      void queryClient.invalidateQueries({ queryKey: ['menu'] });
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
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
