import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n, { loadSavedLanguage } from '@/i18n';
import BiometricLock from '@/components/BiometricLock';
import ToastBanner from '@/components/ToastBanner';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSavedLanguage().then((lang) => {
      i18n.changeLanguage(lang);
      setReady(true);
    });
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#A00000' }} />;

  return (
    <View style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }} />
          <BiometricLock />
          <ToastBanner />
        </SafeAreaProvider>
      </I18nextProvider>
    </View>
  );
}
