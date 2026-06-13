import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { saveToAppGroup } from '@/modules/hae-app-group';
import { usePrefsStore } from '@/stores/prefs';
import { saveLanguage } from '@/i18n';
import i18n from '@/i18n';

const CREDS_KEY = 'hae-saved-creds';

interface SavedCreds { serverUrl: string; email: string; }

async function loadSavedCreds(): Promise<SavedCreds | null> {
  try {
    if (Platform.OS === 'web') return null;
    const raw = await SecureStore.getItemAsync(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

async function saveCreds(c: SavedCreds) {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify(c));
}

async function clearCreds() {
  if (Platform.OS === 'web') return;
  try { await SecureStore.deleteItemAsync(CREDS_KEY); } catch {}
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { serverUrl, setServerUrl, setToken, setRefreshToken, setUser } = useAuthStore();
  const fetchPrefs = usePrefsStore(s => s.fetch);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSavedCreds().then(c => {
      if (!c) return;
      if (c.serverUrl) setServerUrl(c.serverUrl);
      if (c.email) { setEmail(c.email); setRememberMe(true); }
    });
  }, []);

  const submit = async () => {
    const trimmedServerUrl = serverUrl.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedServerUrl || !trimmedEmail || !password || (mode === 'register' && !name)) {
      setError(t('auth.allFieldsRequired')); return;
    }
    if (trimmedServerUrl !== serverUrl) setServerUrl(trimmedServerUrl);
    const isLocalhost = trimmedServerUrl.startsWith('http://localhost') || trimmedServerUrl.startsWith('http://127.0.0.1');
    if (!trimmedServerUrl.startsWith('https://') && !isLocalhost) {
      setError(t('login.urlError')); return;
    }
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login' ? { email: trimmedEmail, password } : { email: trimmedEmail, password, name };
      const res = await fetch(`${trimmedServerUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      if (raw.includes('<!DOCTYPE') || raw.includes('<html')) throw new Error(t('login.serverUnreachable'));
      let data: any = {};
      try { data = JSON.parse(raw); } catch { if (!res.ok) throw new Error(raw || t('common.error')); }
      if (!res.ok) throw new Error(data.error ?? raw ?? t('common.error'));

      if (rememberMe) {
        await saveCreds({ serverUrl: trimmedServerUrl, email: trimmedEmail });
      } else {
        await clearCreds();
      }

      setToken(data.accessToken);
      setRefreshToken(data.refreshToken ?? null);
      setUser(data.user);
      saveToAppGroup(trimmedServerUrl, data.accessToken);
      const prefs = await fetchPrefs(trimmedServerUrl, data.accessToken).then(() => usePrefsStore.getState().prefs);
      if (prefs.language) {
        await i18n.changeLanguage(prefs.language);
        await saveLanguage(prefs.language as any);
      }
      router.replace('/(app)/(tabs)/tasks');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.inner} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        <Image source={require('../../assets/icon-transparent.png')} style={s.logo} resizeMode="contain" accessible={false} />
        <Text style={s.tagline}>{t('auth.tagline')}</Text>

        <Text style={s.label}>{t('auth.serverUrl')}</Text>
        <TextInput style={s.input} placeholder={t('login.serverPlaceholder')} value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" keyboardType="url" placeholderTextColor="#9CA3AF" accessibilityLabel="Server URL" maxLength={500} />

        {mode === 'register' && (
          <>
            <Text style={s.label}>{t('auth.name')}</Text>
            <TextInput style={s.input} placeholder={t('login.namePlaceholder')} value={name} onChangeText={setName} autoCapitalize="words" placeholderTextColor="#9CA3AF" accessibilityLabel="Your name" maxLength={100} />
          </>
        )}

        <Text style={s.label}>{t('auth.email')}</Text>
        <TextInput style={s.input} placeholder={t('login.emailPlaceholder')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#9CA3AF" accessibilityLabel="Email address" maxLength={254} />

        <Text style={s.label}>{t('auth.password')}</Text>
        <TextInput style={s.input} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#9CA3AF" accessibilityLabel="Password" maxLength={128} />

        {mode === 'login' && (
          <TouchableOpacity style={s.rememberRow} onPress={() => setRememberMe(v => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }} accessibilityLabel="Remember me">
            <View style={[s.checkbox, rememberMe && s.checkboxChecked]}>
              {rememberMe && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.rememberText}>{t('auth.rememberMe')}</Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.btn} onPress={submit} disabled={loading} accessibilityRole="button" accessibilityState={{ disabled: loading }}>
          {loading ? <ActivityIndicator color={BRAND} /> : (
            <Text style={s.btnText}>{mode === 'login' ? t('auth.login') : t('auth.createAccount')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.switchBtn} onPress={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }} accessibilityRole="button">
          <Text style={s.switchText}>
            {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const BRAND = '#A00000';

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BRAND },
  inner:           { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  logo:            { width: 120, height: 120, alignSelf: 'center', marginBottom: 4 },
  tagline:         { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 40 },
  label:           { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4, letterSpacing: 1 },
  input:           { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#fff', marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  rememberRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  checkbox:        { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#fff', borderColor: '#fff' },
  checkmark:       { fontSize: 12, color: BRAND, fontWeight: '700' },
  rememberText:    { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  error:           { color: '#FFB3B3', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  btn:             { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText:         { color: BRAND, fontWeight: '700', fontSize: 16 },
  switchBtn:       { marginTop: 20, alignItems: 'center' },
  switchText:      { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
});
