import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listMyNotifications, markNotificationRead } from '@/api/notices';
import { useAuth } from '@/hooks/useAuth';

export const myNotificationsKey = ['my-notifications'] as const;

export function useMyNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: myNotificationsKey,
    queryFn: () => listMyNotifications(userId),
    enabled: !!userId,
  });
}

export function useMarkMyNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: myNotificationsKey }),
  });
}
