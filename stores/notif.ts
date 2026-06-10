import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotifState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrement: () => void;
}

export const useNotifStore = create<NotifState>()(
  persist(
    (set) => ({
      unreadCount: 0,
      setUnreadCount: (n) => set({ unreadCount: n }),
      decrement: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
    }),
    { name: 'hae-notif', storage: createJSONStorage(() => AsyncStorage) }
  )
);
