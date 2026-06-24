import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Column { id: string; name: string; type: string; cards: Card[]; }
interface Card { id: string; title: string; description?: string; }

interface ProjectState {
  currentProjectId: string | null;
  currentProjectName: string | null;
  currentProjectOwnerType: string | null;
  currentProjectOwnerId: string | null;
  columns: Column[];
  pendingCardId: string | null;
  refreshKey: number;
  setPendingCard: (id: string | null) => void;
  triggerRefresh: () => void;
  setCurrentProject: (id: string, name: string, ownerType?: string, ownerId?: string) => void;
  setColumns: (columns: Column[]) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      currentProjectName: null,
      currentProjectOwnerType: null,
      currentProjectOwnerId: null,
      columns: [],
      pendingCardId: null,
      refreshKey: 0,
      setPendingCard: (id) => set({ pendingCardId: id }),
      triggerRefresh: () => set(s => ({ refreshKey: s.refreshKey + 1 })),
      setCurrentProject: (id, name, ownerType, ownerId) => set({
        currentProjectId: id,
        currentProjectName: name,
        currentProjectOwnerType: ownerType ?? null,
        currentProjectOwnerId: ownerId ?? null,
      }),
      setColumns: (columns) => set({ columns }),
      clearProject: () => set({ currentProjectId: null, currentProjectName: null, currentProjectOwnerType: null, currentProjectOwnerId: null, columns: [] }),
    }),
    {
      name: 'hae-project',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        currentProjectId: s.currentProjectId,
        currentProjectName: s.currentProjectName,
        currentProjectOwnerType: s.currentProjectOwnerType,
        currentProjectOwnerId: s.currentProjectOwnerId,
      }),
    }
  )
);
