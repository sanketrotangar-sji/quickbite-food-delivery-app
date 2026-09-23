import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { MockPromo } from '@/lib/home-mock';

export function PromoCarousel({ promos }: { promos: MockPromo[] }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 36;
  const gap = 10;

  return (
    <View style={styles.wrap}>
      <AppText heading weight="semibold" style={styles.heading}>
        #SpecialForYou
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + gap}
        contentContainerStyle={styles.row}>
        {promos.map((promo) => (
          <View
            key={promo.id}
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: promo.accent === 'primary' ? colors.primary : colors.primaryDark,
              },
            ]}>
            <View style={styles.copy}>
              <AppText heading style={styles.title}>
                {promo.title}
              </AppText>
              <AppText style={styles.subtitle}>{promo.subtitle}</AppText>
            </View>
            <Image source={{ uri: promo.imageUrl }} style={styles.image} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginHorizontal: -14 },
  heading: { fontSize: 15, color: colors.text, paddingHorizontal: 14 },
  row: { gap: 10, paddingHorizontal: 14 },
  card: {
    height: 148,
    borderRadius: radii.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  copy: { flex: 1, paddingRight: 8, gap: 4 },
  title: { color: colors.white, fontSize: 22 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  image: { width: 128, height: '100%' },
});
