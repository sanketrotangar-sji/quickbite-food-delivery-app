import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { ORDER_STATUS_META, type OrderStatus } from '@/constants/orderStatus';
import { radii } from '@/constants/theme';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  return (
    <View style={[styles.pill, { backgroundColor: meta.background }]}>
      <AppText weight="semibold" style={[styles.label, { color: meta.color }]}>
        {meta.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  label: { fontSize: 12 },
});
