import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'hae-biometric';

interface BiometricState {
  enabled: boolean;
  locked: boolean;
  setEnabled: (val: boolean) => void;
  setLocked: (val: boolean) => void;
  load: () => Promise<void>;
}

export const useBiometricStore = create<BiometricState>((set) => ({
  enabled: false,
  locked: false,
  setEnabled: async (val) => {
    set({ enabled: val });
    await AsyncStorage.setItem(KEY, val ? '1' : '0');
  },
  setLocked: (val) => set({ locked: val }),
  load: async () => {
    const saved = await AsyncStorage.getItem(KEY);
    set({ enabled: saved === '1' });
  },
}));
