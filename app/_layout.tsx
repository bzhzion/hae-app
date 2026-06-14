import { Component, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nextProvider } from 'react-i18next';
import i18n, { loadSavedLanguage } from '@/i18n';
import BiometricLock from '@/components/BiometricLock';
import ToastBanner from '@/components/ToastBanner';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: any) {
    return { error: String(e?.message ?? e) };
  }
  componentDidCatch(e: any) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', e);
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#A00000', padding: 24, justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 12 }}>JS CRASH</Text>
          <ScrollView><Text style={{ color: '#fff', fontSize: 12 }}>{this.state.error}</Text></ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <I18nextProvider i18n={i18n}>
          <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false }} />
            <BiometricLock />
            <ToastBanner />
          </SafeAreaProvider>
        </I18nextProvider>
      </View>
    </ErrorBoundary>
  );
}
