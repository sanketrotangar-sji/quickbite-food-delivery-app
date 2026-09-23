import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { signUpWithEmail } from '@/api/auth';
import { supabaseConfigured } from '@/api/supabaseClient';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { colors, spacing } from '@/constants/theme';

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
    if (!fullName.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Check the form', 'Name, email, and a password of at least 6 characters are required.');
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
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 8 }}>
            <AppText weight="bold" style={styles.title}>
              Create account
            </AppText>
            <AppText muted>Order food with email, password, or Google after you sign in.</AppText>
          </View>

          <View style={{ gap: spacing.md }}>
            <TextField label="Full name" value={fullName} onChangeText={setFullName} />
            <TextField
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
            <TextField
              label="Phone (optional)"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Button label="Create account" onPress={onSignup} loading={loading} />
          </View>

          <Link href="/(auth)/login">
            <AppText weight="medium" style={styles.link}>
              Already have an account? Sign in
            </AppText>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 28 },
  link: { textAlign: 'center', color: colors.secondary },
});
