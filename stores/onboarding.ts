import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  done: boolean;
  markDone: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      done: false,
      markDone: () => set({ done: true }),
      reset: () => set({ done: false }),
    }),
    { name: 'hae-onboarding', storage: createJSONStorage(() => AsyncStorage) }
  )
);
