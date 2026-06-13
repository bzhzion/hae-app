import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { usePrefsStore } from '@/stores/prefs';
import { saveToAppGroup } from '@/modules/hae-app-group';
import { saveLanguage } from '@/i18n';
import i18n from '@/i18n';

export default function Index() {
  const [hydrated, setHydrated] = useState(false);
  const [checking, setChecking] = useState(false);
  const router = useRouter();
  const { token, refreshToken, serverUrl, setToken, setRefreshToken, setUser, logout } = useAuthStore();
  const fetchPrefs = usePrefsStore(s => s.fetch);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (token) {
      router.replace('/(app)/(tabs)/tasks');
      return;
    }

    if (refreshToken && serverUrl) {
      setChecking(true);
      fetch(`${serverUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(async (data) => {
          setToken(data.accessToken);
          setRefreshToken(data.refreshToken ?? null);
          if (data.user) setUser(data.user);
          saveToAppGroup(serverUrl, data.accessToken);
          try {
            const prefs = await fetchPrefs(serverUrl, data.accessToken).then(() => usePrefsStore.getState().prefs);
            if (prefs.language) {
              await i18n.changeLanguage(prefs.language);
              await saveLanguage(prefs.language as any);
            }
          } catch {}
          router.replace('/(app)/(tabs)/tasks');
        })
        .catch(() => {
          logout();
          router.replace('/(auth)/login');
        })
        .finally(() => setChecking(false));
      return;
    }

    router.replace('/(auth)/login');
  }, [hydrated]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' }}>
      <ActivityIndicator color="#A00000" />
    </View>
  );
}
