import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { HomeHighlight } from '@/lib/home-mock';

const ROTATE_MS = 4000;

export function PromoBanner({
  offers,
  onOrder,
}: {
  offers: HomeHighlight[];
  onOrder: (offer: HomeHighlight) => void;
}) {
  const cards = offers.length > 0 ? offers : [];
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);

  const offerIds = cards.map((card) => card.id).join('|');

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
  }, [offerIds]);

  useEffect(() => {
    if (cards.length < 2) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % cards.length;
      indexRef.current = next;
      setIndex(next);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [cards.length, offerIds]);

  if (cards.length === 0) return null;

  const offer = cards[index] ?? cards[0];
  if (!offer) return null;

  return (
    <View style={styles.card}>
      {offer.imageUrl ? <Image source={{ uri: offer.imageUrl }} style={styles.image} /> : <View style={styles.image} />}
      <View style={styles.scrim} />
      <View style={styles.body}>
        <View style={styles.copy}>
          {/* {offer.badge ? (
            <View style={styles.badge}>
              <AppText weight="bold" style={styles.badgeText}>
                {offer.badge}
              </AppText>
            </View>
          ) : null} */}
          <AppText heading weight="bold" style={styles.title} numberOfLines={2}>
            {offer.title}
          </AppText>
          {offer.subtitle ? (
            <AppText style={styles.subtitle} numberOfLines={2}>
              {offer.subtitle}
            </AppText>
          ) : null}
          {offer.restaurantName ? (
            <AppText weight="semibold" style={styles.kitchen} numberOfLines={1}>
              {offer.restaurantName}
            </AppText>
          ) : null}
          <Pressable
            onPress={() => onOrder(offer)}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
            accessibilityRole="button"
            accessibilityLabel={`${offer.ctaLabel} at ${offer.restaurantName || 'restaurant'}`}>
            <AppText weight="bold" style={styles.ctaText}>
              {offer.ctaLabel}
            </AppText>
            <Ionicons name="arrow-forward" size={14} color={colors.white} />
          </Pressable>
        </View>
        {cards.length > 1 ? (
          <View style={styles.dots}>
            {cards.map((card, dotIndex) => (
              <Pressable
                key={card.id}
                onPress={() => {
                  indexRef.current = dotIndex;
                  setIndex(dotIndex);
                }}
                style={[styles.dot, dotIndex === index && styles.dotOn]}
                accessibilityLabel={`Offer ${dotIndex + 1}`}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 168,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.secondary,
  },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: 168 },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 14, 10, 0.52)',
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: 4,
    maxWidth: '78%',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  badgeText: { color: colors.white, fontSize: 10, letterSpacing: 0.3 },
  title: { color: colors.white, fontSize: 20, lineHeight: 24 },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16 },
  kitchen: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 2 },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: { color: colors.white, fontSize: 12 },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotOn: {
    width: 16,
    backgroundColor: colors.white,
  },
});
