import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { errorCopy } from '@/lib/error-copy';
import { useIsOnline } from '@/lib/network';

type EmptyCopy = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
};

type Props = {
  loading: boolean;
  error?: unknown;
  /** True when the request succeeded but returned nothing to show. */
  empty?: boolean;
  onRetry?: () => void;
  skeleton?: ReactNode;
  emptyState?: EmptyCopy;
  errorTitle?: string;
  children: ReactNode;
};

/** Loading → error/offline → empty → content, the same way on every screen. */
export function QueryView({
  loading,
  error,
  empty,
  onRetry,
  skeleton,
  emptyState,
  errorTitle = "Couldn't load this",
  children,
}: Props) {
  const online = useIsOnline();

  if (loading) {
    return (
      <View style={styles.pad} accessibilityState={{ busy: true }}>
        {skeleton ?? <Skeleton variant="list" rows={3} />}
      </View>
    );
  }

  if (error) {
    const copy = online ? errorCopy(error, errorTitle) : errorCopy(new Error('Network request failed'));
    return (
      <EmptyState
        icon={online ? 'alert-circle-outline' : 'cloud-offline-outline'}
        title={copy.title}
        body={copy.message}
        actionLabel={onRetry ? 'Try again' : undefined}
        onAction={onRetry}
      />
    );
  }

  if (empty && emptyState) return <EmptyState {...emptyState} />;

  return <>{children}</>;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16 },
});
