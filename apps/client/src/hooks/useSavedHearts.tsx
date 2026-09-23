import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';

type HeartsValue = {
  ready: boolean;
  ids: ReadonlySet<string>;
  toggle: (id: string) => void;
};

const HeartsContext = createContext<HeartsValue | null>(null);

function storageKey(userId: string) {
  return `qb.hearts.${userId}`;
}

export function SavedHeartsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    if (!userId) {
      setIds([]);
      setReady(true);
      return;
    }
    void AsyncStorage.getItem(storageKey(userId)).then((raw) => {
      if (cancelled) return;
      try {
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        setIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
      } catch {
        setIds([]);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggle = useCallback(
    (id: string) => {
      if (!userId) return;
      setIds((current) => {
        const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
        void AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
        return next;
      });
    },
    [userId],
  );

  const value = useMemo<HeartsValue>(() => ({ ready, ids: new Set(ids), toggle }), [ids, ready, toggle]);

  return <HeartsContext.Provider value={value}>{children}</HeartsContext.Provider>;
}

export function useSavedHearts() {
  const ctx = useContext(HeartsContext);
  if (!ctx) throw new Error('useSavedHearts must be used inside SavedHeartsProvider');
  return ctx;
}
