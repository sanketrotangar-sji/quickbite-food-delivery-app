import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, type RefObject } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { RioChatMessage } from '@quickbite/api/mobile/rioChat';
import { AppText } from '@/components/AppText';
import { colors, elevation, radii } from '@/constants/theme';
import type { HomeDish } from '@/lib/home-catalog';
import { RIO_STARTERS } from '@/lib/rio-thread';
import { RioCards } from '@/features/rio/screens/RioCards';

const RIO_MARK = require('../../../../assets/images/rio-mark.png');
const RIO_ACCENT = colors.primaryDark;
const RIO_TEXT = colors.text;
const RIO_MUTED = colors.textMuted;

/** Composer + send row; keep scroll padding in sync. */
export const COMPOSER_DOCK_MAX = 112;

const STARTER_META: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; hint: string }
> = {
  'Find me dinner': { icon: 'restaurant-outline', hint: 'Top kitchens open right now' },
  'Something under ₹200': { icon: 'pricetag-outline', hint: 'Budget-friendly meals nearby' },
  "I'm craving biryani": { icon: 'flame-outline', hint: 'Aromatic biryanis & specials' },
  'Help & support': { icon: 'headset-outline', hint: 'Track or report an order issue' },
};

type RioMessageListProps = {
  messages: RioChatMessage[];
  started: boolean;
  thinking: boolean;
  statusHint: string;
  liked: ReadonlySet<string>;
  onToggleLike: (id: string) => void;
  onAddDish: (dish: HomeDish) => void;
  onConfirm: (message: RioChatMessage) => void;
  onSend: (prompt: string) => void;
  onKeepCart: (message: RioChatMessage) => void;
  onClearAndAdd: (message: RioChatMessage) => void;
  activeOrderId: string | null;
  scrollRef: RefObject<ScrollView | null>;
  onBlurInput: () => void;
};

export function RioMessageList({
  messages,
  started,
  thinking,
  statusHint,
  liked,
  onToggleLike,
  onAddDish,
  onConfirm,
  onSend,
  onKeepCart,
  onClearAndAdd,
  activeOrderId,
  scrollRef,
  onBlurInput,
}: RioMessageListProps) {
  const latestCardMessageId = [...messages]
    .reverse()
    .find((m) => m.from === 'rio' && m.cards && m.cards.length > 0)?.id;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.messageList}
      contentContainerStyle={[styles.thread, { paddingBottom: COMPOSER_DOCK_MAX + 16 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      onScrollBeginDrag={onBlurInput}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      {messages.map((message) => {
        const isYou = message.from === 'you';
        const hasCards = Boolean(message.cards && message.cards.length > 0);
        const showFollowUpChips =
          !isYou && hasCards && !message.conflict && !thinking && message.id === latestCardMessageId;

        return (
          <View key={message.id} style={styles.turnGroup}>
            <View style={[styles.messageRow, isYou ? styles.messageRowYou : styles.messageRowRio]}>
              {!isYou ? (
                <View style={styles.avatarSmall}>
                  <Image source={RIO_MARK} style={styles.avatarSmallImage} accessibilityLabel="RIO" />
                </View>
              ) : (
                <View style={styles.rowSpacer} />
              )}
              <View style={[styles.messageBody, isYou && styles.messageBodyYou]}>
                <View
                  style={[
                    styles.bubble,
                    isYou ? styles.youBubble : [styles.rioBubble, elevation.card],
                  ]}>
                  <RioBubbleText text={message.text} you={isYou} />
                </View>
                <View style={[styles.metaRow, isYou && styles.metaRowYou]}>
                  <AppText variant="caption" style={styles.time}>
                    {formatMessageTime(message.at)}
                  </AppText>
                  {isYou ? (
                    <Ionicons name="checkmark-done" size={12} color={RIO_MUTED} style={styles.check} />
                  ) : null}
                </View>
              </View>
            </View>

            {hasCards ? (
              <View style={styles.fullWidthBlock}>
                <RioCards
                  cards={message.cards!}
                  liked={liked}
                  onToggleLike={onToggleLike}
                  onAddDish={onAddDish}
                  onConfirm={() => onConfirm(message)}
                  onAddAddress={() => router.push('/(customer)/addresses')}
                  confirming={thinking}
                  confirmHidden={Boolean(message.settled)}
                />
              </View>
            ) : null}

            {showFollowUpChips ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRail}>
                {chipsForMessage(message, activeOrderId, onSend, onAddDish).map((chip, chipIndex) => (
                  <Pressable
                    key={`${chip.label}-${chipIndex}`}
                    onPress={chip.onPress}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                    {chip.icon ? <Ionicons name={chip.icon} size={13} color={RIO_ACCENT} /> : null}
                    <AppText weight="semibold" variant="meta" style={styles.chipText}>
                      {chip.label}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {message.conflict && !message.settled ? (
              <View style={[styles.conflictCard, elevation.card]}>
                <View style={styles.conflictHeader}>
                  <Ionicons name="swap-horizontal-outline" size={16} color={RIO_ACCENT} />
                  <AppText weight="semibold" variant="meta" style={styles.conflictTitle}>
                    Replace items from {message.conflict.currentRestaurant}?
                  </AppText>
                </View>
                <View style={styles.conflictActions}>
                  <Pressable
                    onPress={() => onKeepCart(message)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                    <AppText weight="semibold" variant="meta" style={styles.chipText}>
                      Keep current cart
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => onClearAndAdd(message)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.chipPrimary, pressed && styles.pressed]}>
                    <AppText weight="semibold" variant="meta" style={styles.chipPrimaryText}>
                      Clear & add {message.conflict.itemName}
                    </AppText>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      {!started ? (
        <View style={styles.starterSection}>
          <AppText weight="semibold" variant="meta" muted style={styles.starterHeading}>
            Try asking RIO
          </AppText>
          <View style={styles.starterGrid}>
            {RIO_STARTERS.map((prompt) => {
              const meta = STARTER_META[prompt] ?? {
                icon: 'sparkles-outline' as const,
                hint: 'Ask RIO anything',
              };
              return (
                <Pressable
                  key={prompt}
                  disabled={thinking}
                  accessibilityRole="button"
                  accessibilityLabel={prompt}
                  onPress={() =>
                    onSend(
                      prompt === 'Help & support'
                        ? 'I need help with my latest order. Check its status and open a support ticket if something is wrong.'
                        : prompt,
                    )
                  }
                  style={({ pressed }) => [styles.starterCard, elevation.card, pressed && styles.pressed]}>
                  <View style={styles.starterIconWrap}>
                    <Ionicons name={meta.icon} size={16} color={RIO_ACCENT} />
                  </View>
                  <AppText weight="semibold" variant="meta" style={styles.starterTitle}>
                    {prompt}
                  </AppText>
                  <AppText variant="caption" muted numberOfLines={2}>
                    {meta.hint}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {thinking ? <RioThinkingBubble statusHint={statusHint} /> : null}
    </ScrollView>
  );
}

function RioThinkingBubble({ statusHint }: { statusHint: string }) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 650,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.messageRow}>
      <View style={styles.avatarSmall}>
        <Image source={RIO_MARK} style={styles.avatarSmallImage} accessibilityLabel="RIO" />
      </View>
      <View style={[styles.bubble, styles.rioBubble, styles.thinkingBubble, elevation.card]}>
        <Animated.View style={[styles.thinkingBadge, dotStyle]}>
          <Ionicons name="sparkles" size={13} color={RIO_ACCENT} />
        </Animated.View>
        <AppText variant="meta" style={styles.thinking}>
          {statusHint}
        </AppText>
      </View>
    </View>
  );
}

function formatMessageTime(at: number) {
  return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

function chipsForMessage(
  message: RioChatMessage,
  activeOrderId: string | null,
  onSend: (prompt: string) => void,
  onAddDish: (dish: HomeDish) => void,
) {
  const chips: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }[] = [];
  const cards = message.cards ?? [];
  const menu = cards.find((card) => card.kind === 'menu');
  const places = cards.find((card) => card.kind === 'restaurants');
  const orderCard = cards.find((card) => card.kind === 'order');

  if (menu && menu.items[0]) {
    const first = menu.items[0];
    chips.push({
      label: `Add ${first.name}`,
      icon: 'add-circle-outline',
      onPress: () => {
        const dish: HomeDish = {
          id: first.id,
          name: first.name,
          restaurantName: menu.restaurantName,
          restaurantId: menu.restaurantId,
          category: first.category ?? 'Menu',
          price: first.price,
          imageUrl: first.imageUrl ?? '',
          veg: first.isVeg,
        };
        onAddDish(dish);
      },
    });
    chips.push({
      label: 'View kitchen',
      icon: 'storefront-outline',
      onPress: () => router.push(`/(customer)/restaurant/${menu.restaurantId}`),
    });
  } else if (places && places.places[0]) {
    chips.push({
      label: `Open ${places.places[0].name}`,
      icon: 'storefront-outline',
      onPress: () => router.push(`/(customer)/restaurant/${places.places[0].id}`),
    });
  }

  if (menu || places) {
    const shownIds = [
      ...(menu ? [menu.restaurantId] : []),
      ...(places?.places.map((place) => place.id) ?? []),
    ].filter(Boolean);
    chips.push({
      label: 'More like this',
      icon: 'refresh-outline',
      onPress: () =>
        onSend(
          shownIds.length
            ? `Show more options like these, different from restaurants ${shownIds.slice(0, 8).join(', ')}`
            : 'Show more options like these',
        ),
    });
  }

  if (orderCard) {
    chips.push({
      label: 'Track order',
      icon: 'navigate-outline',
      onPress: () => router.push(`/(customer)/orders/${orderCard.id}`),
    });
  } else if (activeOrderId) {
    chips.push({
      label: 'Track order',
      icon: 'navigate-outline',
      onPress: () => router.push(`/(customer)/orders/${activeOrderId}`),
    });
  }
  chips.push({
    label: 'Help & support',
    icon: 'headset-outline',
    onPress: () => onSend('I need help with my order'),
  });
  return chips;
}

function RioBubbleText({ text, you }: { text: string; you: boolean }) {
  if (you) {
    return (
      <AppText variant="body" style={[styles.bubbleText, styles.youText]}>
        {text}
      </AppText>
    );
  }
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return renderInlineBold(lines[0] ?? text, styles.bubbleText);
  }

  return (
    <View style={styles.paragraphStack}>
      {lines.map((line, lineIdx) => {
        const bulletMatch = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
        if (bulletMatch) {
          const marker = /^\d/.test(bulletMatch[1]) ? bulletMatch[1] : '•';
          return (
            <View key={`line-${lineIdx}`} style={styles.bulletRow}>
              <AppText weight="bold" variant="body" style={styles.bulletMarker}>
                {marker}
              </AppText>
              <View style={styles.bulletCopy}>{renderInlineBold(bulletMatch[2], styles.bubbleText)}</View>
            </View>
          );
        }
        return <View key={`line-${lineIdx}`}>{renderInlineBold(line, styles.bubbleText)}</View>;
      })}
    </View>
  );
}

function renderInlineBold(content: string, textStyle: object) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return (
    <AppText variant="body" style={textStyle}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <AppText key={`${index}-${part}`} weight="bold" variant="body" style={textStyle}>
            {part.slice(2, -2)}
          </AppText>
        ) : (
          part
        ),
      )}
    </AppText>
  );
}

const styles = StyleSheet.create({
  messageList: { flex: 1 },
  thread: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 14 },
  turnGroup: { gap: 8 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageRowRio: { justifyContent: 'flex-start' },
  messageRowYou: { justifyContent: 'flex-end' },
  messageBody: { flex: 1, gap: 4, maxWidth: '88%' },
  messageBodyYou: { flex: 0, maxWidth: '82%', alignItems: 'flex-end' },
  fullWidthBlock: { paddingLeft: 0 },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarSmallImage: { width: 28, height: 28 },
  rowSpacer: { flex: 1 },
  bubble: {
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  rioBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  youBubble: {
    alignSelf: 'flex-end',
    backgroundColor: RIO_ACCENT,
    borderBottomRightRadius: 6,
  },
  bubbleText: { color: RIO_TEXT },
  youText: { color: colors.white },
  paragraphStack: { gap: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  bulletMarker: { color: RIO_ACCENT, minWidth: 14 },
  bulletCopy: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  metaRowYou: { alignSelf: 'flex-end' },
  time: { color: RIO_MUTED },
  check: { marginTop: 1 },
  thinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  thinkingBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thinking: { color: RIO_MUTED },
  conflictCard: {
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primaryTintBorder,
    backgroundColor: colors.primaryWash,
  },
  conflictHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  conflictTitle: { color: RIO_TEXT, flex: 1 },
  conflictActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRail: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: RIO_TEXT },
  chipPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    borderRadius: radii.pill,
    backgroundColor: RIO_ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipPrimaryText: { color: colors.white },
  starterSection: { gap: 8, marginTop: 4 },
  starterHeading: { paddingHorizontal: 2 },
  starterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  starterCard: {
    width: '48%',
    flexGrow: 1,
    gap: 4,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  starterIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  starterTitle: { color: RIO_TEXT },
  pressed: { opacity: 0.72 },
});
