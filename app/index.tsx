import { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useNotifStore } from '@/stores/notif';
import { usePrefsStore } from '@/stores/prefs';
import { useOnboardingStore } from '@/stores/onboarding';
import { useAnnouncementsStore } from '@/stores/announcements';
import { saveToAppGroup } from '@/modules/hae-app-group';
import { saveLanguage } from '@/i18n';
import i18n from '@/i18n';

// Mettre à jour avec l'URL raw GitHub du repo
const ANNOUNCEMENTS_URL = 'https://raw.githubusercontent.com/bzhzion/hae-app/main/public/announcements.json';

const BRAND = '#A00000';

function LoadingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={ls.dots}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[ls.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}


type Phase = 'boot' | 'loading';

export default function Index() {
  const router = useRouter();

  const [authHydrated, setAuthHydrated] = useState(false);
  const [onboardingHydrated, setOnboardingHydrated] = useState(false);
  const [announcementsHydrated, setAnnouncementsHydrated] = useState(false);

  const [phase, setPhase] = useState<Phase>('boot');

  const { token, refreshToken, serverUrl, setToken, setRefreshToken, setUser, logout } = useAuthStore();
  const setUnreadCount = useNotifStore(s => s.setUnreadCount);
  const fetchPrefs = usePrefsStore(s => s.fetch);
  const onboardingDone = useOnboardingStore(s => s.done);
  const { seenIds, setPending } = useAnnouncementsStore();

  // Hydration: auth store
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setAuthHydrated(true);
    return unsub;
  }, []);

  // Hydration: onboarding store
  useEffect(() => {
    const unsub = useOnboardingStore.persist.onFinishHydration(() => setOnboardingHydrated(true));
    if (useOnboardingStore.persist.hasHydrated()) setOnboardingHydrated(true);
    return unsub;
  }, []);

  // Hydration: announcements store
  useEffect(() => {
    const unsub = useAnnouncementsStore.persist.onFinishHydration(() => setAnnouncementsHydrated(true));
    if (useAnnouncementsStore.persist.hasHydrated()) setAnnouncementsHydrated(true);
    return unsub;
  }, []);

  // Start boot sequence when all stores are hydrated
  useEffect(() => {
    if (!authHydrated || !onboardingHydrated || !announcementsHydrated) return;

    const noTokens = !token && !refreshToken;

    if (noTokens) {
      if (!onboardingDone) {
        router.replace('/onboarding');
      } else {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Has tokens — show loading screen, prefetch data
    setPhase('loading');
    bootstrap();
  }, [authHydrated, onboardingHydrated, announcementsHydrated]);

  const bootstrap = async () => {
    let activeToken = token;

    // Silent refresh if no access token
    if (!activeToken && refreshToken && serverUrl) {
      try {
        const r = await fetch(`${serverUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (r.ok) {
          const data = await r.json();
          activeToken = data.accessToken;
          setToken(data.accessToken);
          setRefreshToken(data.refreshToken ?? null);
          if (data.user) setUser(data.user);
          saveToAppGroup(serverUrl, data.accessToken);
        } else {
          logout();
          router.replace(!onboardingDone ? '/onboarding' : '/(auth)/login');
          return;
        }
      } catch {
        logout();
        router.replace('/(auth)/login');
        return;
      }
    }

    if (!activeToken || !serverUrl) {
      router.replace('/(auth)/login');
      return;
    }

    const bearer = { Authorization: `Bearer ${activeToken}` };

    // Parallel prefetch
    await Promise.allSettled([
      // User profile + prefs
      fetch(`${serverUrl}/api/users/me`, { headers: bearer })
        .then(r => r.ok ? r.json() : null)
        .then(u => { if (u) setUser(u); }),
      // Notifications count
      fetch(`${serverUrl}/api/notifications`, { headers: bearer })
        .then(r => r.ok ? r.json() : [])
        .then((notifs: any[]) => setUnreadCount(notifs.filter((n: any) => !n.is_read).length)),
      // Prefs + language
      fetchPrefs(serverUrl, activeToken)
        .then(() => {
          const prefs = usePrefsStore.getState().prefs;
          if (prefs.language) {
            i18n.changeLanguage(prefs.language);
            saveLanguage(prefs.language as any);
          }
        })
        .catch(() => {}),
      // Announcements (public, ne bloque pas si erreur)
      fetch(ANNOUNCEMENTS_URL, { signal: AbortSignal.timeout?.(4000) })
        .then(r => r.ok ? r.json() : { announcements: [] })
        .then((data: { announcements: any[] }) => {
          const unseen = (data.announcements ?? []).filter((a: any) => !seenIds.includes(a.id));
          if (unseen.length > 0) setPending(unseen);
        })
        .catch(() => {}),
    ]);

    router.replace('/(app)/(tabs)/tasks');
  };

  return (
    <View style={ls.screen}>
      <Image source={require('../assets/icon-transparent.png')} style={ls.logo} resizeMode="contain" />
      {phase === 'loading' && (
        <>
          <Text style={ls.label}>Chargement en cours</Text>
          <LoadingDots />
        </>
      )}
    </View>
  );
}

const ls = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  logo:   { width: 96, height: 96, marginBottom: 32 },
  label:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 16, letterSpacing: 0.3 },
  dots:   { flexDirection: 'row', gap: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
});
