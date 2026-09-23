import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Children, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setRiderDuty } from '@/api/rider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProfileListItem } from '@/components/ProfileListItem';
import { colors, radii, screenTopGap, tabBarInset } from '@/constants/theme';
import { RiderStatsRow } from '@/features/rider/components/RiderStatsRow';
import { stopRiderTracking } from '@/features/rider/rider-tracking';
import { pickActive, todayStats, useRiderOrders } from '@/features/rider/use-rider-live';
import { useAuth } from '@/hooks/useAuth';
import { greetingName } from '@/lib/home-mock';
import { rememberRole } from '@/lib/last-role';

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R';
  const first = parts[0]?.[0] ?? 'R';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function RiderProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile, signOut } = useAuth();
  const orders = useRiderOrders();
  const active = pickActive(orders.data?.mine ?? []);
  const stats = todayStats(orders.data?.history ?? [], active);
  const name = profile?.full_name?.trim() || greetingName(profile?.full_name, profile?.email);
  const vehicle = [profile?.vehicle_label, profile?.plate].filter(Boolean).join(' · ') || 'Vehicle on file';

  function switchToCustomer() {
    if (active) {
      Alert.alert(
        'Finish this delivery first',
        'You already accepted an order. Stay on the rider app until it is delivered or cancelled.',
      );
      return;
    }
    if (!profile?.id) return;
    void (async () => {
      try {
        if (profile.is_online) {
          await setRiderDuty(false);
          await stopRiderTracking();
          await refreshProfile();
        }
        await rememberRole('customer');
        router.replace('/(customer)/(tabs)');
      } catch (error) {
        Alert.alert('Could not switch', error instanceof Error ? error.message : 'Try again.');
      }
    })();
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarInset + 24 }}>
        <View style={[styles.hero, { paddingTop: insets.top + screenTopGap }]}>
          <View style={styles.avatar}>
            <AppText heading weight="bold" style={styles.avatarText}>
              {initialsFrom(name)}
            </AppText>
          </View>
          <AppText heading style={styles.name}>
            {name}
          </AppText>
          <AppText style={styles.meta}>{profile?.email}</AppText>
          <AppText weight="semibold" style={styles.rating}>
            {stats.rating} rating
          </AppText>
        </View>
        <View style={styles.pad}>
          <RiderStatsRow stats={stats} />
          <Group title="Account">
            <ProfileListItem icon="person-outline" title="Personal information" subtitle="Name, phone, and email" onPress={() => router.push('/(rider)/personal')} />
            <ProfileListItem icon="bicycle-outline" title="Vehicle details" subtitle={vehicle} onPress={() => router.push('/(rider)/vehicle')} />
            <ProfileListItem icon="document-text-outline" title="Documents" subtitle="Licence and registration on file" onPress={() => router.push('/(rider)/documents')} />
          </Group>
          <Group title="Preferences">
            <ProfileListItem icon="notifications-outline" title="Notifications" subtitle="New requests and order updates" onPress={() => router.push('/(rider)/preferences')} />
            <ProfileListItem icon="language-outline" title="Language" subtitle="English" onPress={() => router.push('/(rider)/preferences')} />
          </Group>
          <Group title="Support">
            <ProfileListItem icon="help-circle-outline" title="Help and support" subtitle="Pickup, drop, and pay" onPress={() => router.push('/(rider)/help')} />
            <ProfileListItem icon="alert-circle-outline" title="Report an issue" subtitle="Something went wrong on a trip" onPress={() => router.push('/(rider)/report')} />
          </Group>
          <Group title="Also on QuickBite">
            <ProfileListItem
              icon="fast-food-outline"
              title="Order on QuickBite"
              subtitle={active ? 'Finish your delivery before ordering' : 'Switch to the customer app'}
              onPress={switchToCustomer}
            />
          </Group>
          <Button
            label="Log out"
            variant="ghost"
            onPress={() => {
              Alert.alert('Log out?', 'You can sign back in anytime.', [
                { text: 'Stay' },
                { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
              ]);
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <View style={styles.group}>
      <AppText heading weight="semibold" style={styles.section}>
        {title}
      </AppText>
      <View style={styles.groupCard}>
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { alignItems: 'center', paddingHorizontal: 16, gap: 4 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: colors.white, fontSize: 24 },
  name: { fontSize: 22, textAlign: 'center' },
  meta: { color: colors.textMuted, fontSize: 13 },
  rating: { color: colors.primary, fontSize: 13, marginBottom: 8 },
  pad: { paddingHorizontal: 16, gap: 16 },
  group: { gap: 8 },
  section: { fontSize: 16 },
  groupCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 60 },
});
