import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FlowHeader } from '@/components/FlowHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, radii } from '@/constants/theme';
import { useRiderNotices, useMarkNoticeRead } from '@/features/rider/use-rider-live';
import { useAuth } from '@/hooks/useAuth';
import {
  getPushNotificationsEnabled,
  setPushNotificationsEnabled,
} from '@/notifications/NotificationProvider';

export function PersonalScreen() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!profile?.id || saving) return;
    setSaving(true);
    try {
      const { updateProfile } = await import('@/api/profiles');
      await updateProfile(profile.id, { full_name: name.trim(), phone: phone.trim() || null });
      await refreshProfile();
      Alert.alert('Saved', 'Your profile was updated.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <FlowHeader title="Personal information" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Email" value={profile?.email ?? ''} editable={false} />
        <Button label={saving ? 'Saving…' : 'Save'} onPress={() => void onSave()} disabled={saving} />
      </ScrollView>
    </Screen>
  );
}

export function VehicleScreen() {
  const { profile, refreshProfile } = useAuth();
  const [kind, setKind] = useState(profile?.vehicle_label ?? 'Bike');
  const [plate, setPlate] = useState(profile?.plate ?? '');
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!profile?.id || saving) return;
    setSaving(true);
    try {
      const { supabase } = await import('@/api/supabaseClient');
      const { error } = await supabase
        .from('profiles')
        .update({ vehicle_label: kind.trim() || null, plate: plate.trim() || null })
        .eq('id', profile.id);
      if (error) throw error;
      await refreshProfile();
      Alert.alert('Saved', 'Vehicle details updated.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <FlowHeader title="Vehicle details" />
      <ScrollView contentContainerStyle={styles.form}>
        <TextField label="Vehicle" value={kind} onChangeText={setKind} />
        <TextField label="Number plate" value={plate} onChangeText={setPlate} autoCapitalize="characters" />
        <Button label={saving ? 'Saving…' : 'Save'} onPress={() => void onSave()} disabled={saving} />
      </ScrollView>
    </Screen>
  );
}

export function DocumentsScreen() {
  const docs = [
    ['Driving licence', 'On file'],
    ['Registration', 'On file'],
    ['Profile photo', 'On file'],
  ];
  return (
    <Screen>
      <FlowHeader title="Documents" />
      <View style={styles.form}>
        {docs.map(([title, state]) => (
          <View key={title} style={styles.doc}>
            <AppText weight="semibold">{title}</AppText>
            <AppText weight="semibold" style={styles.ok}>
              {state}
            </AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

export function PreferencesScreen() {
  const [alerts, setAlerts] = useState(false);
  const [savingAlerts, setSavingAlerts] = useState(true);

  useEffect(() => {
    void getPushNotificationsEnabled()
      .then(setAlerts)
      .catch(() => setAlerts(false))
      .finally(() => setSavingAlerts(false));
  }, []);

  async function toggleAlerts() {
    if (savingAlerts) return;
    setSavingAlerts(true);
    try {
      const enabling = !alerts;
      const next = await setPushNotificationsEnabled(enabling);
      setAlerts(next);
      if (enabling && !next) {
        Alert.alert('Notifications are off', 'Allow notifications in your device settings, then try again.', [
          { text: 'Not now' },
          {
            text: 'Open settings',
            onPress: () => {
              void import('@/lib/permissions').then((m) => m.openSystemAppSettings());
            },
          },
        ]);
      }
    } catch (error) {
      Alert.alert(
        'Could not update notifications',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setSavingAlerts(false);
    }
  }

  return (
    <Screen>
      <FlowHeader title="Preferences" />
      <View style={styles.form}>
        <Pressable onPress={() => void toggleAlerts()} disabled={savingAlerts} style={styles.doc}>
          <View>
            <AppText weight="semibold">Notifications</AppText>
            <AppText muted style={styles.note}>
              New requests and pickup updates
            </AppText>
          </View>
          <AppText weight="semibold" style={styles.ok}>
            {savingAlerts ? 'Saving…' : alerts ? 'On' : 'Off'}
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            void import('@/lib/permissions').then((m) => m.openSystemAppSettings());
          }}
          style={styles.doc}
        >
          <View>
            <AppText weight="semibold">Open system settings</AppText>
            <AppText muted style={styles.note}>
              Location and notification permissions
            </AppText>
          </View>
          <AppText weight="semibold" style={styles.ok}>
            Open
          </AppText>
        </Pressable>
        <View style={styles.doc}>
          <AppText weight="semibold">Language</AppText>
          <AppText muted>English</AppText>
        </View>
      </View>
    </Screen>
  );
}

export function NotificationsScreen() {
  const notices = useRiderNotices();
  const markRead = useMarkNoticeRead();
  const items = notices.data ?? [];

  return (
    <Screen>
      <FlowHeader title="Notifications" />
      {notices.isLoading ? (
        <View style={styles.list}>
          <LoadingSkeleton rows={3} />
        </View>
      ) : null}
      {!notices.isLoading && items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="You're caught up" body="New requests and payout notes will show up here." />
      ) : null}
      {!notices.isLoading && items.length > 0 ? (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                if (!item.readAt) void markRead.mutate(item.id);
              }}
              style={[styles.noteCard, !item.readAt && styles.unread]}>
              <View style={styles.doc}>
                <AppText weight="semibold">{item.title}</AppText>
                {!item.readAt ? <View style={styles.dot} /> : null}
              </View>
              <AppText muted style={styles.body}>
                {item.body}
              </AppText>
              <AppText muted style={styles.when}>
                {new Date(item.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
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
  form: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  note: { fontSize: 12, lineHeight: 16 },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  ok: { color: colors.success },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  unread: { borderColor: colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  body: { fontSize: 13, lineHeight: 18 },
  when: { fontSize: 12 },
});
