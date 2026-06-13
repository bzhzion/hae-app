import { create } from 'zustand';
import { showToast } from './toast';
import i18n from '../i18n';

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
    } catch { showToast(i18n.t('common.loadError')); }
  },

  save: async (serverUrl, token, updates) => {
    set(s => ({ prefs: { ...s.prefs, ...updates } }));
    try {
      await fetch(`${serverUrl}/api/users/me/prefs`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch { showToast(i18n.t('common.saveError')); }
  },

  setLocal: (updates) => set(s => ({ prefs: { ...s.prefs, ...updates } })),

  reset: () => set({ prefs: {}, loaded: false }),
}));
