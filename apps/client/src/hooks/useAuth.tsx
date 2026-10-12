import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import * as Linking from 'expo-linking';

import { acceptManagerInvites } from '@/api/applications';
import { createSessionFromUrl, signOut as apiSignOut } from '@/api/auth';
import { getProfile } from '@/api/profiles';
import { supabase } from '@/api/supabaseClient';
import { restoreRiderTracking, stopRiderTracking } from '@/features/rider/rider-tracking';
import { hasRole, type Profile } from '@/types/models';

type AuthValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function loadProfile(userId: string) {
  try {
    await acceptManagerInvites();
  } catch {
    // Invites are optional until the user opens Settings.
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const profile = await getProfile(userId);
      if (profile) return profile;
    } catch {
      // Non-fatal retry for initial network flakes on cold boot.
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setSessionResolved(true);
      })
      .catch(() => {
        if (!mounted) return;
        setSessionResolved(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      setSessionResolved(true);
    });

    const handleUrl = (event: { url: string }) => {
      if (event.url && (event.url.includes('access_token') || event.url.includes('code='))) {
        void createSessionFromUrl(event.url).catch(() => {});
      }
    };
    const urlSub = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then((url) => {
      if (url && (url.includes('access_token') || url.includes('code='))) {
        void createSessionFromUrl(url).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      urlSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!sessionResolved) return;

    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadProfile(userId)
      .then((next) => {
        if (cancelled) return;
        setProfile(next);
      })
      .catch(() => {
        if (cancelled) return;
        setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionResolved, session?.user.id]);

  // GPS restore only for online riders with an active assignment.
  useEffect(() => {
    if (!session?.user.id || !profile) return;
    if (hasRole(profile, 'rider') && profile.is_online) {
      void restoreRiderTracking({ isRider: true, isOnline: true }).catch(() => {
        // GPS permission failures stay on the rider snapshot; boot should not crash.
      });
      return;
    }
    if (hasRole(profile, 'rider')) {
      void stopRiderTracking().catch(() => {});
      return;
    }
    void restoreRiderTracking({ isRider: false }).catch(() => {});
  }, [session?.user.id, profile?.id, profile?.role, profile?.is_online]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const next = await getProfile(userId);
    if (next) setProfile(next);
  }, [session?.user.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshProfile();
    });
    return () => sub.remove();
  }, [refreshProfile]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      signOut: async () => {
        await stopRiderTracking();
        const uid = session?.user.id;
        if (uid) {
          try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            await AsyncStorage.removeItem(`qb.rio.chat.${uid}`);
          } catch {
            // Best-effort local RIO cache clear.
          }
        }
        await apiSignOut();
        setProfile(null);
      },
      refreshProfile,
    }),
    [session, profile, loading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
