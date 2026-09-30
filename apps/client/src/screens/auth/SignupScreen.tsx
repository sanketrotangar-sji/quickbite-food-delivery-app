import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { signUpWithEmail } from '@/api/auth';
import { supabaseConfigured } from '@/api/supabaseClient';
import { AppText } from '@/components/AppText';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, fonts, spacing } from '@/constants/theme';
import { validateAuthForm } from '@/lib/auth-form';

export function SignupScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!supabaseConfigured) {
      Alert.alert('Env missing', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/client/.env');
      return;
    }
    const formError = validateAuthForm({ email, password, fullName, requireName: true });
    if (formError) {
      Alert.alert('Check the form', formError);
      return;
    }
    setLoading(true);
    try {
      const data = await signUpWithEmail({
        email,
        password,
        fullName,
        phone,
      });
      if (!data.session) {
        Alert.alert('Check your email', 'Confirm your address, then come back and sign in.');
      }
    } catch (error) {
      Alert.alert('Could not sign up', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
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
              Create account
            </AppText>
            <AppText muted style={styles.subtitle}>
              Order food with email and password, or continue with Google after you sign in.
            </AppText>

            <View style={styles.form}>
              <TextField label="Full name" value={fullName} onChangeText={setFullName} />
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
                autoComplete="new-password"
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
              />
              <TextField
                label="Phone (optional)"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
              <Button label="Create account" onPress={onSignup} loading={loading} style={styles.authBtn} />
            </View>

            <Link href="/(auth)/login" style={styles.footerLink}>
              <AppText muted style={styles.footer}>
                Already have an account?{' '}
                <AppText weight="bold" style={styles.footerAccent}>
                  Sign in
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
  footerLink: {
    marginTop: spacing.lg,
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
