import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  token: string | null;
  serverUrl: string;
  setToken: (token: string | null) => void;
  setServerUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  serverUrl: '',
  setToken: (token) => set({ token }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  logout: () => set({ token: null }),
}));
