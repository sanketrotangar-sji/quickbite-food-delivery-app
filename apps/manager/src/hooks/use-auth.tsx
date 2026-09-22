import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { exchangeCodeForSession, signOut as apiSignOut } from '@/api/auth';
import { acceptManagerInvites } from '@/api/partners';
import { getProfile, type Profile } from '@/api/profiles';
import { supabase } from '@/integrations/supabase/client';

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
    // Invite accept is best-effort; profile load still proceeds.
  }
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const profile = await getProfile(userId);
    if (profile) return profile;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return null;
}

async function consumeOAuthCode() {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return;
  await exchangeCodeForSession(code);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next || '/');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await consumeOAuthCode();
      } catch {
        // Invalid/expired code — fall through to getSession.
      }
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setSessionReady(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
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
        if (!cancelled) setProfile(next);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id, sessionReady]);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      signOut: async () => {
        await apiSignOut();
        setProfile(null);
      },
      refreshProfile: async () => {
        if (!session?.user.id) return;
        const next = await getProfile(session.user.id);
        if (next) setProfile(next);
      },
    }),
    [session, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
