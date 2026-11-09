import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FlowHeader } from '@/components/FlowHeader';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, radii } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  getPushNotificationsEnabled,
  setPushNotificationsEnabled,
} from '@/notifications/NotificationProvider';
import { toast } from 'sonner-native';
import { showDialog } from '@/lib/dialog';

export function PersonalScreen() {
  const { profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  async function onSave() {
    if (!profile?.id || saving) return;
    setSaving(true);
    try {
      const { updateProfile } = await import('@quickbite/api/mobile/profiles');
      await updateProfile(profile.id, { full_name: name.trim(), phone: phone.trim() || null });
      await refreshProfile();
      toast.success('Saved', { description: 'Your profile was updated.' });
    } catch (error) {
      toast.error('Could not save', { description: error instanceof Error ? error.message : 'Try again.' });
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
      const { updateProfile } = await import('@quickbite/api/mobile/profiles');
      await updateProfile(profile.id, {
        vehicle_label: kind.trim() || null,
        plate: plate.trim() || null,
      });
      await refreshProfile();
      toast.success('Saved', { description: 'Vehicle details updated.' });
    } catch (error) {
      toast.error('Could not save', { description: error instanceof Error ? error.message : 'Try again.' });
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
        showDialog('Notifications are off', 'Allow notifications in your device settings, then try again.', [
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
      showDialog(
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
});
