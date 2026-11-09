import type { StateStorage } from 'zustand/middleware';

type KvStore = {
  getString: (name: string) => string | undefined;
  set: (name: string, value: string) => void;
  remove: (name: string) => void;
};

function createSafeKvStore(): KvStore {
  const memory = new Map<string, string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = createMMKV({ id: 'quickbite' });
    return {
      getString: (name) => {
        try {
          return mmkv.getString(name);
        } catch {
          return memory.get(name);
        }
      },
      set: (name, value) => {
        memory.set(name, value);
        try {
          mmkv.set(name, value);
        } catch {
          // Keep in-memory copy when native JSI storage is unavailable
        }
      },
      remove: (name) => {
        memory.delete(name);
        try {
          mmkv.remove(name);
        } catch {
          // Ignore native remove errors
        }
      },
    };
  } catch {
    // Fallback for Expo Go / web / mismatched native binary where Nitro MMKV JSI is unavailable
    return {
      getString: (name) => memory.get(name),
      set: (name, value) => {
        memory.set(name, value);
      },
      remove: (name) => {
        memory.delete(name);
      },
    };
  }
}

/** Safe synchronous key-value store for small app prefs (role, location, toggles). */
export const storage = createSafeKvStore();

export const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};
