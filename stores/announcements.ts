import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type?: 'info' | 'warning' | 'update';
  date: string;
  cta_label?: string;
  cta_url?: string | null;
}

interface AnnouncementsState {
  seenIds: string[];
  pending: Announcement[];
  markSeen: (id: string) => void;
  markAllSeen: (ids: string[]) => void;
  setPending: (announcements: Announcement[]) => void;
  clearPending: () => void;
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  persist(
    (set) => ({
      seenIds: [],
      pending: [],
      markSeen: (id) => set((s) => ({ seenIds: [...s.seenIds, id] })),
      markAllSeen: (ids) => set((s) => ({ seenIds: [...new Set([...s.seenIds, ...ids])] })),
      setPending: (announcements) => set({ pending: announcements }),
      clearPending: () => set({ pending: [] }),
    }),
    { name: 'hae-announcements', storage: createJSONStorage(() => AsyncStorage) }
  )
);
