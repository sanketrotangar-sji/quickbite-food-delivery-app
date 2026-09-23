import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors } from '@/constants/theme';
import type { HomeHighlight } from '@/lib/home-mock';

export const HIGHLIGHT_HEIGHT = 236;

export function HighlightRail({
  highlights,
  contentTop = 0,
}: {
  highlights: HomeHighlight[];
  contentTop?: number;
}) {
  const { width } = useWindowDimensions();

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={width}
      snapToAlignment="start">
      {highlights.map((item) => (
        <Pressable key={item.id} style={{ width, height: HIGHLIGHT_HEIGHT }}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          <View style={styles.scrim} />
          {item.kind === 'video' ? (
            <View style={[styles.playWrap, { top: contentTop }]} pointerEvents="none">
              <View style={styles.play}>
                <Ionicons name="play" size={22} color={colors.white} />
              </View>
            </View>
          ) : (
            <View style={[styles.offerChip, { top: contentTop + 12 }]}>
              <AppText weight="bold" style={styles.offerText}>
                OFFER
              </AppText>
            </View>
          )}
          <View style={styles.copy}>
            <AppText heading style={styles.title}>
              {item.title}
            </AppText>
            <AppText style={styles.subtitle}>{item.subtitle}</AppText>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: HIGHLIGHT_HEIGHT, backgroundColor: colors.primary },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HIGHLIGHT_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  playWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerChip: {
    position: 'absolute',
    left: 14,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  offerText: { color: colors.white, fontSize: 10, letterSpacing: 0.6 },
  copy: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  title: { color: colors.white, fontSize: 20 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
});
