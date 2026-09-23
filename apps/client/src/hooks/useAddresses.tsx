import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  createAddress,
  importAddresses,
  listAddresses,
  removeAddress,
  setDefaultAddress,
  subscribeToAddresses,
  updateAddress,
} from '@/api/addresses';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { parseAddressList, type AddressDraft, type SavedAddress } from '@/lib/addresses';

type AddressesValue = {
  hydrated: boolean;
  error: string;
  addresses: SavedAddress[];
  selectedId: string | null;
  selected: SavedAddress | null;
  select: (id: string) => Promise<void>;
  add: (draft: AddressDraft) => Promise<void>;
  update: (id: string, draft: AddressDraft) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const AddressesContext = createContext<AddressesValue | null>(null);

function listKey(userId: string) {
  return `qb.addresses.${userId}`;
}

function selectedKey(userId: string) {
  return `qb.address.selected.${userId}`;
}

function migrationKey(userId: string) {
  return `qb.addresses.supabase.v1.${userId}`;
}

export function AddressesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    setError('');
    if (!userId) {
      setAddresses([]);
      setSelectedId(null);
      setHydrated(true);
      return;
    }

    async function load() {
      try {
        const [marker, pairs] = await Promise.all([
          AsyncStorage.getItem(migrationKey(userId!)),
          AsyncStorage.multiGet([listKey(userId!), selectedKey(userId!)]),
        ]);
        if (!marker) {
          const local = parseAddressList(pairs[0]?.[1] ?? null);
          const localSelected = pairs[1]?.[1] || null;
          if (local.length > 0) await importAddresses(userId!, local, localSelected);
        }
        const next = await listAddresses();
        if (!marker) await AsyncStorage.setItem(migrationKey(userId!), new Date().toISOString());
        if (cancelled) return;
        setAddresses(next.addresses);
        setSelectedId(next.selectedId);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load saved addresses.');
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void load();
    const channel = subscribeToAddresses(userId, () => {
      void listAddresses()
        .then((next) => {
          if (cancelled) return;
          setAddresses(next.addresses);
          setSelectedId(next.selectedId);
          setError('');
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not refresh saved addresses.');
        });
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    const next = await listAddresses();
    setAddresses(next.addresses);
    setSelectedId(next.selectedId);
  }, []);

  const mutate = useCallback(async (operation: () => Promise<void>) => {
    setError('');
    try {
      await operation();
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not update saved addresses.';
      setError(message);
      throw cause;
    }
  }, [refresh]);

  const select = useCallback(
    async (id: string) => {
      if (!userId || !addresses.some((address) => address.id === id)) return;
      await mutate(() => setDefaultAddress(id));
    },
    [addresses, mutate, userId],
  );

  const add = useCallback(
    async (draft: AddressDraft) => {
      if (!userId || !hydrated) return;
      const id = Crypto.randomUUID();
      await mutate(async () => {
        await createAddress(userId, id, draft);
        await setDefaultAddress(id);
      });
    },
    [hydrated, mutate, userId],
  );

  const update = useCallback(
    async (id: string, draft: AddressDraft) => {
      if (!userId || !hydrated) return;
      await mutate(async () => {
        await updateAddress(id, draft);
      });
    },
    [hydrated, mutate, userId],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!userId || !hydrated) return;
      await mutate(() => removeAddress(id));
    },
    [hydrated, mutate, userId],
  );

  const selected = addresses.find((address) => address.id === selectedId) ?? null;

  const value = useMemo<AddressesValue>(
    () => ({ hydrated, error, addresses, selectedId, selected, select, add, update, remove }),
    [add, addresses, error, hydrated, remove, select, selected, selectedId, update],
  );

  return <AddressesContext.Provider value={value}>{children}</AddressesContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressesContext);
  if (!ctx) throw new Error('useAddresses must be used inside AddressesProvider');
  return ctx;
}
