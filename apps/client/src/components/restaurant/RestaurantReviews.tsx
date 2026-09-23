import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { SectionHeader } from '@/components/SectionHeader';
import { colors } from '@/constants/theme';

export function RestaurantReviews({ ratings }: { ratings: number[] }) {
  const [expanded, setExpanded] = useState(false);
  const total = ratings.length;
  const average = total > 0 ? ratings.reduce((sum, value) => sum + value, 0) / total : null;
  const preview = expanded ? ratings.slice(0, 12) : ratings.slice(0, 3);

  return (
    <View style={styles.wrap}>
      <SectionHeader
        title="Ratings & Reviews"
        actionLabel={total > 3 ? (expanded ? 'Show less' : 'See all reviews') : undefined}
        onAction={total > 3 ? () => setExpanded((current) => !current) : undefined}
      />
      {average == null ? (
        <AppText muted>No ratings yet. They show up after a delivered order.</AppText>
      ) : (
        <>
          <AppText heading weight="semibold" style={styles.score}>
            {average.toFixed(1)}
          </AppText>
          <AppText muted style={styles.count}>
            {total} {total === 1 ? 'rating' : 'ratings'}
          </AppText>
          <View style={styles.bars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = ratings.filter((value) => Math.round(value) === star).length;
              return (
                <View key={star} style={styles.barRow}>
                  <AppText style={styles.star}>{star}</AppText>
                  <View style={styles.track}>
                    <View style={{ flex: count, backgroundColor: colors.primary }} />
                    <View style={{ flex: Math.max(total - count, 0) }} />
                  </View>
                  <AppText muted style={styles.barCount}>
                    {count}
                  </AppText>
                </View>
              );
            })}
          </View>
          {preview.map((value, index) => (
            <AppText key={`${value}-${index}`} style={styles.review}>
              Food · {value.toFixed(1)}
            </AppText>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  score: { fontSize: 28 },
  count: { fontSize: 12 },
  bars: { gap: 6, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  star: { width: 12, fontSize: 12 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden', flexDirection: 'row' },
  barCount: { width: 24, fontSize: 12, textAlign: 'right' },
  review: { fontSize: 13, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
});