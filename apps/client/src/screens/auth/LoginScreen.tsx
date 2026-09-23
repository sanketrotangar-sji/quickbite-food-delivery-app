import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { signInWithEmail, signInWithGoogle } from '@/api/auth';
import { supabaseConfigured } from '@/api/supabaseClient';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/constants/theme';

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
    console.log('[QB-DEBUG]', JSON.stringify({
      sessionId: '151e86',
      runId: 'google-oauth-post-fix',
      hypothesisId: 'E',
      location: 'LoginScreen.tsx:onGoogle',
      message: 'google button pressed',
      data: { supabaseConfigured },
      timestamp: Date.now(),
    }));
    try {
      await signInWithGoogle();
      console.log('[QB-DEBUG]', JSON.stringify({
        sessionId: '151e86',
        runId: 'google-oauth-post-fix',
        hypothesisId: 'E',
        location: 'LoginScreen.tsx:onGoogle',
        message: 'signInWithGoogle resolved without throw',
        data: {},
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.log('[QB-DEBUG]', JSON.stringify({
        sessionId: '151e86',
        runId: 'google-oauth-post-fix',
        hypothesisId: 'C',
        location: 'LoginScreen.tsx:onGoogle',
        message: 'signInWithGoogle threw',
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now(),
      }));
      Alert.alert('Google sign-in', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <AppText weight="bold" style={styles.logo}>
              QuickBite
            </AppText>
            <AppText muted>Food from nearby kitchens, delivered warm.</AppText>
          </View>

          <View style={styles.form}>
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
            <Button label="Sign in" onPress={onLogin} loading={loading} />
            <Button label="Continue with Google" variant="google" onPress={onGoogle} loading={googleLoading} />
          </View>

          <Link href="/(auth)/signup">
            <AppText weight="medium" style={styles.link}>
              New here? Create an account
            </AppText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  hero: { gap: 8 },
  logo: { fontSize: 36, color: colors.primary },
  form: { gap: spacing.md },
  link: { textAlign: 'center', color: colors.secondary },
});
