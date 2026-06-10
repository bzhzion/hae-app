import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

export default function Index() {
  const [hydrated, setHydrated] = useState(false);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8' }}>
        <ActivityIndicator color="#A00000" />
      </View>
    );
  }

  return <Redirect href={token ? '/(app)/(tabs)/tasks' : '/(auth)/login'} />;
}
