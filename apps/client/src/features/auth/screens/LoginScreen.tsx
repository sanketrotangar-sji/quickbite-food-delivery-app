import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { signInWithEmail, signInWithGoogle, supabaseConfigured } from '@/api/auth';
import { getProfile } from '@quickbite/api/mobile/profiles';
import { AppText } from '@/components/AppText';
import { AuthFrame, GoogleMark } from '@/components/auth/AuthFrame';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, fonts, spacing } from '@/constants/theme';
import { entryHref, resolveEntryRoute } from '@/features/auth/entry';
import { useAuthGate } from '@/features/auth/hooks';
import { useAuthPrefs } from '@/features/auth/store';
import { useLocationStore } from '@/features/location/store';
import { readLastRole } from '@/lib/last-role';
import { hasRole } from '@/types/models';

export function LoginScreen() {
  const params = useLocalSearchParams<{ returnTo?: string; message?: string; entry?: string }>();
  const isEntry = params.entry === '1';
  const insets = useSafeAreaInsets();
  const { executePendingAction } = useAuthGate();
  const setLoginSkipped = useAuthPrefs((s) => s.setLoginSkipped);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function landAfterEntry(input: { hasSession: boolean; canRide: boolean; lastRole: Awaited<ReturnType<typeof readLastRole>> }) {
    const hasLocation = useLocationStore.getState().point != null;
    const loginSkipped = useAuthPrefs.getState().loginSkipped;
    router.replace(entryHref(resolveEntryRoute({ ...input, hasLocation, loginSkipped })));
  }

  function handleSkip() {
    setLoginSkipped(true);
    landAfterEntry({ hasSession: false, canRide: false, lastRole: null });
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(customer)/(tabs)');
    }
  }

  async function handlePostLogin(userId: string) {
    const executed = await executePendingAction(userId);
    if (executed) return;

    if (params.returnTo) {
      router.replace(params.returnTo as never);
      return;
    }

    let canRide = false;
    try {
      canRide = hasRole(await getProfile(userId), 'rider');
    } catch {
      // Fall through as a customer.
    }
    landAfterEntry({ hasSession: true, canRide, lastRole: await readLastRole() });
  }

  async function onLogin() {
    if (!supabaseConfigured) {
      toast.error('Env missing', { description: 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/client/.env' });
      return;
    }
    if (!email.trim() || !password) {
      toast.error('Missing details', { description: 'Enter email and password.' });
      return;
    }
    setLoading(true);
    try {
      const res = await signInWithEmail(email, password);
      if (res.session?.user?.id) {
        await handlePostLogin(res.session.user.id);
      }
    } catch (error) {
      toast.error('Could not sign in', { description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Google redirects via URL listener; returnTo handled on session change
    } catch (error) {
      toast.error('Google sign-in', { description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {isEntry ? (
            <Pressable onPress={handleSkip} style={[styles.skip, { top: insets.top + spacing.sm }]} hitSlop={10} accessibilityRole="button">
              <AppText weight="semibold" style={styles.skipText}>
                Skip
              </AppText>
            </Pressable>
          ) : null}
          <AuthFrame onBack={isEntry ? undefined : handleBack}>
            <AppText heading weight="bold" style={styles.title}>
              Welcome back
            </AppText>
            <AppText muted style={styles.subtitle}>
              {params.message ?? 'Sign in to order from nearby kitchens or deliver with QuickBite.'}
            </AppText>

            <View style={styles.form}>
              <TextField
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                label="Password"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                value={password}
                onChangeText={setPassword}
              />
              <Button label="Sign in" onPress={onLogin} loading={loading} style={styles.authBtn} />
            </View>

            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <AppText weight="semibold" muted style={styles.dividerLabel}>
                or
              </AppText>
              <View style={styles.dividerLine} />
            </View>

            <Button
              label={googleLoading ? 'Redirecting…' : 'Continue with Google'}
              variant="google"
              onPress={onGoogle}
              loading={googleLoading}
              leading={<GoogleMark />}
              style={styles.authBtn}
            />

            <Link
              href={{
                pathname: '/(auth)/signup',
                params: { returnTo: params.returnTo, message: params.message },
              }}
              style={styles.footerLink}>
              <AppText muted style={styles.footer}>
                New here?{' '}
                <AppText weight="bold" style={styles.footerAccent}>
                  Create an account
                </AppText>
              </AppText>
            </Link>
          </AuthFrame>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: 0 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  skip: { position: 'absolute', right: spacing.md, zIndex: 2, padding: 6 },
  skipText: { color: colors.primary, fontSize: 14 },
  title: {
    fontSize: 24,
    textAlign: 'center',
    fontFamily: fonts.heading,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  authBtn: { minHeight: 44 },
  dividerWrap: {
    marginVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footerLink: {
    marginTop: spacing.md,
    alignSelf: 'center',
  },
  footer: {
    fontSize: 14,
    textAlign: 'center',
  },
  footerAccent: {
    color: colors.primary,
    fontSize: 14,
  },
});
