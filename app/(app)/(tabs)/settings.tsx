import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { LANGUAGES, saveLanguage, type Language } from '@/i18n';
import UserAvatar from '@/components/UserAvatar';
import { Switch, Platform as RNPlatform } from 'react-native';
import { useBiometricStore } from '@/stores/biometric';
import { usePrefsStore } from '@/stores/prefs';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';

const BRAND = '#A00000';
const BG = '#FAFAF8';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { serverUrl, token, user: me, logout } = useAuthStore();
  const resetPrefs = usePrefsStore(s => s.reset);
  const { t, i18n } = useTranslation();

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editProfileLoading, setEditProfileLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');

  const api = useCallback(async (method: string, path: string, body?: any) => {
    const r = await fetch(`${serverUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? 'Erreur'); }
    if (r.status === 204) return null;
    return r.json();
  }, [serverUrl, token]);

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission refusée', 'Accès à la galerie requis.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      const ext = asset.uri.split('.').pop() ?? 'jpg';
      formData.append('file', { uri: asset.uri, name: `avatar.${ext}`, type: asset.mimeType ?? 'image/jpeg' } as any);
      const r = await fetch(`${serverUrl}/api/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!r.ok) throw new Error(await r.text());
      const { avatar_url } = await r.json();
      useAuthStore.getState().setUser({ ...me!, avatar_url });
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Upload échoué');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    if (!editName.trim()) return;
    setEditProfileLoading(true);
    try {
      const updated = await api('PATCH', '/api/users/me', { name: editName.trim() });
      useAuthStore.getState().setUser({ ...me!, name: updated.name });
      setShowEditProfile(false);
    } catch (e: any) { Alert.alert(t('common.error'), e.message); }
    finally { setEditProfileLoading(false); }
  };

  const changePassword = async () => {
    setPwError('');
    if (!pwCurrent || !pwNew) { setPwError(t('settings.fillAllFields')); return; }
    if (pwNew.length < 8) { setPwError(t('settings.minChars')); return; }
    setPwLoading(true);
    try {
      await api('PATCH', '/api/users/me/password', { currentPassword: pwCurrent, newPassword: pwNew });
      setShowChangePassword(false);
      setPwCurrent(''); setPwNew('');
      Alert.alert(t('common.success'), t('settings.passwordSuccess'));
    } catch (e: any) { setPwError(e.message); }
    finally { setPwLoading(false); }
  };

  const [currentLang, setCurrentLang] = useState<Language>((i18n.language as Language) ?? 'en');
  const { enabled: bioEnabled, setEnabled: setBioEnabled } = useBiometricStore();
  const [hasHardware, setHasHardware] = useState(false);
  const savePrefs = usePrefsStore(s => s.save);

  useEffect(() => {
    if (RNPlatform.OS !== 'web') {
      LocalAuthentication.hasHardwareAsync().then(setHasHardware);
    }
  }, []);

  const changeLang = useCallback(async (lang: Language) => {
    setCurrentLang(lang);
    await i18n.changeLanguage(lang);
    await saveLanguage(lang);
    if (serverUrl && token) savePrefs(serverUrl, token, { language: lang });
  }, [i18n, serverUrl, token, savePrefs]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>{t('settings.title')}</Text>
        {me?.role === 'admin' && (
          <TouchableOpacity style={s.adminChip} onPress={() => router.push('/(app)/admin')}>
            <Text style={s.adminChipText}>{t('settings.admin')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}>

        {me && (
          <>
            <View style={s.profileRow}>
              <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar} style={{ position: 'relative' }}>
                <UserAvatar name={me.name} serverUrl={serverUrl} token={token ?? undefined} size={48} avatarUrl={me.avatar_url ?? undefined} />
                {uploadingAvatar
                  ? <View style={s.avatarLoader}><ActivityIndicator size="small" color="#fff" /></View>
                  : <View style={s.avatarEditBadge}><Text style={{ fontSize: 10, color: '#fff' }}>✎</Text></View>
                }
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.profileName}>{me.name}</Text>
                <Text style={s.profileEmail}>{me.email}</Text>
              </View>
              <TouchableOpacity style={s.editProfileBtn} onPress={() => { setEditName(me.name); setShowEditProfile(true); }}>
                <Text style={s.editProfileBtnText}>{t('settings.modify')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.pwBtn} onPress={() => { setPwCurrent(''); setPwNew(''); setPwError(''); setShowChangePassword(true); }}>
              <Text style={s.pwBtnText}>{t('settings.changePassword')}</Text>
              <Text style={s.chevron}>›</Text>
            </TouchableOpacity>
            <View style={s.divider} />
          </>
        )}

        {hasHardware && (
          <>
            <View style={[s.sectionHead, { marginBottom: 16 }]}>
              <View>
                <Text style={s.sectionLabel}>{t('settings.biometrics')}</Text>
                <Text style={{ fontSize: 12, color: '#6B6B63', marginTop: 2 }}>{t('settings.biometricsDesc')}</Text>
              </View>
              <Switch
                value={bioEnabled}
                onValueChange={setBioEnabled}
                trackColor={{ false: '#EBEBEB', true: BRAND }}
                thumbColor="#fff"
              />
            </View>
            <View style={s.divider} />
          </>
        )}

        <Text style={s.sectionLabel}>{t('settings.language')}</Text>
        <View style={s.langRow}>
          {LANGUAGES.map(l => (
            <TouchableOpacity
              key={l.code}
              style={[s.langBtn, currentLang === l.code && s.langBtnActive]}
              onPress={() => changeLang(l.code)}
            >
              <Text style={s.langFlag}>{l.flag}</Text>
              <Text style={[s.langLabel, currentLang === l.code && s.langLabelActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.spacer} />

        <TouchableOpacity style={s.logoutBtn} onPress={() => { resetPrefs(); logout(); router.replace('/(auth)/login'); }}>
          <Text style={s.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEditProfile(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={s.sheetTitle}>{t('settings.editProfile')}</Text>
              <Text style={[s.sectionLabel, { marginBottom: 8 }]}>{t('settings.name')}</Text>
              <TextInput style={s.sheetInput} value={editName} onChangeText={setEditName} autoFocus />
              <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={saveProfile} disabled={editProfileLoading}>
                {editProfileLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showChangePassword} transparent animationType="slide" onRequestClose={() => setShowChangePassword(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowChangePassword(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={s.sheetTitle}>{t('settings.changePasswordTitle')}</Text>
              <Text style={[s.sectionLabel, { marginBottom: 8 }]}>{t('settings.currentPassword')}</Text>
              <TextInput style={s.sheetInput} value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry autoFocus />
              <Text style={[s.sectionLabel, { marginTop: 12, marginBottom: 8 }]}>{t('settings.newPassword')}</Text>
              <TextInput style={s.sheetInput} value={pwNew} onChangeText={setPwNew} secureTextEntry />
              {pwError ? <Text style={[s.inviteError, { marginTop: 8 }]}>{pwError}</Text> : null}
              <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={changePassword} disabled={pwLoading}>
                {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('common.confirm')}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: BG },
  header:           { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 16, paddingHorizontal: 24, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  title:            { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, flex: 1 },
  adminChip:        { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 2 },
  adminChipText:    { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  body:             { padding: 24 },
  sectionHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel:     { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 10 },
  divider:          { height: 1, backgroundColor: '#F0F0EC', marginVertical: 24 },
  profileRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarEditBadge:  { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  avatarLoader:     { position: 'absolute', inset: 0, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  profileName:      { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  profileEmail:     { fontSize: 12, color: '#6B6B63', marginTop: 2 },
  editProfileBtn:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#EBEBEB' },
  editProfileBtnText:{ fontSize: 12, fontWeight: '600', color: '#4A4A44' },
  pwBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  pwBtnText:        { fontSize: 14, color: '#4A4A44', fontWeight: '500' },
  chevron:          { fontSize: 18, color: '#8A8A80' },
  langRow:          { flexDirection: 'row', gap: 8, marginBottom: 4 },
  langBtn:          { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#EBEBEB', paddingVertical: 10, alignItems: 'center', gap: 4 },
  langBtnActive:    { borderColor: BRAND, backgroundColor: '#FFF5F5' },
  langFlag:         { fontSize: 20 },
  langLabel:        { fontSize: 11, fontWeight: '600', color: '#6B6B63', letterSpacing: 0.3 },
  langLabelActive:  { color: BRAND },
  spacer:           { height: 32 },
  logoutBtn:        { borderWidth: 1, borderColor: '#F0CECE', borderRadius: 8, padding: 14, alignItems: 'center' },
  logoutText:       { fontSize: 14, fontWeight: '600', color: BRAND, letterSpacing: 0.2 },
  sheet:            { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle:       { fontSize: 13, fontWeight: '700', letterSpacing: 1, color: '#6B6B63', marginBottom: 16 },
  sheetInput:       { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inviteError:      { fontSize: 13, color: BRAND, marginBottom: 8 },
  saveBtn:          { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
});
