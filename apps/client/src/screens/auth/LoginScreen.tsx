import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { signInWithEmail, signInWithGoogle } from '@/api/auth';
import { supabaseConfigured } from '@/api/supabaseClient';
import { AppText } from '@/components/AppText';
import { AuthFrame, GoogleMark } from '@/components/auth/AuthFrame';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, fonts, spacing } from '@/constants/theme';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function onLogin() {
    if (!supabaseConfigured) {
      Alert.alert('Env missing', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/client/.env');
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      Alert.alert('Could not sign in', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('Google sign-in', error instanceof Error ? error.message : 'Try again.');
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
          <AuthFrame>
            <AppText heading weight="bold" style={styles.title}>
              Welcome back
            </AppText>
            <AppText muted style={styles.subtitle}>
              Sign in to order from nearby kitchens or deliver with QuickBite.
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

            <Link href="/(auth)/signup" style={styles.footerLink}>
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
