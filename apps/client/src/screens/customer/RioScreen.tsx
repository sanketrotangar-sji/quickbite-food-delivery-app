import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, useKeyboardState } from 'react-native-keyboard-controller';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { askRio, type RioCard, type RioConflict, type RioMenuItem } from '@/api/rio';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { colors, fonts, radii, tabBarInset } from '@/constants/theme';
import { cartQueryKey } from '@/hooks/useCart';
import { ordersQueryKey, useOrders } from '@/hooks/useOrders';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { useSavedHearts } from '@/hooks/useSavedHearts';
import { formatDeliveryAddress } from '@/lib/addresses';
import { RioCards } from '@/screens/customer/RioCards';

type ChatMessage = {
  id: string;
  from: 'rio' | 'you';
  text: string;
  cards?: RioCard[];
  conflict?: RioConflict | null;
  settled?: boolean;
};

const STARTERS = ['Find me dinner', 'Something under ₹200', "I'm craving biryani"];

function greetingMessage(): ChatMessage {
  return {
    id: 'hello',
    from: 'rio',
    text: "Hey! I'm RIO. Tell me your mood or a craving, and I'll find something to order.",
  };
}

function threadKey(userId: string) {
  return `qb.rio.chat.${userId}`;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ChatMessage>;
  return typeof row.id === 'string' && (row.from === 'rio' || row.from === 'you') && typeof row.text === 'string';
}

function parseThread(raw: string | null): ChatMessage[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const messages = data.filter(isChatMessage);
    if (messages.length === 0) return null;
    if (messages[0]?.id !== 'hello') return [greetingMessage(), ...messages];
    return messages;
  } catch {
    return null;
  }
}

function orderIdsIn(messages: ChatMessage[]) {
  const ids = new Set<string>();
  for (const message of messages) {
    for (const card of message.cards ?? []) {
      if (card.kind === 'order') ids.add(card.id);
    }
  }
  return ids;
}

export function RioScreen() {
  const { session, loading } = useAuth();
  const hearts = useSavedHearts();
  const { selected } = useAddresses();
  const orders = useOrders();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const busy = useRef(false);
  const threadGen = useRef(0);
  const userId = session?.user.id ?? null;
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([greetingMessage()]);
  const started = messages.some((message) => message.id !== 'hello');
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const restPadding = keyboardVisible ? 8 : tabBarInset;

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    if (!userId) {
      setMessages([greetingMessage()]);
      setHydrated(true);
      return;
    }
    void AsyncStorage.getItem(threadKey(userId)).then((raw) => {
      if (cancelled) return;
      setMessages(parseThread(raw) ?? [greetingMessage()]);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !hydrated) return;
    void AsyncStorage.setItem(threadKey(userId), JSON.stringify(messages));
  }, [hydrated, messages, userId]);

  useEffect(() => {
    if (!hydrated) return;
    const ids = orderIdsIn(messages);
    if (ids.size === 0) return;
    const delivered = (orders.data ?? []).some((order) => ids.has(order.id) && order.status === 'delivered');
    if (!delivered) return;
    threadGen.current += 1;
    setMessages([greetingMessage()]);
  }, [hydrated, messages, orders.data]);

  useEffect(() => {
    if (!keyboardVisible) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(timer);
  }, [keyboardVisible]);

  function startNewChat() {
    threadGen.current += 1;
    busy.current = false;
    setThinking(false);
    setDraft('');
    setMessages([greetingMessage()]);
  }

  async function send(
    prompt: string,
    action?: { type: 'confirm_order' } | { type: 'replace_cart'; menuItemId: string },
  ): Promise<boolean> {
    const text = prompt.trim();
    if (busy.current) return false;
    if (!text && !action) return false;
    if (!session) return false;

    const gen = threadGen.current;
    const you: ChatMessage | null = text
      ? { id: `you-${Date.now()}`, from: 'you', text }
      : action?.type === 'confirm_order'
        ? { id: `you-${Date.now()}`, from: 'you', text: 'Confirm order' }
        : null;
    const history = [...messages, ...(you ? [you] : [])].filter((message) => message.id !== 'hello');
    if (you) setMessages((current) => [...current, you]);
    setDraft('');
    busy.current = true;
    setThinking(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);

    const lastCards = [...history].reverse().find((message) => message.cards && message.cards.length > 0)?.cards;
    try {
      const reply = await askRio({
        messages: history.map((message) => ({
          role: message.from === 'you' ? 'user' : 'assistant',
          content: message.text,
        })),
        deliveryAddress: selected ? formatDeliveryAddress(selected) : null,
        deliveryAddressId: selected?.id ?? null,
        deliveryLat: selected?.lat ?? null,
        deliveryLng: selected?.lng ?? null,
        action: action?.type,
        menuItemId: action?.type === 'replace_cart' ? action.menuItemId : undefined,
        context: lastCards ? JSON.stringify(slimCards(lastCards)) : undefined,
      });
      if (threadGen.current !== gen) return false;
      setMessages((current) => [
        ...current,
        {
          id: `rio-${Date.now()}`,
          from: 'rio',
          text: reply.text,
          cards: reply.cards,
          conflict: reply.conflict,
        },
      ]);
      if (reply.cards.some((card) => card.kind === 'cart' || card.kind === 'order') || action) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: cartQueryKey }),
          queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
        ]);
      }
      const placed = reply.cards.some((card) => card.kind === 'order');
      const cartUpdated = reply.cards.some((card) => card.kind === 'cart') && !reply.conflict;
      return action?.type === 'confirm_order' ? placed : action?.type === 'replace_cart' ? cartUpdated : true;
    } catch (error) {
      if (threadGen.current !== gen) return false;
      setMessages((current) => [
        ...current,
        {
          id: `rio-${Date.now()}`,
          from: 'rio',
          text: error instanceof Error ? error.message : 'RIO could not answer just now.',
        },
      ]);
      return false;
    } finally {
      if (threadGen.current === gen) {
        busy.current = false;
        setThinking(false);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
    }
  }

  if (!loading && !session) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <View style={styles.head}>
          <AppText heading style={styles.title}>
            RIO
          </AppText>
          <AppText muted>Sign in to talk to RIO.</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <View style={styles.head}>
        <View style={styles.identity}>
          <AppText heading style={styles.title}>
            RIO
          </AppText>
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <AppText muted>Your QuickBite food assistant</AppText>
          </View>
        </View>
        {started ? (
          <Pressable
            onPress={startNewChat}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.flex}>
        {started ? (
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.thread}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {messages.map((message) => (
            <View key={message.id} style={styles.message}>
              <View style={[styles.bubble, message.from === 'you' ? styles.you : styles.rio]}>
                <RioBubbleText text={message.text} you={message.from === 'you'} />
              </View>
              {message.cards && message.cards.length > 0 ? (
                <RioCards
                  cards={message.cards}
                  liked={hearts.ids}
                  onToggleLike={hearts.toggle}
                  onAddItem={(item) => void send(addLine(item))}
                  onConfirm={() => {
                    void send('Confirm order', { type: 'confirm_order' }).then((placed) => {
                      if (!placed) return;
                      setMessages((current) =>
                        current.map((row) => (row.id === message.id ? { ...row, settled: true } : row)),
                      );
                    });
                  }}
                  onAddAddress={() => router.push('/(customer)/addresses')}
                  confirming={thinking}
                  confirmHidden={Boolean(message.settled)}
                />
              ) : null}
              {message.conflict && !message.settled ? (
                <View style={styles.conflict}>
                  <Pressable
                    onPress={() =>
                      setMessages((current) => [
                        ...current.map((row) => (row.id === message.id ? { ...row, settled: true } : row)),
                        {
                          id: `rio-keep-${Date.now()}`,
                          from: 'rio',
                          text: 'Keeping what is already in your cart.',
                        },
                      ])
                    }
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                    <AppText weight="semibold" style={styles.chipText}>
                      Keep cart
                    </AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const menuItemId = message.conflict?.menuItemId;
                      if (!menuItemId) return;
                      void send('Clear cart and add this dish', { type: 'replace_cart', menuItemId }).then((replaced) => {
                        if (!replaced) return;
                        setMessages((current) =>
                          current.map((row) => (row.id === message.id ? { ...row, settled: true } : row)),
                        );
                      });
                    }}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                    <AppText weight="semibold" style={styles.chipText}>
                      Clear and add
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {thinking ? (
            <View style={[styles.bubble, styles.rio]}>
              <AppText muted style={styles.bubbleText}>
                RIO is thinking...
              </AppText>
            </View>
          ) : null}
        </ScrollView>
        ) : (
          <View
            style={[
              styles.empty,
              { justifyContent: keyboardVisible ? 'flex-end' : 'center', paddingBottom: restPadding },
            ]}>
            <AppText style={styles.emptyCopy}>{greetingMessage().text}</AppText>
            <View style={styles.starters}>
              {STARTERS.map((prompt) => (
                <Pressable
                  key={prompt}
                  disabled={thinking}
                  onPress={() => void send(prompt)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                  <AppText weight="semibold" style={styles.chipText}>
                    {prompt}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <Composer draft={draft} thinking={thinking} onChange={setDraft} onSend={() => void send(draft)} />
          </View>
        )}
        {started ? (
          <View style={[styles.dock, { paddingBottom: restPadding }]}>
            <Composer draft={draft} thinking={thinking} onChange={setDraft} onSend={() => void send(draft)} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Composer({
  draft,
  thinking,
  onChange,
  onSend,
}: {
  draft: string;
  thinking: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.composer}>
      <TextInput
        value={draft}
        onChangeText={onChange}
        placeholder="Ask RIO"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={!thinking}
        onSubmitEditing={onSend}
        returnKeyType="send"
        underlineColorAndroid="transparent"
      />
      <Pressable
        onPress={onSend}
        disabled={thinking}
        style={({ pressed }) => [styles.send, pressed && styles.pressed]}
        accessibilityLabel="Send">
        <Ionicons name="arrow-up" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
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

function addLine(item: RioMenuItem) {
  return `Add menu item ${item.id} (${item.name}) to my cart.`;
}

function slimCards(cards: RioCard[]) {
  return cards.map((card) => {
    if (card.kind === 'restaurants') {
      return { kind: card.kind, places: card.places.map((place) => ({ id: place.id, name: place.name })) };
    }
    if (card.kind === 'menu') {
      return {
        kind: card.kind,
        restaurantId: card.restaurantId,
        items: card.items.map((item) => ({ id: item.id, name: item.name, price: item.price })),
      };
    }
    if (card.kind === 'cart') {
      return { kind: card.kind, restaurantName: card.restaurantName, total: card.total, lines: card.lines };
    }
    return { kind: card.kind, id: card.id, status: card.status, restaurantName: card.restaurantName };
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { flex: 1, paddingHorizontal: 16, gap: 16 },
  emptyCopy: { textAlign: 'center', fontSize: 16, lineHeight: 22, paddingHorizontal: 12 },
  dock: { backgroundColor: colors.background, paddingHorizontal: 16},
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  identity: { flex: 1, gap: 2 },
  title: { fontSize: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  newChat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: { paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
  message: { gap: 8 },
  bubble: { maxWidth: '86%', borderRadius: radii.lg, paddingHorizontal: 14, paddingVertical: 10 },
  rio: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  you: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  youText: { color: colors.white },
  conflict: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starters: { alignItems: 'center', gap: 8 },
  chip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: colors.text, fontSize: 12 },
  pressed: { opacity: 0.72 },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 18,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
