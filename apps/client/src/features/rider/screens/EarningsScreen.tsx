import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Screen } from '@/components/Screen';
import { colors, formatInr, radii, tabBarInset } from '@/constants/theme';
import { earningsBars, earningsSnapshot, recentEarnings, useRiderHistory } from '@/features/rider/use-rider-live';
import type { EarningsRange } from '@/features/rider/rider-content';

const RANGES: { id: EarningsRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

export function EarningsScreen() {
  const historyQuery = useRiderHistory();
  const [range, setRange] = useState<EarningsRange>('today');
  const history = historyQuery.data ?? [];
  const snapshot = earningsSnapshot(history, range);
  const bars = earningsBars(history, range);
  const recent = recentEarnings(history);
  const peak = Math.max(...bars.map((bar) => bar.amount), 1);
  const rangeLabel = RANGES.find((item) => item.id === range)?.label ?? 'Today';
  const hasEarnings = snapshot.deliveries > 0 || snapshot.total > 0;

  return (
    <Screen>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppText heading weight="semibold" style={styles.title}>
          Earnings
        </AppText>
        <View style={styles.segment}>
          {RANGES.map((item) => {
            const on = item.id === range;
            return (
              <Pressable key={item.id} onPress={() => setRange(item.id)} style={[styles.segmentItem, on && styles.segmentOn]}>
                <AppText weight="semibold" style={[styles.segmentLabel, on && styles.segmentLabelOn]}>
                  {item.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {historyQuery.isLoading && !historyQuery.data ? <LoadingSkeleton rows={3} /> : null}
        {historyQuery.isError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load earnings"
            body="Pull to refresh or try again in a moment."
            actionLabel="Try again"
            onAction={() => void historyQuery.refetch()}
          />
        ) : null}
        {!historyQuery.isLoading && !historyQuery.isError ? (
          <View style={styles.panel}>
            <AppText style={styles.heroLabel}>{rangeLabel} earnings</AppText>
            <AppText heading weight="bold" style={styles.heroValue}>
              {formatInr(snapshot.total)}
            </AppText>
            <AppText muted style={styles.heroMeta}>
              {snapshot.deliveries} deliveries · rider pay (not customer delivery fee)
            </AppText>
            {hasEarnings ? (
              <View style={styles.chart}>
                {bars.map((bar) => (
                  <View key={bar.label} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={{ flex: Math.max(peak - bar.amount, 0.01) }} />
                      <View
                        style={[
                          styles.barFill,
                          { flex: Math.max(bar.amount, 0), minHeight: bar.amount > 0 ? 8 : 2 },
                        ]}
                      />
                    </View>
                    <AppText style={styles.barLabel}>{bar.label}</AppText>
                  </View>
                ))}
              </View>
            ) : (
              <AppText muted style={styles.emptyChart}>
                Complete a delivery to see pay, tips, and bonuses here.
              </AppText>
            )}
            <View style={styles.divider} />
            <Line label="Delivery earnings" value={formatInr(snapshot.deliveryPay)} />
            <Line label="Bonuses" value={formatInr(snapshot.bonuses)} />
            <Line label="Tips" value={formatInr(snapshot.tips)} />
            <View style={styles.divider} />
            <AppText weight="semibold" style={styles.where}>
              Where it came from
            </AppText>
            {recent.length === 0 ? (
              <AppText muted style={styles.emptyChart}>
                No delivered trips in history yet.
              </AppText>
            ) : (
              recent.map((row, index) => (
                <View key={row.id} style={[styles.source, index > 0 && styles.sourceBorder]}>
                  <View style={styles.copy}>
                    <AppText weight="semibold">{row.title}</AppText>
                    <AppText muted style={styles.meta}>
                      {row.detail}
                    </AppText>
                  </View>
                  <AppText weight="bold">{formatInr(row.amount)}</AppText>
                </View>
              ))
            )}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText style={styles.lineLabel}>{label}</AppText>
      <AppText weight="semibold">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: tabBarInset + 24, gap: 12 },
  title: { fontSize: 22 },
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  segmentItem: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 13 },
  segmentOn: { backgroundColor: colors.primary },
  segmentLabel: { fontSize: 13, color: colors.textMuted },
  segmentLabelOn: { color: colors.white },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  heroLabel: { color: colors.primary, fontSize: 13 },
  heroValue: { fontSize: 32, color: colors.text },
  heroMeta: { fontSize: 13 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 6, height: '100%' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6, backgroundColor: colors.primary },
  barLabel: { fontSize: 10, color: colors.textMuted },
  emptyChart: { fontSize: 13, lineHeight: 18, marginVertical: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lineLabel: { fontSize: 14 },
  where: { fontSize: 15, marginTop: 2 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  sourceBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  copy: { flex: 1, gap: 2 },
  meta: { fontSize: 12, lineHeight: 16 },
});
