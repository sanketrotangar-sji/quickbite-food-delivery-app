import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressSheet } from '@/components/address/AddressSheet';
import { AppText } from '@/components/AppText';
import { colors, screenTopGap } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';
import { useCart } from '@/hooks/useCart';

export const HERO_CURVE = 22;

export function HomeHero() {
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const { hydrated, selected } = useAddresses();
  const [addressOpen, setAddressOpen] = useState(false);
  const place = !hydrated ? '…' : selected?.area || (selected ? selected.nickname : 'Add address');

  return (
    <View style={[styles.hero, { paddingTop: insets.top + screenTopGap }]}>
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <Image
            source={require('../../../assets/images/logo2.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="QuickBite"
          />
          <AppText style={styles.tagline} numberOfLines={1}>
            Good Food. Brighter Days.
          </AppText>
        </View>
        <Pressable onPress={() => setAddressOpen(true)} style={styles.location} accessibilityLabel="Choose delivery address">
          <View style={styles.locationCopy}>
            <AppText style={styles.locationLabel}>Delivering to</AppText>
            <View style={styles.locationRow}>
              <AppText weight="bold" numberOfLines={1} style={styles.locationValue}>
                {place}
              </AppText>
              <Ionicons name="chevron-down" size={14} color={colors.text} />
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/(customer)/cart')} style={styles.cart} accessibilityLabel="Open cart">
          <Ionicons name="cart" size={22} color={colors.text} />
          {itemCount > 0 ? (
            <View style={styles.badge}>
              <AppText weight="bold" style={styles.badgeText}>
                {itemCount > 9 ? '9+' : itemCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      </View>
      <AddressSheet visible={addressOpen} onClose={() => setAddressOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { width: 118 },
  logo: { width: 112, height: 32 },
  tagline: { color: colors.textMuted, fontSize: 9, marginTop: -2 },
  location: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  locationCopy: { flexShrink: 1, alignItems: 'flex-end' },
  locationLabel: { color: colors.textMuted, fontSize: 10, textAlign: 'right' },
  locationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  locationValue: { color: colors.text, fontSize: 13, flexShrink: 1, textAlign: 'right' },
  cart: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9 },
});
