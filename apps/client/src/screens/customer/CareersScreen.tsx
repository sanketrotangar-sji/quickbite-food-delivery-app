import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { listMyApplications, submitApplication } from '@/api/applications';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radii, screenTopGap, spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { rememberRole } from '@/lib/last-role';
import { hasRole } from '@/types/models';
import type { Application } from '@/types/models';

const VEHICLES = ['Bike', 'Scooter', 'Cycle'] as const;

export function CareersScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind = params.kind === 'rider' || params.kind === 'owner' ? params.kind : null;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {kind === 'rider' ? <RiderForm /> : kind === 'owner' ? <OwnerForm /> : <Chooser />}
    </View>
  );
}

function Chooser() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <Header title="Work with QuickBite" subtitle="Apply to deliver, or open a kitchen. We review the form — no documents." />
      <View style={styles.chooser}>
        <Choice
          icon="bicycle"
          title="Deliver with QuickBite"
          body="Phone, city, and the vehicle you ride."
          onPress={() => router.setParams({ kind: 'rider' })}
        />
        <Choice
          icon="storefront"
          title="Open a restaurant"
          body="Kitchen name, branch, address, and cuisine."
          onPress={() => router.setParams({ kind: 'owner' })}
        />
        <View style={{ height: insets.bottom }} />
      </View>
    </ScrollView>
  );
}

function RiderForm() {
  const { profile, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const applications = useQuery({ queryKey: ['my-applications'], queryFn: listMyApplications });
  const latest = useMemo(() => applications.data?.find((row) => row.kind === 'rider'), [applications.data]);
  const already = hasRole(profile, 'rider');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [city, setCity] = useState('');
  const [vehicle, setVehicle] = useState<(typeof VEHICLES)[number]>('Bike');
  const [owns, setOwns] = useState<'yes' | 'no'>('yes');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const approved = latest?.status === 'approved';
  const pending = latest?.status === 'pending';
  const locked = already || pending || approved;

  useFocusEffect(
    useCallback(() => {
      void applications.refetch();
      void refreshProfile();
    }, [applications.refetch, refreshProfile]),
  );

  useEffect(() => {
    if (!already) return;
    void rememberRole('rider').then(() => router.replace('/(rider)/(tabs)'));
  }, [already]);

  async function submit() {
    if (!phone.trim() || !city.trim()) {
      setFeedback('Phone and city are required.');
      return;
    }
    setLoading(true);
    setFeedback('');
    try {
      await submitApplication('rider', {
        phone: phone.trim(),
        city: city.trim(),
        vehicle_type: vehicle,
        owns_vehicle: owns,
        notes: note.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setFeedback('Application sent. A QuickBite admin will review this.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Header title="Deliver with QuickBite" subtitle="Tell us how you will ride. No document upload." />
      <View style={styles.sheet}>
        <StatusLine application={latest} already={already} alreadyText="Opening your rider home." />
        {feedback ? <AppText style={styles.status}>{feedback}</AppText> : null}
        {latest && (pending || approved || already) ? <ApplicationSummary application={latest} /> : null}
        {approved && !already ? (
          <AppText style={styles.status}>Approved. Checking rider access on this account.</AppText>
        ) : null}
        {locked ? null : (
          <>
            <TextField label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <TextField label="City / area" value={city} onChangeText={setCity} placeholder="Margao" />
            <AppText weight="medium" muted style={styles.label}>
              Vehicle
            </AppText>
            <View style={styles.chips}>
              {VEHICLES.map((option) => (
                <Chip key={option} label={option} active={vehicle === option} onPress={() => setVehicle(option)} />
              ))}
            </View>
            <AppText weight="medium" muted style={styles.label}>
              Do you own the vehicle?
            </AppText>
            <View style={styles.chips}>
              <Chip label="Yes" active={owns === 'yes'} onPress={() => setOwns('yes')} />
              <Chip label="No" active={owns === 'no'} onPress={() => setOwns('no')} />
            </View>
            <TextField label="Note (optional)" value={note} onChangeText={setNote} />
            <Button label="Submit application" onPress={() => void submit()} loading={loading} />
          </>
        )}
        {approved && !already ? (
          <Button
            label="Open rider home"
            onPress={() => {
              void refreshProfile();
            }}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

function OwnerForm() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const applications = useQuery({ queryKey: ['my-applications'], queryFn: listMyApplications });
  const latest = useMemo(
    () => applications.data?.find((row) => row.kind === 'restaurant_owner'),
    [applications.data],
  );
  const already = hasRole(profile, 'restaurant_owner');
  const approved = latest?.status === 'approved';
  const pending = latest?.status === 'pending';
  const locked = already || pending || approved;
  const [restaurantName, setRestaurantName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [description, setDescription] = useState('');
  const [fssai, setFssai] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function submit() {
    if (!restaurantName.trim() || !address.trim()) {
      setFeedback('Restaurant name and address are required.');
      return;
    }
    setLoading(true);
    setFeedback('');
    try {
      await submitApplication('restaurant_owner', {
        restaurant_name: restaurantName.trim(),
        branch_name: branchName.trim(),
        cuisine: cuisine.trim(),
        address: address.trim(),
        phone: phone.trim(),
        description: description.trim(),
        fssai_number: fssai.trim(),
        owner_name: profile?.full_name?.trim() ?? '',
      });
      await queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setFeedback('Application sent. If approved, sign in on the partner dashboard.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Header title="Open a restaurant" subtitle="We create the first branch when an admin approves this." />
      <View style={styles.sheet}>
        <StatusLine
          application={latest}
          already={already}
          alreadyText="You already run a kitchen. Use the web dashboard to add branches."
        />
        {feedback ? <AppText style={styles.status}>{feedback}</AppText> : null}
        <TextField label="Restaurant name" value={restaurantName} onChangeText={setRestaurantName} editable={!locked} />
        <TextField label="Branch (e.g. Margao)" value={branchName} onChangeText={setBranchName} editable={!locked} />
        <TextField label="Cuisine" value={cuisine} onChangeText={setCuisine} editable={!locked} />
        <TextField label="Full address" value={address} onChangeText={setAddress} editable={!locked} />
        <TextField label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} editable={!locked} />
        <TextField label="Short description" value={description} onChangeText={setDescription} editable={!locked} />
        <TextField label="FSSAI number (optional)" value={fssai} onChangeText={setFssai} editable={!locked} />
        {locked ? null : <Button label="Submit application" onPress={() => void submit()} loading={loading} />}
      </View>
    </ScrollView>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { paddingTop: insets.top + screenTopGap }]}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <AppText heading style={styles.heroTitle}>
        {title}
      </AppText>
      <AppText muted style={styles.heroSub}>{subtitle}</AppText>
    </View>
  );
}

function ApplicationSummary({ application }: { application: Application }) {
  const payload = (application.payload ?? {}) as Record<string, unknown>;
  const lines = [
    ['City', payload.city],
    ['Phone', payload.phone],
    ['Vehicle', payload.vehicle_type],
    ['Owns vehicle', payload.owns_vehicle],
  ].filter((row): row is [string, string] => typeof row[1] === 'string' && row[1].trim().length > 0);

  if (lines.length === 0) return null;
  return (
    <View style={styles.summary}>
      {lines.map(([label, value]) => (
        <View key={label} style={styles.summaryRow}>
          <AppText muted style={styles.meta}>
            {label}
          </AppText>
          <AppText weight="semibold">{value}</AppText>
        </View>
      ))}
    </View>
  );
}

function StatusLine({
  application,
  already,
  alreadyText,
}: {
  application: Application | undefined;
  already: boolean;
  alreadyText: string;
}) {
  if (already) {
    return <AppText style={styles.status}>{alreadyText}</AppText>;
  }
  if (!application) return null;
  return (
    <AppText style={styles.status}>
      Latest: {application.status}
      {application.review_note ? ` — ${application.review_note}` : ''}
    </AppText>
  );
}

function Choice({
  icon,
  title,
  body,
  onPress,
}: {
  icon: 'bicycle' | 'storefront';
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.choice}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText heading weight="semibold" style={{ fontSize: 16 }}>
          {title}
        </AppText>
        <AppText muted style={styles.meta}>
          {body}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function Chip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, active && styles.chipActive, disabled && { opacity: 0.6 }]}>
      <AppText weight="semibold" style={{ color: active ? colors.white : colors.text, fontSize: 14 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  heroTitle: { color: colors.text, fontSize: 22, marginTop: 4 },
  heroSub: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  chooser: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  sheet: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  status: {
    backgroundColor: colors.primarySoft,
    color: colors.text,
    padding: 12,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  summary: { gap: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
