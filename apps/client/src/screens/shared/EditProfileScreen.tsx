import { router } from 'expo-router';
import { Children, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptManagerInvites } from '@/api/applications';
import { updateProfile } from '@/api/profiles';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { NoteSheet } from '@/components/NoteSheet';
import { ProfileListItem } from '@/components/ProfileListItem';
import { TextField } from '@/components/TextField';
import { colors, radii, screenTopGap, tabBarInset } from '@/constants/theme';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { displayNickname } from '@/lib/addresses';
import { hasRole, isPartner } from '@/types/models';

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : (parts[0]?.[1] ?? '');
  return `${first}${last}`.toUpperCase();
}

export function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile } = useAuth();
  const { addresses, selected } = useAddresses();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [note, setNote] = useState<{ title: string; body: string } | null>(null);
  const rider = hasRole(profile, 'rider');
  const partner = isPartner(profile);
  const avatarSource = profile?.full_name?.trim() || profile?.email || 'Guest';
  const addressSubtitle = selected
    ? `${displayNickname(selected)} · ${selected.area}`
    : 'Save home, work, and other places';

  async function onSave() {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile(profile.id, { full_name: fullName.trim(), phone: phone.trim() || null });
      await refreshProfile();
      setEditing(false);
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function onAcceptInvites() {
    setAccepting(true);
    try {
      const count = await acceptManagerInvites();
      await refreshProfile();
      if (count > 0) {
        setNote({
          title: 'Invite accepted',
          body: 'Open the partner dashboard on the web to run that branch.',
        });
      } else {
        setNote({
          title: 'No pending invites',
          body: 'Ask the restaurant owner to send an invite to this email.',
        });
      }
    } catch (error) {
      Alert.alert('Could not accept', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: tabBarInset + 28 }}>
        <View style={[styles.hero, { paddingTop: insets.top + screenTopGap }]}>
          <View style={styles.avatar}>
            <AppText heading weight="bold" style={styles.avatarText}>
              {initialsFromName(avatarSource)}
            </AppText>
          </View>
          <AppText heading style={styles.name}>
            {profile?.full_name?.trim() || 'Add your name'}
          </AppText>
          <AppText style={styles.email}>{profile?.email}</AppText>
          <AppText style={styles.email}>{profile?.phone?.trim() || 'Add a phone number'}</AppText>
          <Pressable
            onPress={() => {
              setFullName(profile?.full_name ?? '');
              setPhone(profile?.phone ?? '');
              setEditing((current) => !current);
            }}
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}>
            <AppText weight="semibold" style={styles.editText}>
              {editing ? 'Close' : 'Edit profile'}
            </AppText>
          </Pressable>
        </View>

        {editing ? (
          <View style={styles.editCard}>
            <TextField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextField label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <Button label="Save changes" onPress={() => void onSave()} loading={saving} />
          </View>
        ) : null}

        <View style={styles.sheet}>
          <Group title="Account">
            <ProfileListItem
              icon="location-outline"
              title="Saved addresses"
              subtitle={addressSubtitle}
              onPress={() => router.push(addresses.length ? '/(customer)/addresses' : '/(customer)/addresses?add=1')}
            />
            <ProfileListItem
              icon="heart-outline"
              title="Favorites"
              subtitle="Kitchens and dishes you saved"
              onPress={() => router.push('/(customer)/favorites')}
            />
            <ProfileListItem
              icon="receipt-outline"
              title="Order history"
              subtitle="Active and past orders"
              onPress={() => router.push('/(customer)/(tabs)/reorder')}
            />
          </Group>

          <Group title="Payments and offers">
            <ProfileListItem
              icon="cash-outline"
              title="Payment methods"
              subtitle="Cash on delivery"
              onPress={() =>
                setNote({
                  title: 'Payment methods',
                  body: 'Cash is available at checkout. UPI, cards, and wallets are not open yet.',
                })
              }
            />
            <ProfileListItem
              icon="pricetag-outline"
              title="Offers and coupons"
              subtitle="No saved coupons"
              onPress={() =>
                setNote({
                  title: 'Offers',
                  body: 'You don’t have any coupons saved. Kitchen offers show on Explore, and checkout charges the menu total.',
                })
              }
            />
          </Group>

          <Group title="Support">
            <ProfileListItem
              icon="help-circle-outline"
              title="Help and support"
              subtitle="Orders, delivery, and your account"
              onPress={() =>
                setNote({
                  title: 'Help and support',
                  body: 'Open Orders to follow a live delivery. For anything else, write to help@quickbite.app.',
                })
              }
            />
            <ProfileListItem
              icon="settings-outline"
              title="Settings"
              subtitle="Alerts and app preferences"
              onPress={() =>
                setNote({
                  title: 'Settings',
                  body: 'QuickBite sends push alerts for order and delivery updates. Your device may ask for notification permission.',
                })
              }
            />
            <ProfileListItem
              icon="information-circle-outline"
              title="About QuickBite"
              subtitle="Good food. Brighter days."
              onPress={() =>
                setNote({
                  title: 'About QuickBite',
                  body: 'QuickBite brings kitchens around you to your door. Good food. Brighter days.',
                })
              }
            />
          </Group>

          <Group title="Work with QuickBite">
            <ProfileListItem
              icon="bicycle-outline"
              title={rider ? 'Deliver with QuickBite' : 'Apply as a rider'}
              subtitle={
                rider
                  ? 'You are a rider. Open deliveries to pick up orders.'
                  : 'Apply with your phone, city, and vehicle.'
              }
              onPress={() =>
                rider ? router.push('/(rider)/(tabs)') : router.push('/(customer)/careers?kind=rider')
              }
            />
            <ProfileListItem
              icon="storefront-outline"
              title={partner ? 'Partner kitchen' : 'Open a restaurant'}
              subtitle={
                partner
                  ? 'Use the web dashboard to add branches and hire managers.'
                  : 'Tell us the kitchen, address, and cuisine.'
              }
              onPress={() => router.push('/(customer)/careers?kind=owner')}
            />
            <ProfileListItem
              icon="mail-outline"
              title="Manager invite"
              subtitle={accepting ? 'Checking invites…' : 'Accept an invite sent to this email'}
              onPress={() => {
                if (!accepting) void onAcceptInvites();
              }}
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
      <NoteSheet
        visible={note !== null}
        title={note?.title ?? ''}
        body={note?.body ?? ''}
        onClose={() => setNote(null)}
      />
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const items = Children.toArray(children);
  return (
    <View style={styles.group}>
      <AppText heading weight="semibold" style={styles.sectionTitle}>
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
  hero: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { color: colors.white, fontSize: 24 },
  name: { color: colors.text, fontSize: 22, textAlign: 'center' },
  email: { color: colors.textMuted, fontSize: 13 },
  edit: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editText: { color: colors.primary, fontSize: 13 },
  pressed: { opacity: 0.72 },
  editCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    gap: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheet: { paddingTop: 16, paddingHorizontal: 16, gap: 16 },
  group: { gap: 8 },
  sectionTitle: { fontSize: 16 },
  groupCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 60 },
});
