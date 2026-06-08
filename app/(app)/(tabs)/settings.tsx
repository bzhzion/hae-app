import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

export default function SettingsScreen() {
  const router = useRouter();
  const { serverUrl, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Réglages</Text>
      </View>

      <View style={s.body}>
        <Text style={s.sectionLabel}>SERVEUR</Text>
        <View style={s.block}>
          <Text style={s.blockText} numberOfLines={1}>{serverUrl || 'Non configuré'}</Text>
        </View>

        <View style={s.spacer} />

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BRAND = '#A00000';
const BG = '#FAFAF8';

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  header:      { paddingBottom: 20, paddingHorizontal: 24, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  title:       { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1 },
  body:        { padding: 24 },
  sectionLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#B0B0A8', marginBottom: 10 },
  block:       { backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#EBEBEB' },
  blockText:   { fontSize: 13, color: '#4A4A44', fontWeight: '500' },
  spacer:      { height: 32 },
  logoutBtn:   { borderWidth: 1, borderColor: '#F0CECE', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText:  { fontSize: 14, fontWeight: '600', color: BRAND, letterSpacing: 0.2 },
});
