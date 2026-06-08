import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Column { id: string; name: string; type: string; cards: Card[]; }
interface Card { id: string; title: string; description?: string; }

interface ProjectState {
  currentProjectId: string | null;
  currentProjectName: string | null;
  columns: Column[];
  setCurrentProject: (id: string, name: string) => void;
  setColumns: (columns: Column[]) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProjectId: null,
      currentProjectName: null,
      columns: [],
      setCurrentProject: (id, name) => set({ currentProjectId: id, currentProjectName: name }),
      setColumns: (columns) => set({ columns }),
      clearProject: () => set({ currentProjectId: null, currentProjectName: null, columns: [] }),
    }),
    {
      name: 'hae-project',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ currentProjectId: s.currentProjectId, currentProjectName: s.currentProjectName }),
    }
  )
);
