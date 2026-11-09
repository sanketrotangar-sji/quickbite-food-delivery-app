import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { toast } from 'sonner-native';

import { userFacingMessage } from '@quickbite/api/errors';
import {
  searchDishesByPhoto,
  type VisionMatchedDish,
  type VisionSearchResponse,
} from '@quickbite/api/vision';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PressableScale } from '@/components/PressableScale';
import { RemoteImage } from '@/components/RemoteImage';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { colors, formatInr, radii, spacing } from '@/constants/theme';
import {
  buildLocalVisionFallback,
  buildSamplePhotoOptions,
  visionDishToHomeDish,
  type SamplePhotoOption,
} from '@/features/explore/photo-search';
import { useLocationStore } from '@/features/location/store';
import type { HomeDish } from '@/lib/home-catalog';
import { queryKeys } from '@/lib/query-keys';

async function pickWebImageAsDataUrl(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

/**
 * Safely attempt to launch `expo-image-picker` on native Android/iOS if the native module
 * is compiled into the installed binary; returns `null` without crashing if unavailable.
 */
async function tryNativeImagePicker(useCamera: boolean): Promise<string | null> {
  if (Platform.OS === 'web') return pickWebImageAsDataUrl();
  try {
    // Dynamic require so pre-built APKs without ExponentImagePicker native module never crash
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker = require('expo-image-picker') as {
      requestCameraPermissionsAsync?: () => Promise<{ status: string }>;
      requestMediaLibraryPermissionsAsync?: () => Promise<{ status: string }>;
      launchCameraAsync?: (opts: Record<string, unknown>) => Promise<{
        canceled?: boolean;
        assets?: Array<{ base64?: string | null; mimeType?: string | null }>;
      }>;
      launchImageLibraryAsync?: (opts: Record<string, unknown>) => Promise<{
        canceled?: boolean;
        assets?: Array<{ base64?: string | null; mimeType?: string | null }>;
      }>;
    };

    const pickerOpts = {
      mediaTypes: ['images'],
      quality: 0.65,
      base64: true,
      allowsEditing: true,
    };

    if (useCamera && typeof ImagePicker.launchCameraAsync === 'function') {
      const perm = await ImagePicker.requestCameraPermissionsAsync?.();
      if (perm && perm.status !== 'granted') {
        toast.error('Camera permission needed', {
          description: 'Allow camera access or pick a dish photo from the gallery below.',
        });
        return null;
      }
      const res = await ImagePicker.launchCameraAsync(pickerOpts);
      const asset = res?.assets?.[0];
      if (!res?.canceled && asset?.base64) {
        const mime = asset.mimeType || 'image/jpeg';
        return `data:${mime};base64,${asset.base64}`;
      }
      return null;
    }

    if (typeof ImagePicker.launchImageLibraryAsync === 'function') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync?.();
      if (perm && perm.status !== 'granted') {
        toast.error('Photo access needed', {
          description: 'Allow photo access or pick one of the live dish photos below.',
        });
        return null;
      }
      const res = await ImagePicker.launchImageLibraryAsync(pickerOpts);
      const asset = res?.assets?.[0];
      if (!res?.canceled && asset?.base64) {
        const mime = asset.mimeType || 'image/jpeg';
        return `data:${mime};base64,${asset.base64}`;
      }
      return null;
    }
  } catch {
    // Native module not linked in this APK build; fall through to live catalog photo gallery
  }
  return null;
}

export function PhotoSearchSheet({
  visible,
  vegOnly,
  allDishes,
  onClose,
  onAddDish,
  onOpenRestaurant,
  onApplyTextQuery,
}: {
  visible: boolean;
  vegOnly: boolean;
  allDishes: HomeDish[];
  onClose: () => void;
  onAddDish: (dish: HomeDish) => void;
  onOpenRestaurant: (restaurantId: string) => void;
  onApplyTextQuery: (query: string) => void;
}) {
  const point = useLocationStore((s) => s.point);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [result, setResult] = useState<VisionSearchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const samplePhotos = useMemo(() => buildSamplePhotoOptions(allDishes), [allDishes]);
  const galleryDishes = useMemo(
    () => allDishes.filter((d) => /^https?:\/\//i.test(d.imageUrl)).slice(0, 12),
    [allDishes],
  );

  const scanMutation = useMutation({
    mutationKey: queryKeys.vision.all,
    mutationFn: async (input: {
      imageDataUrl?: string | null;
      imageUrl?: string | null;
      dishNameHint?: string | null;
    }) => {
      try {
        const res = await searchDishesByPhoto({
          imageDataUrl: input.imageDataUrl ?? null,
          imageUrl: input.imageUrl ?? null,
          dishNameHint: input.dishNameHint ?? null,
          lat: point?.latitude ?? null,
          lng: point?.longitude ?? null,
          vegOnly,
          limit: 8,
        });
        if (res.dishes.length > 0 || !input.dishNameHint) {
          return res;
        }
        const localFallback = buildLocalVisionFallback(input.dishNameHint, allDishes, vegOnly);
        return {
          ...res,
          dishes: localFallback.dishes,
        };
      } catch (err) {
        if (input.dishNameHint) {
          return buildLocalVisionFallback(input.dishNameHint, allDishes, vegOnly);
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      setResult(data);
      setErrorMsg(null);
    },
    onError: (err) => {
      const msg = userFacingMessage(err, 'Could not analyze that photo. Please try again.');
      setErrorMsg(msg);
      toast.error('Photo scan failed', { description: msg });
    },
  });

  async function handleChoosePhoto(useCamera = false) {
    setErrorMsg(null);
    const dataUrl = await tryNativeImagePicker(useCamera);
    if (dataUrl) {
      setPreviewUri(dataUrl);
      scanMutation.mutate({ imageDataUrl: dataUrl });
      return;
    }

    if (Platform.OS !== 'web') {
      // Automatically scan the first real food photo if native camera module isn't in the current dev build
      const first = samplePhotos[0];
      if (first?.imageUrl) {
        handleSelectSample(first);
      } else {
        toast.info('Tap any food photo below to scan it with Vision AI.');
      }
    }
  }

  function handleSelectSample(sample: SamplePhotoOption) {
    setErrorMsg(null);
    setPreviewUri(sample.imageUrl || null);
    scanMutation.mutate({
      imageUrl: sample.imageUrl || null,
      dishNameHint: sample.dishHint,
    });
  }

  function handleSelectGalleryDish(dish: HomeDish) {
    setErrorMsg(null);
    setPreviewUri(dish.imageUrl);
    scanMutation.mutate({
      imageUrl: dish.imageUrl,
      dishNameHint: dish.name,
    });
  }

  function handleReset() {
    setPreviewUri(null);
    setResult(null);
    setErrorMsg(null);
  }

  const analysis = result?.analysis;
  const matchedDishes = result?.dishes ?? [];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Find dishes by photo"
      subtitle="Snap, pick, or tap a food photo to discover similar dishes near you">
      <View style={styles.container}>
        <View style={styles.actionsRow}>
          <Button
            label={previewUri ? 'Pick another photo' : 'Camera / Gallery'}
            onPress={() => void handleChoosePhoto(false)}
            loading={scanMutation.isPending}
            leading={<Ionicons name="camera-outline" size={18} color={colors.white} />}
            style={styles.flexBtn}
          />
          {result ? (
            <Button label="Clear" variant="ghost" onPress={handleReset} />
          ) : null}
        </View>

        <View style={styles.samplesBlock}>
          <AppText weight="semibold" variant="caption" muted>
            Quick-scan a dish photo with Vision AI:
          </AppText>
          <View style={styles.sampleRow}>
            {samplePhotos.map((sample) => (
              <PressableScale
                key={sample.id}
                onPress={() => handleSelectSample(sample)}
                style={styles.sampleChip}
                accessibilityRole="button"
                accessibilityLabel={`Scan sample ${sample.label}`}>
                <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                <AppText weight="semibold" variant="caption" style={styles.sampleLabel} numberOfLines={1}>
                  {sample.label}
                </AppText>
              </PressableScale>
            ))}
          </View>
        </View>

        {galleryDishes.length > 0 && !result && !scanMutation.isPending ? (
          <View style={styles.samplesBlock}>
            <AppText weight="semibold" variant="caption" muted>
              Or tap a food photo to find similar dishes:
            </AppText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoStrip}>
              {galleryDishes.map((dish) => (
                <PressableScale
                  key={dish.id}
                  onPress={() => handleSelectGalleryDish(dish)}
                  style={styles.photoTile}
                  accessibilityRole="button"
                  accessibilityLabel={`Scan photo of ${dish.name}`}>
                  <RemoteImage
                    uri={dish.imageUrl}
                    slot="thumb"
                    fallbackText={dish.name}
                    style={styles.photoTileImg}
                  />
                  <AppText weight="semibold" variant="caption" numberOfLines={1} style={styles.photoTileCaption}>
                    {dish.name}
                  </AppText>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {scanMutation.isPending ? (
          <View style={styles.loadingWrap} accessibilityLabel="Analyzing food photo" accessibilityState={{ busy: true }}>
            <AppText weight="semibold" variant="body" style={styles.loadingTitle}>
              Analyzing food photo with Vision AI…
            </AppText>
            <Skeleton variant="list" rows={2} />
          </View>
        ) : null}

        {errorMsg && !scanMutation.isPending ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Couldn't analyze photo"
            body={errorMsg}
            actionLabel="Try a sample photo"
            onAction={() => {
              if (samplePhotos[0]) handleSelectSample(samplePhotos[0]);
            }}
          />
        ) : null}

        {analysis && !scanMutation.isPending ? (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHead}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.previewThumb} contentFit="cover" />
              ) : null}
              <View style={styles.analysisCopy}>
                <View style={styles.badgeRow}>
                  <View style={[styles.dietBadge, analysis.isVeg ? styles.vegBadge : styles.nonVegBadge]}>
                    <AppText weight="bold" variant="caption" style={analysis.isVeg ? styles.vegText : styles.nonVegText}>
                      {analysis.isVeg ? 'VEG' : 'NON-VEG'}
                    </AppText>
                  </View>
                  <View style={styles.catBadge}>
                    <AppText weight="semibold" variant="caption" style={styles.catText}>
                      {analysis.category}
                    </AppText>
                  </View>
                  <AppText muted variant="caption">
                    {Math.round(analysis.confidence * 100)}% match
                  </AppText>
                </View>
                <AppText heading weight="bold" variant="bodyLg">
                  {analysis.isFood ? analysis.dishName : 'Not recognized as food'}
                </AppText>
                <AppText muted variant="meta" numberOfLines={2}>
                  {analysis.caption}
                </AppText>
              </View>
            </View>

            {analysis.tags.length > 0 ? (
              <View style={styles.tagsWrap}>
                {analysis.tags.map((tag: string) => (
                  <View key={tag} style={styles.tagPill}>
                    <AppText weight="semibold" variant="caption" style={styles.tagText}>
                      #{tag}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}

            {analysis.isFood && analysis.dishName ? (
              <PressableScale
                onPress={() => {
                  onApplyTextQuery(analysis.dishName);
                  onClose();
                }}
                style={styles.searchLink}
                accessibilityRole="button">
                <Ionicons name="search-outline" size={15} color={colors.primary} />
                <AppText weight="semibold" variant="meta" style={styles.searchLinkText}>
                  Search "{analysis.dishName}" in Explore
                </AppText>
              </PressableScale>
            ) : null}
          </View>
        ) : null}

        {result && !scanMutation.isPending && matchedDishes.length === 0 ? (
          <EmptyState
            icon="restaurant-outline"
            title={result.noticeCode === 'NOT_FOOD_IMAGE' ? 'No dish spotted' : 'No nearby matches'}
            body={
              result.notice ??
              'No open kitchens within 8 km currently have a matching dish available.'
            }
          />
        ) : null}

        {matchedDishes.length > 0 && !scanMutation.isPending ? (
          <View style={styles.matchesSection}>
            <AppText heading weight="semibold" variant="bodyLg">
              Similar dishes near you ({matchedDishes.length})
            </AppText>
            <View style={styles.dishList}>
              {matchedDishes.map((item: VisionMatchedDish) => (
                <View key={item.id} style={styles.dishRow}>
                  <PressableScale
                    onPress={() => {
                      onClose();
                      onOpenRestaurant(item.restaurantId);
                    }}
                    style={styles.dishMain}>
                    <RemoteImage
                      uri={item.imageUrl}
                      slot="thumb"
                      fallbackText={item.name}
                      style={styles.dishImage}
                    />
                    <View style={styles.dishInfo}>
                      <AppText weight="bold" variant="body" numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <AppText muted variant="caption" numberOfLines={1}>
                        {item.restaurantName}
                        {item.distanceKm !== null ? ` · ${item.distanceKm} km` : ''}
                      </AppText>
                      <AppText weight="bold" variant="meta" style={styles.priceText}>
                        {formatInr(item.price)}
                      </AppText>
                    </View>
                  </PressableScale>
                  <PressableScale
                    haptic
                    onPress={() => onAddDish(visionDishToHomeDish(item))}
                    style={styles.addBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.name} to cart`}>
                    <Ionicons name="add" size={18} color={colors.white} />
                    <AppText weight="bold" variant="caption" style={styles.addBtnText}>
                      Add
                    </AppText>
                  </PressableScale>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, paddingBottom: spacing.md },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flexBtn: { flex: 1 },
  samplesBlock: { gap: spacing.xs },
  sampleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryTintBorder,
  },
  sampleLabel: { color: colors.primary, maxWidth: 150 },
  photoStrip: { gap: spacing.xs, paddingVertical: 4 },
  photoTile: {
    width: 92,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingBottom: 4,
  },
  photoTileImg: { width: 92, height: 68 },
  photoTileCaption: { paddingHorizontal: 6, paddingTop: 4 },
  loadingWrap: { gap: spacing.sm, paddingVertical: spacing.xs },
  loadingTitle: { color: colors.primary },
  analysisCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  analysisHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  previewThumb: { width: 64, height: 64, borderRadius: radii.md, backgroundColor: colors.border },
  analysisCopy: { flex: 1, gap: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dietBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sm },
  vegBadge: { backgroundColor: colors.vegSoft },
  nonVegBadge: { backgroundColor: colors.dangerSoft },
  vegText: { color: colors.veg },
  nonVegText: { color: colors.danger },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
  },
  catText: { color: colors.primary },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tagText: { color: colors.text },
  searchLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 4,
  },
  searchLinkText: { color: colors.primary },
  matchesSection: { gap: spacing.sm },
  dishList: { gap: spacing.xs },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  dishMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dishImage: { width: 56, height: 56, borderRadius: radii.sm },
  dishInfo: { flex: 1, gap: 2 },
  priceText: { color: colors.primary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  addBtnText: { color: colors.white },
});
