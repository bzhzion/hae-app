import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface AuthUser { id: string; name: string; email: string; role: string; avatar_url?: string | null; }

interface AuthState {
  token: string | null;
  serverUrl: string;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  setServerUrl: (url: string) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    try {
      const val = await SecureStore.getItemAsync(key);
      // Migration : si rien dans SecureStore, tenter AsyncStorage
      if (val === null) {
        const legacy = await AsyncStorage.getItem(key);
        if (legacy) {
          await SecureStore.setItemAsync(key, legacy);
          await AsyncStorage.removeItem(key);
          return legacy;
        }
      }
      return val;
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {}
    await AsyncStorage.removeItem(key);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      serverUrl: '',
      user: null,
      setToken: (token) => {
        set({ token });
      },
      setServerUrl: (serverUrl) => set({ serverUrl }),
      setUser: (user) => set({ user }),
      logout: () => {
        set({ token: null, user: null });
        import('../stores/project').then(m => m.useProjectStore.getState().clearProject());
      },
    }),
    {
      name: 'hae-auth',
      storage: createJSONStorage(() => secureStorage),
    }
  )
);
