import { useState, useCallback, useMemo } from 'react';
import { makeApi } from '@/lib/api';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { usePrefsStore } from '@/stores/prefs';
import UserAvatar from '@/components/UserAvatar';

const BRAND = '#A00000';
const BG = '#FAFAF8';
const HAE_SAVED_CREDS = 'hae-saved-creds';

interface AppUser { id: string; name: string; email: string; role: string; is_active: number; }

const ROLE_COLORS: Record<string, string> = { admin: '#A00000', user: '#6b7280' };

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { serverUrl, token, user: me, logout } = useAuthStore();
  const resetPrefs = usePrefsStore(s => s.reset);
  const { t } = useTranslation();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const appVersion = Constants.expoConfig?.version ?? '?';

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/api/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }, [api]);

  useFocusEffect(useCallback(() => {
    if (me?.role !== 'admin') { router.replace('/(app)/(tabs)/tasks'); return; }
    load();
  }, [load, me, router]));

  const toggleActive = (u: AppUser) => {
    const confirmMsg = u.is_active
      ? t('admin.disableConfirm', { name: u.name })
      : t('admin.enableConfirm', { name: u.name });
    const actionText = u.is_active ? t('admin.disableAccount') : t('admin.enableAccount');
    Alert.alert(actionText, confirmMsg, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: async () => {
        try {
          await api('PATCH', `/api/users/${u.id}`, { is_active: !u.is_active });
          await load();
        } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
      }},
    ]);
  };

  const changeRole = (u: AppUser) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    Alert.alert(t('projectSettings.changeRoleTitle'), t('admin.changeRoleConfirm', { name: u.name, role: newRole }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: async () => {
        try {
          await api('PATCH', `/api/users/${u.id}`, { role: newRole });
          await load();
        } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
      }},
    ]);
  };

  const handleResetApp = () => {
    Alert.alert(
      t('admin.resetConfirmTitle'),
      t('admin.resetConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('admin.resetData'), style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.clear();
            if (Platform.OS !== 'web') {
              try { await SecureStore.deleteItemAsync('hae-auth'); } catch {}
              try { await SecureStore.deleteItemAsync(HAE_SAVED_CREDS); } catch {}
            }
            resetPrefs();
            logout();
            router.replace('/(auth)/login');
          } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
        }},
      ]
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.title}>{t('admin.title')}</Text>
          <Text style={s.subtitle}>{t('admin.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}>

        {/* Serveur */}
        <Text style={s.sectionLabel}>{t('admin.server')}</Text>
        <View style={s.serverRow}>
          <Text style={s.serverUrl} numberOfLines={1}>{serverUrl || t('admin.notConfigured')}</Text>
          {serverUrl ? (
            <TouchableOpacity onPress={() => Clipboard.setStringAsync(serverUrl)}>
              <Feather name="copy" size={14} color="#8A8A80" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={s.divider} />

        {/* Utilisateurs */}
        <Text style={s.sectionLabel}>{t('admin.users')}{users.length > 0 ? ` (${users.length})` : ''}</Text>
        {loading
          ? <ActivityIndicator color={BRAND} style={{ marginVertical: 12 }} />
          : users.map(u => (
            <View key={u.id} style={[s.row, !u.is_active && { opacity: 0.45 }]}>
              <UserAvatar name={u.name} serverUrl={serverUrl} token={token ?? undefined} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{u.name}{u.id === me?.id ? ` ${t('admin.me')}` : ''}</Text>
                <Text style={s.rowSub}>{u.email}</Text>
              </View>
              <TouchableOpacity
                style={[s.roleBadge, { backgroundColor: (ROLE_COLORS[u.role] ?? '#6b7280') + '15', borderColor: (ROLE_COLORS[u.role] ?? '#6b7280') + '44' }]}
                onPress={() => u.id !== me?.id && changeRole(u)}
              >
                <Text style={[s.roleText, { color: ROLE_COLORS[u.role] ?? '#6b7280' }]}>{u.role}</Text>
              </TouchableOpacity>
              {u.id !== me?.id && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: u.is_active ? '#FFF0F0' : '#F0FFF0' }]}
                  onPress={() => toggleActive(u)}
                >
                  <Text style={[s.actionBtnText, { color: u.is_active ? BRAND : '#16a34a' }]}>
                    {u.is_active ? '⏸' : '▶'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        }
        <View style={s.divider} />

        {/* À propos */}
        <Text style={s.sectionLabel}>{t('admin.about')}</Text>
        <View style={s.block}>
          <View style={[s.aboutRow, { borderBottomWidth: 1, borderBottomColor: '#F0F0EC' }]}>
            <Text style={s.aboutLabel}>{t('admin.version')}</Text>
            <Text style={s.aboutValue}>{appVersion}</Text>
          </View>
          <TouchableOpacity style={s.aboutRow} onPress={() => Linking.openURL('https://hae.breizhzion.fr')}>
            <Text style={s.aboutLabel}>{t('admin.officialSite')}</Text>
            <Text style={[s.aboutValue, { color: BRAND }]}>hae.breizhzion.fr ›</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.copyright}>{t('admin.copyright', { year: new Date().getFullYear() })}</Text>

        {/* Paramètres avancés */}
        <TouchableOpacity style={s.advancedToggle} onPress={() => setAdvancedVisible(v => !v)}>
          <Text style={s.advancedToggleText}>{advancedVisible ? '▲' : '▼'} {t('admin.advancedSettings')}</Text>
        </TouchableOpacity>

        {advancedVisible && (
          <View style={[s.block, { marginBottom: 8 }]}>
            <Text style={[s.sectionLabel, { marginBottom: 12 }]}>{t('admin.dangerZone')}</Text>
            <TouchableOpacity style={s.dangerRow} onPress={handleResetApp}>
              <Text style={s.dangerLabel}>{t('admin.resetData')}</Text>
              <Text style={s.dangerHint}>{t('admin.resetDesc')}</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: BG },
  header:            { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  backBtn:           { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:          { fontSize: 28, color: '#4A4A44', fontWeight: '300', marginTop: -4 },
  title:             { fontSize: 13, fontWeight: '700', letterSpacing: 2, color: '#1A1A1A' },
  subtitle:          { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  body:              { padding: 24 },
  sectionLabel:      { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 10 },
  divider:           { height: 1, backgroundColor: '#F0F0EC', marginVertical: 24 },
  serverRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  serverUrl:         { fontSize: 12, color: '#6B6B63', flex: 1 },
  row:               { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowName:           { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  rowSub:            { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  roleBadge:         { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:          { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  actionBtn:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnText:     { fontSize: 12, fontWeight: '600' },
  block:             { backgroundColor: '#fff', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#EBEBEB' },
  aboutRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  aboutLabel:        { fontSize: 14, color: '#4A4A44', fontWeight: '500' },
  aboutValue:        { fontSize: 13, color: '#6B6B63', fontWeight: '500' },
  copyright:         { fontSize: 11, color: '#8A8A80', textAlign: 'center', marginTop: 10, marginBottom: 4 },
  advancedToggle:    { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  advancedToggleText:{ fontSize: 11, fontWeight: '600', color: '#8A8A80', letterSpacing: 0.5 },
  dangerRow:         { paddingHorizontal: 14, paddingVertical: 12 },
  dangerLabel:       { fontSize: 14, fontWeight: '600', color: BRAND },
  dangerHint:        { fontSize: 12, color: '#6B6B63', marginTop: 3 },
});
