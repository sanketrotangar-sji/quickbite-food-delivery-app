import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

const MAX_RECENT = 8;

type BrowsePrefsState = {
  vegOnly: boolean;
  recentSearches: string[];
  setVegOnly: (value: boolean) => void;
  pushRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
};

/** Remembered browse choices (veg toggle, recent searches). */
export const useBrowsePrefs = create<BrowsePrefsState>()(
  persist(
    (set) => ({
      vegOnly: false,
      recentSearches: [],
      setVegOnly: (vegOnly) => set({ vegOnly }),
      pushRecentSearch: (query) => {
        const text = query.trim();
        if (text.length < 2) return;
        set((state) => ({
          recentSearches: [text, ...state.recentSearches.filter((q) => q.toLowerCase() !== text.toLowerCase())].slice(
            0,
            MAX_RECENT,
          ),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'qb.browsePrefs',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ vegOnly, recentSearches }) => ({ vegOnly, recentSearches }),
    },
  ),
);
