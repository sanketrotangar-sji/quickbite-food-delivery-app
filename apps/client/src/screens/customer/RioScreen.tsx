import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { askRio, askRioStream, type RioCard, type RioConflict } from '@/api/rio';
import { AppText } from '@/components/AppText';
import { HomeHero } from '@/components/home/HomeHero';
import { colors, fonts, radii } from '@/constants/theme';
import { customerTabBarHeight } from '@/lib/customer-tab-bar';
import { userFacingRioError } from '@/lib/rio-errors';
import { cartQueryKey } from '@/hooks/useCart';
import { useAddDish } from '@/hooks/useAddDish';
import { ordersQueryKey } from '@/hooks/useOrders';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrder } from '@/hooks/useOrderTracking';
import { useSavedHearts } from '@/hooks/useSavedHearts';
import { formatDeliveryAddress } from '@/lib/addresses';
import { rioStatusHint } from '@/lib/rio-status-hint';
import { greetingName, type HomeDish } from '@/lib/home-mock';
import { RioCards } from '@/screens/customer/RioCards';

const RIO_MARK = require('../../../assets/images/rio-mark.png');
const RIO_BG = colors.background;
const RIO_ACCENT = colors.primary;
const RIO_TEXT = colors.text;
const RIO_MUTED = colors.textMuted;

type ChatMessage = {
  id: string;
  from: 'rio' | 'you';
  text: string;
  at: number;
  cards?: RioCard[];
  conflict?: RioConflict | null;
  settled?: boolean;
};

/** Composer + send row; keep scroll padding in sync. */
const COMPOSER_DOCK_MAX = 112;

const STARTERS = [
  'Find me dinner',
  'Something under ₹200',
  "I'm craving biryani",
  'Help & support',
];

function greetingMessage(name: string): ChatMessage {
  return {
    id: 'hello',
    from: 'rio',
    at: Date.now(),
    text: `Hi ${name}! I'm RIO, your food assistant. I can help you order food, suggest dishes based on your mood, and handle support. What would you like to do today?`,
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

function parseThread(raw: string | null, name: string): ChatMessage[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const messages = data.filter(isChatMessage).map((row) => ({
      ...row,
      at: typeof row.at === 'number' ? row.at : Date.now(),
    }));
    if (messages.length === 0) return null;
    if (messages[0]?.id !== 'hello') return [greetingMessage(name), ...messages];
    return messages;
  } catch {
    return null;
  }
}

function formatMessageTime(at: number) {
  return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function RioScreen() {
  const { session, loading, profile } = useAuth();
  const hearts = useSavedHearts();
  const { selected } = useAddresses();
  const { activeOrder } = useActiveOrder();
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const busy = useRef(false);
  const threadGen = useRef(0);
  const userId = session?.user.id ?? null;
  const firstName = greetingName(profile?.full_name, profile?.email);
  const [hydrated, setHydrated] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [statusHint, setStatusHint] = useState('RIO is thinking…');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [greetingMessage(firstName)]);
  const started = messages.some((message) => message.from === 'you');
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const insets = useSafeAreaInsets();
  const tabBarHeight = customerTabBarHeight(insets.bottom);
  const keyboardInset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 0;
  const composerStickyOffset = keyboardVisible
    ? { closed: 0, opened: keyboardInset }
    : { closed: -tabBarHeight, opened: keyboardInset };

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setMessages([greetingMessage(firstName)]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    void AsyncStorage.getItem(threadKey(userId)).then((raw) => {
      if (cancelled) return;
      setMessages((current) => {
        // Don't clobber a thread the user already started while storage was loading.
        if (current.some((message) => message.from === 'you')) return current;
        return parseThread(raw, firstName) ?? [greetingMessage(firstName)];
      });
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- firstName updates greeting in place below
  }, [userId]);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 0) return [greetingMessage(firstName)];
      if (current[0]?.id !== 'hello') return current;
      return [{ ...current[0], text: greetingMessage(firstName).text }, ...current.slice(1)];
    });
  }, [firstName]);

  useEffect(() => {
    if (!userId || !hydrated) return;
    void AsyncStorage.setItem(threadKey(userId), JSON.stringify(messages));
  }, [hydrated, messages, userId]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, thinking, keyboardVisible]);

  function startNewChat() {
    threadGen.current += 1;
    busy.current = false;
    setThinking(false);
    setDraft('');
    setMessages([greetingMessage(firstName)]);
  }

  async function send(
    prompt: string,
    action?: { type: 'confirm_order' } | { type: 'replace_cart'; menuItemId: string },
  ): Promise<boolean> {
    const text = prompt.trim();
    if (!hydrated) return false;
    if (busy.current) return false;
    if (!text && !action) return false;
    if (!session) return false;

    const gen = threadGen.current;
    const now = Date.now();
    const you: ChatMessage | null = text
      ? { id: `you-${now}`, from: 'you', text, at: now }
      : action?.type === 'confirm_order'
        ? { id: `you-${now}`, from: 'you', text: 'Confirm order', at: now }
        : null;
    const history = [...messages, ...(you ? [you] : [])].filter((message) => message.id !== 'hello');
    if (you) setMessages((current) => [...current, you]);
    setDraft('');
    busy.current = true;
    setStatusHint(rioStatusHint(text || (action?.type === 'confirm_order' ? 'confirm order' : '')));
    setThinking(true);

    const lastCards = [...history].reverse().find((message) => message.cards && message.cards.length > 0)?.cards;
    const streamId = `rio-${now}`;
    let streamed = false;
    try {
      const request = {
        messages: history.map((message) => ({
          role: message.from === 'you' ? ('user' as const) : ('assistant' as const),
          content: message.text,
        })),
        deliveryAddress: selected ? formatDeliveryAddress(selected) : null,
        deliveryAddressId: selected?.id ?? null,
        deliveryLat: selected?.lat ?? null,
        deliveryLng: selected?.lng ?? null,
        action: action?.type,
        menuItemId: action?.type === 'replace_cart' ? action.menuItemId : undefined,
        context: lastCards ? JSON.stringify(slimCards(lastCards)) : undefined,
      };
      const reply = action
        ? await askRio(request)
        : await askRioStream(request, {
            onToken: (token) => {
              if (threadGen.current !== gen) return;
              if (!streamed) {
                streamed = true;
                setThinking(false);
                setMessages((current) => [
                  ...current,
                  { id: streamId, from: 'rio', text: token, at: Date.now() },
                ]);
                return;
              }
              setMessages((current) =>
                current.map((message) =>
                  message.id === streamId ? { ...message, text: message.text + token } : message,
                ),
              );
            },
          });
      if (threadGen.current !== gen) return false;
      const replyAt = Date.now();
      setMessages((current) => {
        const withoutStream = current.filter((message) => message.id !== streamId);
        return [
          ...withoutStream,
          {
            id: streamId,
            from: 'rio',
            text: reply.text,
            at: replyAt,
            cards: reply.cards,
            conflict: reply.conflict,
          },
        ];
      });
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
      const errAt = Date.now();
      setMessages((current) => {
        const withoutStream = current.filter((message) => message.id !== streamId);
        return [
          ...withoutStream,
          {
            id: `rio-${errAt}`,
            from: 'rio',
            text: userFacingRioError(error),
            at: errAt,
          },
        ];
      });
      return false;
    } finally {
      if (threadGen.current === gen) {
        busy.current = false;
        setThinking(false);
      }
    }
  }

  function chipsForMessage(message: ChatMessage) {
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
          void send(
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
          void addDish(dish);
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
    } else if (activeOrder) {
      chips.push({
        label: 'Track my order',
        onPress: () => router.push(`/(customer)/orders/${activeOrder.id}`),
      });
    }
    chips.push({ label: 'Help & support', onPress: () => void send('I need help with my order') });
    return chips;
  }

  if (!loading && !session) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <HomeHero />
        <View style={styles.signIn}>
          <AppText muted style={{ color: RIO_MUTED }}>
            Sign in to talk to RIO.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <HomeHero />
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Image source={RIO_MARK} style={styles.avatarImage} accessibilityLabel="RIO" />
        </View>
        <View style={styles.identityCopy}>
          <AppText heading weight="bold" style={styles.rioTitle}>
            RIO
          </AppText>
          <AppText style={styles.rioSubtitle}>Your AI Food Assistant</AppText>
        </View>
        {started ? (
          <Pressable
            onPress={startNewChat}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={16} color={RIO_ACCENT} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chatShell}>
        <ScrollView
          ref={scrollRef}
          style={styles.messageList}
          contentContainerStyle={[styles.thread, { paddingBottom: COMPOSER_DOCK_MAX + 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollBeginDrag={() => inputRef.current?.blur()}
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
                    liked={hearts.ids}
                    onToggleLike={hearts.toggle}
                    onAddDish={addDish}
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
                {message.from === 'rio' && message.cards && message.cards.length > 0 && !message.conflict ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
                    {chipsForMessage(message).map((chip, chipIndex) => (
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
                      onPress={() =>
                        setMessages((current) => [
                          ...current.map((row) => (row.id === message.id ? { ...row, settled: true } : row)),
                          {
                            id: `rio-keep-${Date.now()}`,
                            from: 'rio',
                            at: Date.now(),
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
            </View>
          ))}

          {!started ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRail}>
              {STARTERS.map((prompt) => (
                <Pressable
                  key={prompt}
                  disabled={thinking}
                  onPress={() => void send(prompt === 'Help & support' ? 'I need help with my order' : prompt)}
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

        <KeyboardStickyView offset={composerStickyOffset} style={styles.stickyComposer}>
          <View style={styles.dock}>
            <Composer
              ref={inputRef}
              draft={draft}
              thinking={thinking}
              onChange={setDraft}
              onSend={() => void send(draft)}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
              }}
            />
          </View>
        </KeyboardStickyView>
      </View>
      {cartReplaceDialog}
    </View>
  );
}

const Composer = forwardRef<
  TextInput,
  {
    draft: string;
    thinking: boolean;
    onChange: (value: string) => void;
    onSend: () => void;
    onFocus?: () => void;
  }
>(function Composer({ draft, thinking, onChange, onSend, onFocus }, ref) {
  return (
    <View style={styles.composer}>
      <View style={styles.inputWrap}>
        <Ionicons name="sparkles-outline" size={16} color={RIO_ACCENT} style={styles.inputIcon} />
        <TextInput
          ref={ref}
          value={draft}
          onChangeText={onChange}
          placeholder="Ask RIO anything…"
          placeholderTextColor={RIO_MUTED}
          style={styles.input}
          editable={!thinking}
          multiline
          maxLength={2000}
          onFocus={onFocus}
          blurOnSubmit={false}
          onSubmitEditing={() => {
            if (draft.trim()) onSend();
          }}
          returnKeyType="default"
          underlineColorAndroid="transparent"
        />
      </View>
      <Pressable
        onPress={onSend}
        disabled={thinking || !draft.trim()}
        style={({ pressed }) => [styles.send, (thinking || !draft.trim()) && styles.sendDisabled, pressed && styles.pressed]}
        accessibilityLabel="Send">
        <Ionicons name="arrow-forward" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
});

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
    if (card.kind === 'ticket') {
      return { kind: card.kind, id: card.id, orderId: card.orderId, status: card.status };
    }
    return { kind: card.kind, id: card.id, status: card.status, restaurantName: card.restaurantName };
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RIO_BG },
  chatShell: { flex: 1, minHeight: 0 },
  messageList: { flex: 1 },
  stickyComposer: { backgroundColor: RIO_BG },
  signIn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE8DC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 40, height: 40 },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE8DC',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarSmallImage: { width: 28, height: 28 },
  rowSpacer: { flex: 1 },
  messageBodyYou: { flex: 0, maxWidth: '82%', alignItems: 'flex-end' },
  identityCopy: { flex: 1, gap: 1 },
  rioTitle: { fontSize: 18, color: RIO_TEXT, letterSpacing: 0.5 },
  rioSubtitle: { fontSize: 12, color: RIO_MUTED },
  newChat: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 14 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  messageRowRio: { justifyContent: 'flex-start' },
  messageRowYou: { justifyContent: 'flex-end' },
  messageBody: { flex: 1, gap: 6, maxWidth: '88%' },
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
  dock: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, backgroundColor: RIO_BG },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 48,
    maxHeight: 96,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
  },
  inputIcon: { marginBottom: 6, marginRight: 4 },
  input: {
    flex: 1,
    maxHeight: 72,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: RIO_TEXT,
    paddingVertical: 4,
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: RIO_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
});
