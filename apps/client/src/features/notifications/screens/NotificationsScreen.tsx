import { FlashList } from '@shopify/flash-list';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { FlowHeader } from '@/components/FlowHeader';
import { QueryView } from '@/components/QueryView';
import { Screen } from '@/components/Screen';
import { colors, radii } from '@/constants/theme';
import { useMarkMyNotificationRead, useMyNotifications } from '@/features/notifications/hooks';

export function NotificationsScreen() {
  const notices = useMyNotifications();
  const markRead = useMarkMyNotificationRead();
  const items = notices.data ?? [];

  return (
    <Screen>
      <FlowHeader title="Notifications" />
      <QueryView
        loading={notices.isLoading}
        error={notices.isError ? notices.error : null}
        onRetry={() => void notices.refetch()}
        errorTitle="Could not load updates"
        empty={items.length === 0}
        emptyState={{
          icon: 'notifications-outline',
          title: "You're all caught up",
          body: 'Order updates, rider assignment, and kitchen delay alerts will show here.',
        }}>
        <FlashList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Gap}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                if (!item.readAt) void markRead.mutate(item.id);
              }}
              style={[styles.card, !item.readAt && styles.unread]}>
              <AppText weight="semibold">{item.title}</AppText>
              <AppText muted style={styles.body}>
                {item.body}
              </AppText>
              <AppText variant="caption" muted style={styles.time}>
                {new Date(item.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </AppText>
            </Pressable>
          )}
        />
      </QueryView>
    </Screen>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  gap: { height: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  unread: { borderColor: colors.primary, backgroundColor: colors.primaryWash },
  body: { lineHeight: 20 },
  time: { marginTop: 4 },
});
