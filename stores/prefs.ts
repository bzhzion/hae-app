import { create } from 'zustand';

export interface UserPrefs {
  language?: string;
}

interface PrefsState {
  prefs: UserPrefs;
  loaded: boolean;
  fetch: (serverUrl: string, token: string) => Promise<void>;
  save: (serverUrl: string, token: string, updates: Partial<UserPrefs>) => Promise<void>;
  setLocal: (updates: Partial<UserPrefs>) => void;
  reset: () => void;
}

export const usePrefsStore = create<PrefsState>((set, get) => ({
  prefs: {},
  loaded: false,

  fetch: async (serverUrl, token) => {
    try {
      const r = await fetch(`${serverUrl}/api/users/me/prefs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      set({ prefs: data, loaded: true });
    } catch {}
  },

  save: async (serverUrl, token, updates) => {
    set(s => ({ prefs: { ...s.prefs, ...updates } }));
    try {
      await fetch(`${serverUrl}/api/users/me/prefs`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {}
  },

  setLocal: (updates) => set(s => ({ prefs: { ...s.prefs, ...updates } })),

  reset: () => set({ prefs: {}, loaded: false }),
}));
