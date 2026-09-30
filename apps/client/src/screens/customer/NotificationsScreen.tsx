import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { FlowHeader } from '@/components/FlowHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Screen } from '@/components/Screen';
import { colors, radii } from '@/constants/theme';
import { useMarkMyNotificationRead, useMyNotifications } from '@/hooks/useMyNotifications';

export function NotificationsScreen() {
  const notices = useMyNotifications();
  const markRead = useMarkMyNotificationRead();
  const items = notices.data ?? [];

  return (
    <Screen>
      <FlowHeader title="Notifications" />
      {notices.isLoading ? (
        <View style={styles.list}>
          <LoadingSkeleton rows={3} />
        </View>
      ) : null}
      {notices.isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load updates"
          body={notices.error instanceof Error ? notices.error.message : 'Try again in a moment.'}
          actionLabel="Retry"
          onAction={() => void notices.refetch()}
        />
      ) : null}
      {!notices.isLoading && !notices.isError && items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="You're all caught up"
          body="Order updates, rider assignment, and kitchen delay alerts will show here."
        />
      ) : null}
      {!notices.isLoading && !notices.isError && items.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (!item.readAt) void markRead.mutate(item.id);
              }}
              style={[styles.card, !item.readAt && styles.unread]}>
              <AppText weight="semibold">{item.title}</AppText>
              <AppText muted style={styles.body}>
                {item.body}
              </AppText>
              <AppText muted style={styles.time}>
                {new Date(item.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  unread: { borderColor: colors.primary, backgroundColor: '#FFF7F3' },
  body: { lineHeight: 20 },
  time: { fontSize: 11, marginTop: 4 },
});
