import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { forwardRef, useEffect, useRef } from 'react';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import type { RioChatMessage } from '@quickbite/api/mobile/rioChat';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { HomeHero } from '@/features/home/components/HomeHero';
import { colors, elevation, fonts, radii, type } from '@/constants/theme';
import { useAddDish } from '@/features/cart/useAddDish';
import { useAddresses } from '@/features/addresses/hooks';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrder } from '@/features/orders/useOrderTracking';
import { useRioChat } from '@/features/rio/useRioChat';
import { useRioThread } from '@/features/rio/useRioThread';
import { useSavedHearts } from '@/features/profile/useSavedHearts';
import { customerTabBarHeight } from '@/lib/customer-tab-bar';
import { greetingName } from '@/lib/home-catalog';
import { RioMessageList } from '@/features/rio/screens/RioMessageList';

const RIO_MARK = require('../../../../assets/images/rio-mark.png');
const RIO_BG = colors.background;
const RIO_ACCENT = colors.primaryDark;
const RIO_TEXT = colors.text;
const RIO_MUTED = colors.textMuted;

export function RioScreen() {
  const { session, loading, profile } = useAuth();
  const hearts = useSavedHearts();
  const { selected } = useAddresses();
  const { activeOrder } = useActiveOrder();
  const { addDish, dialog: cartReplaceDialog } = useAddDish();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const userId = session?.user.id ?? null;
  const firstName = greetingName(profile?.full_name, profile?.email);

  const { hydrated, messages, setMessages, threadIdRef, threadGen, startNewChat, started } = useRioThread(
    userId,
    firstName,
  );
  const { draft, setDraft, thinking, statusHint, send, settleMessage, resetBusy } = useRioChat({
    session,
    selected,
    hydrated,
    messages,
    setMessages,
    threadIdRef,
    threadGen,
  });

  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const insets = useSafeAreaInsets();
  const tabBarHeight = customerTabBarHeight(insets.bottom);
  const keyboardInset = Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 0;
  const composerStickyOffset = keyboardVisible
    ? { closed: 0, opened: keyboardInset }
    : { closed: -tabBarHeight, opened: keyboardInset };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, thinking, keyboardVisible]);

  function handleNewChat() {
    resetBusy();
    startNewChat();
  }

  function handleConfirm(message: RioChatMessage) {
    const confirmCard = message.cards?.find((card) => card.kind === 'cart' && card.confirm && card.cartHash);
    const cartHash = confirmCard && confirmCard.kind === 'cart' ? confirmCard.cartHash : undefined;
    void send('Confirm order', { type: 'confirm_order', cartHash }).then((placed) => {
      if (!placed) return;
      void settleMessage(message.id, message.cards);
    });
  }

  function handleKeepCart(message: RioChatMessage) {
    void settleMessage(message.id, message.cards);
    setMessages((current) => [
      ...current,
      {
        id: `rio-keep-${Date.now()}`,
        from: 'rio',
        at: Date.now(),
        text: 'Keeping what is already in your cart.',
      },
    ]);
  }

  function handleClearAndAdd(message: RioChatMessage) {
    const menuItemId = message.conflict?.menuItemId;
    if (!menuItemId) return;
    void send('Clear cart and add this dish', { type: 'replace_cart', menuItemId }).then((replaced) => {
      if (!replaced) return;
      void settleMessage(message.id, message.cards);
    });
  }

  if (!loading && !session) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <HomeHero />
        <View style={[styles.signIn, { paddingBottom: tabBarHeight + 24 }]}>
          <View style={styles.avatar}>
            <Image source={RIO_MARK} style={styles.avatarImage} accessibilityLabel="RIO" />
          </View>
          <AppText heading weight="bold" variant="title" style={styles.signInTitle}>
            Meet RIO
          </AppText>
          <AppText variant="body" muted style={styles.signInSubtitle}>
            Sign in to ask RIO for cravings, personalized dish recommendations, and one-tap reorders.
          </AppText>
          <View style={styles.signInAction}>
            <Button
              label="Sign in to chat"
              onPress={() =>
                router.push({
                  pathname: '/(auth)/login',
                  params: {
                    returnTo: '/(customer)/(tabs)/assistant',
                    message: 'Sign in to chat with RIO, your personal AI assistant',
                  },
                })
              }
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <HomeHero />
      <View style={styles.identity}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Image source={RIO_MARK} style={styles.avatarImage} accessibilityLabel="RIO" />
          </View>
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.identityCopy}>
          <AppText heading weight="bold" variant="title" style={styles.rioTitle}>
            RIO
          </AppText>
          <AppText variant="meta" style={styles.rioSubtitle}>
            AI Food Concierge · Online
          </AppText>
        </View>
        {started ? (
          <Pressable
            onPress={handleNewChat}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Start new chat"
            style={({ pressed }) => [styles.newChatPill, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={15} color={RIO_ACCENT} />
            <AppText weight="semibold" variant="caption" style={styles.newChatText}>
              New chat
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chatShell}>
        <RioMessageList
          messages={messages}
          started={started}
          thinking={thinking}
          statusHint={statusHint}
          liked={hearts.ids}
          onToggleLike={hearts.toggle}
          onAddDish={addDish}
          onConfirm={handleConfirm}
          onSend={(prompt) => void send(prompt)}
          onKeepCart={handleKeepCart}
          onClearAndAdd={handleClearAndAdd}
          activeOrderId={activeOrder?.id ?? null}
          scrollRef={scrollRef}
          onBlurInput={() => inputRef.current?.blur()}
        />

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
  const sendDisabled = thinking || !draft.trim();
  return (
    <View style={styles.composer}>
      <View style={[styles.inputWrap, elevation.card]}>
        <Ionicons name="sparkles-outline" size={16} color={RIO_ACCENT} style={styles.inputIcon} />
        <TextInput
          ref={ref}
          value={draft}
          onChangeText={onChange}
          accessibilityLabel="Message RIO"
          placeholder="Ask RIO for dishes, offers, or order help…"
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
        disabled={sendDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: sendDisabled }}
        style={({ pressed }) => [styles.send, sendDisabled && styles.sendDisabled, pressed && styles.pressed]}
        accessibilityLabel="Send message">
        <Ionicons name="arrow-up" size={18} color={colors.white} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RIO_BG },
  chatShell: { flex: 1, minHeight: 0 },
  stickyComposer: { backgroundColor: RIO_BG },
  signIn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  signInTitle: { color: RIO_TEXT, marginTop: 14 },
  signInSubtitle: { textAlign: 'center', marginHorizontal: 20, marginTop: 6, marginBottom: 24 },
  signInAction: { width: '100%', maxWidth: 280 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 40, height: 40 },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: RIO_BG,
  },
  identityCopy: { flex: 1, gap: 1 },
  rioTitle: { color: RIO_TEXT, letterSpacing: 0.4 },
  rioSubtitle: { color: RIO_MUTED },
  newChatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  newChatText: { color: RIO_ACCENT },
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
    paddingRight: 10,
    paddingVertical: 8,
  },
  inputIcon: { marginBottom: 6, marginRight: 6 },
  input: {
    flex: 1,
    maxHeight: 72,
    fontFamily: fonts.medium,
    fontSize: type.body.size,
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
