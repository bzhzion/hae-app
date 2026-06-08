import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
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
    if (!serverUrl || !email || !password) {
      setError('Tous les champs sont requis');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${serverUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur de connexion');
      setToken(data.accessToken);
      router.replace('/(app)/(tabs)/inbox');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-5xl font-bold text-center text-[#A00000] mb-2">해</Text>
        <Text className="text-center text-gray-500 mb-10">Fais-le.</Text>

        <Text className="text-xs text-gray-400 uppercase mb-1">Serveur</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-base"
          placeholder="https://hae.exemple.com"
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text className="text-xs text-gray-400 uppercase mb-1">Email</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 mb-4 text-base"
          placeholder="vous@exemple.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text className="text-xs text-gray-400 uppercase mb-1">Mot de passe</Text>
        <TextInput
          className="border border-gray-200 rounded-xl px-4 py-3 mb-6 text-base"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text className="text-red-500 text-sm mb-4 text-center">{error}</Text> : null}

        <TouchableOpacity
          className="bg-[#A00000] rounded-xl py-4 items-center"
          onPress={login}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-semibold text-base">Se connecter</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
