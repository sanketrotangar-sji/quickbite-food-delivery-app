import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radii, spacing } from '@/constants/theme';
import { defaultNickname, type AddressDraft, type AddressLabel, type SavedAddress } from '@/lib/addresses';

const LABELS: { id: AddressLabel; title: string }[] = [
  { id: 'home', title: 'Home' },
  { id: 'work', title: 'Work' },
  { id: 'other', title: 'Other' },
];

export function AddressForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: SavedAddress | null;
  submitLabel: string;
  onSubmit: (draft: AddressDraft) => void | Promise<void>;
}) {
  const [label, setLabel] = useState<AddressLabel>(initial?.label ?? 'home');
  const [nickname, setNickname] = useState(initial?.label === 'other' ? initial.nickname : '');
  const [line, setLine] = useState(initial?.line ?? '');
  const [area, setArea] = useState(initial?.area ?? '');
  const [landmark, setLandmark] = useState(initial?.landmark ?? '');
  const [lat, setLat] = useState<number | undefined>(initial?.lat);
  const [lng, setLng] = useState<number | undefined>(initial?.lng);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function useCurrentLocation() {
    setError('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Allow location access to attach a precise delivery pin.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLat(position.coords.latitude);
      setLng(position.coords.longitude);
    } catch {
      setError('Could not get your location. Check location services and try again.');
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    const nextLine = line.trim();
    const nextArea = area.trim();
    const nextNickname = label === 'other' ? nickname.trim() : defaultNickname(label);
    if (!nextLine || !nextArea) {
      setError('Add the house details and the area so the rider can find you.');
      return;
    }
    if (!nextNickname) {
      setError('Give this address a short name, like Hostel or Parents.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        label,
        nickname: nextNickname,
        line: nextLine,
        area: nextArea,
        landmark: landmark.trim(),
        lat,
        lng,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this address. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.chips}>
        {LABELS.map((option) => {
          const active = option.id === label;
          return (
            <Pressable
              key={option.id}
              onPress={() => setLabel(option.id)}
              style={[styles.chip, active && styles.chipOn]}>
              <AppText weight="semibold" style={{ color: active ? colors.white : colors.text, fontSize: 13 }}>
                {option.title}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {label === 'other' ? (
        <TextField
          label="Save as"
          value={nickname}
          onChangeText={setNickname}
          placeholder="Hostel, Parents, Gym"
          autoCapitalize="words"
        />
      ) : null}
      <TextField
        label="House / flat / street"
        value={line}
        onChangeText={setLine}
        placeholder="204, Palm Residency, Church Street"
        autoCapitalize="words"
      />
      <TextField
        label="Area"
        value={area}
        onChangeText={setArea}
        placeholder="Margao, Goa"
        autoCapitalize="words"
      />
      <TextField
        label="Landmark (optional)"
        value={landmark}
        onChangeText={setLandmark}
        placeholder="Opposite the chapel"
        autoCapitalize="sentences"
      />
      <Pressable
        accessibilityRole="button"
        disabled={locating}
        onPress={() => void useCurrentLocation()}
        style={({ pressed }) => [styles.location, pressed && !locating && styles.locationPressed]}>
        <View style={[styles.pinIcon, lat != null && lng != null && styles.pinIconSet]}>
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name={lat != null && lng != null ? 'checkmark' : 'navigate-outline'}
              size={18}
              color={lat != null && lng != null ? colors.white : colors.primary}
            />
          )}
        </View>
        <View style={styles.locationCopy}>
          <AppText weight="semibold">{locating ? 'Finding your location…' : 'Use current location'}</AppText>
          <AppText muted style={styles.locationMeta}>
            {lat != null && lng != null
              ? `Delivery pin set · ${lat.toFixed(5)}, ${lng.toFixed(5)}`
              : 'No precise delivery pin set'}
          </AppText>
        </View>
      </Pressable>
      {error ? <AppText style={styles.error}>{error}</AppText> : null}
      <Button label={submitLabel} loading={saving} onPress={() => void save()} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  location: {
    minHeight: 64,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationPressed: { opacity: 0.78 },
  pinIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  pinIconSet: { backgroundColor: colors.success },
  locationCopy: { flex: 1, gap: 2 },
  locationMeta: { fontSize: 12 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
