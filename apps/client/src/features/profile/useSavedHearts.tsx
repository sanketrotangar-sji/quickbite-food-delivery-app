import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useAuthGate } from '@/features/auth/hooks';
import { storage } from '@/lib/storage';

type HeartsValue = {
  ready: boolean;
  ids: ReadonlySet<string>;
  toggle: (id: string) => void;
};

const HeartsContext = createContext<HeartsValue | null>(null);

function storageKey(userId: string) {
  return `qb.hearts.${userId}`;
}

function parseHearts(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Synchronous MMKV read; null means not migrated from AsyncStorage yet. */
function readHearts(userId: string) {
  return parseHearts(storage.getString(storageKey(userId)));
}

export function SavedHeartsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { requireAuth } = useAuthGate();
  const userId = session?.user.id ?? null;
  const [ids, setIds] = useState<string[]>(() => (userId ? readHearts(userId) ?? [] : []));
  const [ready, setReady] = useState(() => !userId || readHearts(userId) !== null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setIds([]);
      setReady(true);
      return;
    }
    const cached = readHearts(userId);
    if (cached) {
      setIds(cached);
      setReady(true);
      return;
    }
    setReady(false);
    void AsyncStorage.getItem(storageKey(userId)).then((raw) => {
      if (cancelled) return;
      const migrated = parseHearts(raw) ?? [];
      storage.set(storageKey(userId), JSON.stringify(migrated));
      void AsyncStorage.removeItem(storageKey(userId));
      setIds(migrated);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    (id: string) => {
      if (!userId) {
        requireAuth({
          pendingAction: { type: 'toggle_heart', id },
          message: 'Sign in to save your favorite dishes and kitchens',
        });
        return;
      }
      setIds((current) => {
        const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
        storage.set(storageKey(userId), JSON.stringify(next));
        return next;
      });
    },
    [userId, requireAuth],
  );

  const value = useMemo<HeartsValue>(() => ({ ready, ids: new Set(ids), toggle }), [ids, ready, toggle]);

  return <HeartsContext.Provider value={value}>{children}</HeartsContext.Provider>;
}

export function useSavedHearts() {
  const ctx = useContext(HeartsContext);
  if (!ctx) throw new Error('useSavedHearts must be used inside SavedHeartsProvider');
  return ctx;
}
