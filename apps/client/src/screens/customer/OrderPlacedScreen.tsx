import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { openTestCardCheckout, type CheckoutSessionResult } from '@/api/payments';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { colors, formatInr, radii, spacing } from '@/constants/theme';
import { getPaymentPreference } from '@/lib/payment-preference';

function orderCode(id: string) {
  return id.replace(/-/g, '').slice(0, 6).toUpperCase();
}

export function OrderPlacedScreen() {
  const { id, total } = useLocalSearchParams<{ id: string; total?: string }>();
  const paymentMethod = getPaymentPreference();
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState('');
  const amount = total ? Number(total) : NaN;
  const code = id ? orderCode(id) : '——';

  function goTrack(extra?: Record<string, string>) {
    if (!id) {
      router.replace('/(customer)/(tabs)/reorder');
      return;
    }
    router.replace({ pathname: '/(customer)/orders/[id]', params: { id, ...extra } });
  }

  async function onPayCard() {
    if (!id) return;
    setBusy(true);
    setPayError('');
    try {
      const result: CheckoutSessionResult = await openTestCardCheckout(id);
      if (result.status === 'paid' || result.status === 'success') {
        goTrack({ paid: '1' });
        return;
      }
      if (result.status === 'cancelled') {
        setPayError('Payment was cancelled. You can retry or track the order and pay later.');
        return;
      }
      if (result.status === 'dismissed') {
        setPayError('Checkout closed before payment finished. Retry when you are ready.');
        return;
      }
      setPayError(result.message || 'Payment did not complete. Please try again.');
    } catch (error) {
      setPayError(error instanceof Error ? error.message : 'Could not start card checkout.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
        </View>
        <AppText heading weight="bold" style={styles.title}>
          Order placed
        </AppText>
        <AppText muted style={styles.sub}>
          #{code}
          {Number.isFinite(amount) ? ` · ${formatInr(amount)}` : ''}
        </AppText>
        <AppText style={styles.body}>
          {paymentMethod === 'card'
            ? 'Your kitchen has the order. Complete card payment (test) to confirm, or track and pay later.'
            : 'Pay cash on delivery. The kitchen is preparing your order.'}
        </AppText>
      </View>

      {payError ? (
        <View style={styles.errorBox}>
          <AppText style={styles.errorText}>{payError}</AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        {paymentMethod === 'card' ? (
          <>
            <Button
              label={busy ? 'Opening Stripe…' : payError ? 'Retry card payment' : 'Pay with card (test)'}
              onPress={() => void onPayCard()}
              loading={busy}
            />
            <Button label="Track order" variant="ghost" onPress={() => goTrack()} disabled={busy} />
          </>
        ) : (
          <Button label="Track order" onPress={() => goTrack()} />
        )}
        <Button
          label="Back to home"
          variant="ghost"
          onPress={() => router.replace('/(customer)/(tabs)')}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.lg, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 10, marginBottom: 28 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(241, 90, 36, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 28, textAlign: 'center' },
  sub: { fontSize: 15, textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: colors.text, maxWidth: 320 },
  errorBox: {
    backgroundColor: 'rgba(180, 40, 40, 0.08)',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(180, 40, 40, 0.25)',
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.primaryDark, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { gap: 10 },
});
