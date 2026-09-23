import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

// #region agent log
fetch('http://127.0.0.1:7843/ingest/1b1f3c78-f59b-4280-a7ed-55237573431c', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '151e86' },
  body: JSON.stringify({
    sessionId: '151e86',
    runId: 'google-oauth-1',
    hypothesisId: 'C',
    location: 'supabaseClient.ts:module',
    message: 'supabase client module loaded',
    data: { supabaseConfigured, platform: Platform.OS, hasWindow: typeof window !== 'undefined' },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

const canUseNativeStorage = Platform.OS !== 'web' || typeof window !== 'undefined';

const memoryStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
};

export const supabase = createClient<Database>(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    auth: {
      storage: canUseNativeStorage ? AsyncStorage : memoryStorage,
      autoRefreshToken: canUseNativeStorage,
      persistSession: canUseNativeStorage,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);
