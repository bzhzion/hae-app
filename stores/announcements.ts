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
  cta_url?: string;
}

interface AnnouncementsState {
  seenIds: string[];
  markSeen: (id: string) => void;
  markAllSeen: (ids: string[]) => void;
}

export const useAnnouncementsStore = create<AnnouncementsState>()(
  persist(
    (set) => ({
      seenIds: [],
      markSeen: (id) => set((s) => ({ seenIds: [...s.seenIds, id] })),
      markAllSeen: (ids) => set((s) => ({ seenIds: [...new Set([...s.seenIds, ...ids])] })),
    }),
    { name: 'hae-announcements', storage: createJSONStorage(() => AsyncStorage) }
  )
);
