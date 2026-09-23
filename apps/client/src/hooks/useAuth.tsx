import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { acceptManagerInvites } from '@/api/applications';
import { signOut as apiSignOut } from '@/api/auth';
import { getProfile } from '@/api/profiles';
import { supabase } from '@/api/supabaseClient';
import { restoreRiderTracking, stopRiderTracking } from '@/features/rider/rider-tracking';
import type { Profile } from '@/types/models';

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
    const profile = await getProfile(userId);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    void restoreRiderTracking();
    setLoading(true);
    loadProfile(userId)
      .then((next) => {
        if (!cancelled) setProfile(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

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
