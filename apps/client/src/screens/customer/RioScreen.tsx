import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { forwardRef, useEffect, useRef } from 'react';
import { KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RioChatMessage } from '@/api/rioChat';
import { AppText } from '@/components/AppText';
import { HomeHero } from '@/components/home/HomeHero';
import { colors, fonts } from '@/constants/theme';
import { useAddDish } from '@/hooks/useAddDish';
import { useAddresses } from '@/hooks/useAddresses';
import { useAuth } from '@/hooks/useAuth';
import { useActiveOrder } from '@/hooks/useOrderTracking';
import { useRioChat } from '@/hooks/useRioChat';
import { useRioThread } from '@/hooks/useRioThread';
import { useSavedHearts } from '@/hooks/useSavedHearts';
import { customerTabBarHeight } from '@/lib/customer-tab-bar';
import { greetingName } from '@/lib/home-catalog';
import { RioMessageList } from '@/screens/customer/RioMessageList';

const RIO_MARK = require('../../../assets/images/rio-mark.png');
const RIO_BG = colors.background;
const RIO_ACCENT = colors.primary;
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
            onPress={handleNewChat}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="New chat"
            style={({ pressed }) => [styles.newChat, pressed && styles.pressed]}>
            <Ionicons name="create-outline" size={16} color={RIO_ACCENT} />
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: RIO_BG },
  chatShell: { flex: 1, minHeight: 0 },
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
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 40, height: 40 },
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
