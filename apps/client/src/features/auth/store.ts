import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

type AuthPrefsState = {
  loginSkipped: boolean;
  setLoginSkipped: (value: boolean) => void;
};

export const useAuthPrefs = create<AuthPrefsState>()(
  persist(
    (set) => ({
      loginSkipped: false,
      setLoginSkipped: (loginSkipped) => set({ loginSkipped }),
    }),
    {
      name: 'qb.authPrefs',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ loginSkipped }) => ({ loginSkipped }),
    },
  ),
);
