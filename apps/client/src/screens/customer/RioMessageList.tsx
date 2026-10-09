import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { RefObject } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { RioChatMessage } from '@/api/rioChat';
import { AppText } from '@/components/AppText';
import { colors, radii } from '@/constants/theme';
import type { HomeDish } from '@/lib/home-catalog';
import { RIO_STARTERS } from '@/lib/rio-thread';
import { RioCards } from '@/screens/customer/RioCards';

const RIO_MARK = require('../../../assets/images/rio-mark.png');
const RIO_ACCENT = colors.primary;
const RIO_TEXT = colors.text;
const RIO_MUTED = colors.textMuted;

/** Composer + send row; keep scroll padding in sync. */
export const COMPOSER_DOCK_MAX = 112;

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
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.messageList}
      contentContainerStyle={[styles.thread, { paddingBottom: COMPOSER_DOCK_MAX + 12 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      onScrollBeginDrag={onBlurInput}
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
      {messages.map((message) => (
        <View
          key={message.id}
          style={[styles.messageRow, message.from === 'you' ? styles.messageRowYou : styles.messageRowRio]}>
          {message.from === 'rio' ? (
            <View style={styles.avatarSmall}>
              <Image source={RIO_MARK} style={styles.avatarSmallImage} accessibilityLabel="RIO" />
            </View>
          ) : (
            <View style={styles.rowSpacer} />
          )}
          <View style={[styles.messageBody, message.from === 'you' && styles.messageBodyYou]}>
            <View style={[styles.bubble, message.from === 'you' ? styles.youBubble : styles.rioBubble]}>
              <RioBubbleText text={message.text} you={message.from === 'you'} />
            </View>
            <View style={[styles.metaRow, message.from === 'you' && styles.metaRowYou]}>
              <AppText style={styles.time}>{formatMessageTime(message.at)}</AppText>
              {message.from === 'you' ? (
                <Ionicons name="checkmark-done" size={12} color={RIO_MUTED} style={styles.check} />
              ) : null}
            </View>
            {message.cards && message.cards.length > 0 ? (
              <RioCards
                cards={message.cards}
                liked={liked}
                onToggleLike={onToggleLike}
                onAddDish={onAddDish}
                onConfirm={() => onConfirm(message)}
                onAddAddress={() => router.push('/(customer)/addresses')}
                confirming={thinking}
                confirmHidden={Boolean(message.settled)}
              />
            ) : null}
            {message.from === 'rio' && message.cards && message.cards.length > 0 && !message.conflict ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                {chipsForMessage(message, activeOrderId, onSend, onAddDish).map((chip, chipIndex) => (
                  <Pressable
                    key={`${chip.label}-${chipIndex}`}
                    onPress={chip.onPress}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                    <AppText weight="semibold" style={styles.chipText}>
                      {chip.label}
                    </AppText>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {message.conflict && !message.settled ? (
              <View style={styles.conflict}>
                <Pressable
                  onPress={() => onKeepCart(message)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                  <AppText weight="semibold" style={styles.chipText}>
                    Keep cart
                  </AppText>
                </Pressable>
                <Pressable
                  onPress={() => onClearAndAdd(message)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                  <AppText weight="semibold" style={styles.chipText}>
                    Clear and add
                  </AppText>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      ))}

      {!started ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
          {RIO_STARTERS.map((prompt) => (
            <Pressable
              key={prompt}
              disabled={thinking}
              onPress={() =>
                onSend(
                  prompt === 'Help & support'
                    ? 'I need help with my latest order. Check its status and open a support ticket if something is wrong.'
                    : prompt,
                )
              }
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <AppText weight="semibold" style={styles.chipText}>
                {prompt}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {thinking ? (
        <View style={styles.messageRow}>
          <View style={styles.avatarSmall}>
            <Image source={RIO_MARK} style={styles.avatarSmallImage} accessibilityLabel="RIO" />
          </View>
          <View style={[styles.bubble, styles.rioBubble]}>
            <AppText style={styles.thinking}>{statusHint}</AppText>
          </View>
        </View>
      ) : null}
    </ScrollView>
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
  const chips: { label: string; onPress: () => void }[] = [];
  const cards = message.cards ?? [];
  const menu = cards.find((card) => card.kind === 'menu');
  const places = cards.find((card) => card.kind === 'restaurants');
  const orderCard = cards.find((card) => card.kind === 'order');

  if (menu || places) {
    const shownIds = [
      ...(menu ? [menu.restaurantId] : []),
      ...(places?.places.map((place) => place.id) ?? []),
    ].filter(Boolean);
    chips.push({
      label: 'Show more',
      onPress: () =>
        onSend(
          shownIds.length
            ? `Show more options like these, different from restaurants ${shownIds.slice(0, 8).join(', ')}`
            : 'Show more options like these',
        ),
    });
  }
  if (menu && menu.items[0]) {
    const first = menu.items[0];
    chips.push({
      label: 'Order this',
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
      label: 'View restaurant',
      onPress: () => router.push(`/(customer)/restaurant/${menu.restaurantId}`),
    });
  } else if (places && places.places[0]) {
    chips.push({
      label: 'View restaurant',
      onPress: () => router.push(`/(customer)/restaurant/${places.places[0].id}`),
    });
  }
  if (orderCard) {
    chips.push({
      label: 'Track my order',
      onPress: () => router.push(`/(customer)/orders/${orderCard.id}`),
    });
  } else if (activeOrderId) {
    chips.push({
      label: 'Track my order',
      onPress: () => router.push(`/(customer)/orders/${activeOrderId}`),
    });
  }
  chips.push({ label: 'Help & support', onPress: () => onSend('I need help with my order') });
  return chips;
}

function RioBubbleText({ text, you }: { text: string; you: boolean }) {
  if (you) {
    return <AppText style={[styles.bubbleText, styles.youText]}>{text}</AppText>;
  }
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <AppText style={styles.bubbleText}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <AppText key={`${index}-${part}`} weight="bold" style={styles.bubbleText}>
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
  thread: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageRowRio: { justifyContent: 'flex-start' },
  messageRowYou: { justifyContent: 'flex-end' },
  messageBody: { flex: 1, gap: 6, maxWidth: '88%' },
  messageBodyYou: { flex: 0, maxWidth: '82%', alignItems: 'flex-end' },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarSmallImage: { width: 28, height: 28 },
  rowSpacer: { flex: 1 },
  bubble: { borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' },
  rioBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  youBubble: { alignSelf: 'flex-end', backgroundColor: RIO_ACCENT },
  bubbleText: { fontSize: 14, lineHeight: 20, color: RIO_TEXT },
  youText: { color: colors.white },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  metaRowYou: { alignSelf: 'flex-end' },
  time: { fontSize: 10, color: RIO_MUTED },
  check: { marginTop: 1 },
  thinking: { fontSize: 13, color: RIO_MUTED, fontStyle: 'italic' },
  conflict: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRail: { gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: RIO_TEXT, fontSize: 12 },
  pressed: { opacity: 0.72 },
});
