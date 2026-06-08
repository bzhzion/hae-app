import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

export default function LoginScreen() {
  const router = useRouter();
  const { serverUrl, setServerUrl, setToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!serverUrl || !email || !password) { setError('Tous les champs sont requis'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur de connexion');
      setToken(data.accessToken);
      router.replace('/(app)/(tabs)/tasks');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.inner}>
        <Text style={s.logo}>해</Text>
        <Text style={s.tagline}>Fais-le.</Text>

        <Text style={s.label}>SERVEUR</Text>
        <TextInput style={s.input} placeholder="https://hae.exemple.com" value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" keyboardType="url" placeholderTextColor="#9CA3AF" />

        <Text style={s.label}>EMAIL</Text>
        <TextInput style={s.input} placeholder="vous@exemple.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#9CA3AF" />

        <Text style={s.label}>MOT DE PASSE</Text>
        <TextInput style={s.input} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#9CA3AF" />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.btn} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Se connecter</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const BRAND = '#A00000';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 64, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 4 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 40 },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 4, letterSpacing: 1 },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#fff', marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  error: { color: '#FFB3B3', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  btn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: BRAND, fontWeight: '700', fontSize: 16 },
});
