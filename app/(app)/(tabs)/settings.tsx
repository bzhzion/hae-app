import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { makeApi } from '@/lib/api';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useOnboardingStore } from '@/stores/onboarding';
import { LANGUAGES, saveLanguage, type Language } from '@/i18n';
import UserAvatar from '@/components/UserAvatar';
import AiConfigSection from '@/components/AiConfigSection';
import { Switch, Platform as RNPlatform } from 'react-native';
import { useBiometricStore } from '@/stores/biometric';
import { usePrefsStore } from '@/stores/prefs';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const HAE_SAVED_CREDS = 'hae-saved-creds';

const BRAND = '#A00000';
const BG = '#FAFAF8';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { serverUrl, token, user: me, logout } = useAuthStore();
  const resetPrefs = usePrefsStore(s => s.reset);
  const resetOnboarding = useOnboardingStore(s => s.reset);
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

  const api = useMemo(() => makeApi(serverUrl ?? '', token ?? ''), [serverUrl, token]);

  const appVersion = Constants.expoConfig?.version ?? '?';
  const [advancedVisible, setAdvancedVisible] = useState(false);

  const handleResetApp = () => {
    Alert.alert(
      t('admin.resetConfirmTitle'),
      t('admin.resetConfirmMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('admin.resetData'), style: 'destructive', onPress: async () => {
          try {
            await AsyncStorage.clear();
            if (RNPlatform.OS !== 'web') {
              try { await SecureStore.deleteItemAsync('hae-auth'); } catch {}
              try { await SecureStore.deleteItemAsync(HAE_SAVED_CREDS); } catch {}
            }
            resetPrefs();
            resetOnboarding();
            logout();
            router.replace('/(auth)/login');
          } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
        }},
      ]
    );
  };

  const [ingestToken, setIngestToken] = useState<string | null>(null);
  const [ingestConfigured, setIngestConfigured] = useState(false);
  const [ingestTokenLoading, setIngestTokenLoading] = useState(false);
  const [ingestCopied, setIngestCopied] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const changeAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('common.permissionDenied'), t('settings.galleryPermission')); return; }
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
      Alert.alert(t('common.error'), e.message ?? 'Upload échoué');
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

  useEffect(() => {
    api('GET', '/api/users/me/ingest-token', undefined, { silent: true })
      .then((r: any) => setIngestConfigured(!!r?.configured))
      .catch(() => {});
  }, [api]);

  const generateIngestToken = useCallback(async () => {
    const doGenerate = async () => {
      setIngestTokenLoading(true);
      try {
        const r: any = await api('POST', '/api/users/me/ingest-token');
        if (r?.token) {
          setIngestToken(r.token);
          setIngestCopied(false);
          setShowTokenModal(true);
        }
        setIngestConfigured(true);
      } catch (e: any) { Alert.alert(t('common.error'), e.message); }
      finally { setIngestTokenLoading(false); }
    };

    if (ingestConfigured) {
      Alert.alert(
        t('settings.regenTokenTitle'),
        t('settings.regenTokenMsg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('settings.regen'), style: 'destructive', onPress: doGenerate },
        ]
      );
    } else {
      doGenerate();
    }
  }, [api, ingestConfigured, t]);

  const copyIngestToken = useCallback(async () => {
    if (!ingestToken) return;
    await Clipboard.setStringAsync(ingestToken);
    setIngestCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setIngestCopied(false), 2000);
  }, [ingestToken]);

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
          <TouchableOpacity style={s.adminChip} onPress={() => router.push('/(app)/admin')} accessibilityRole="button">
            <Text style={s.adminChipText}>{t('settings.admin')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>

        {me && (
          <>
            <View style={s.profileRow}>
              <TouchableOpacity onPress={changeAvatar} disabled={uploadingAvatar} style={{ position: 'relative' }} accessibilityLabel="Change profile picture" accessibilityRole="button">
                <UserAvatar name={me.name} serverUrl={serverUrl} token={token ?? undefined} size={48} avatarUrl={me.avatar_url ?? undefined} />
                {uploadingAvatar
                  ? <View style={s.avatarLoader}><ActivityIndicator size="small" color="#fff" accessibilityLabel="Uploading..." /></View>
                  : <View style={s.avatarEditBadge}><Text style={{ fontSize: 10, color: '#fff' }}>✎</Text></View>
                }
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.profileName}>{me.name}</Text>
                <Text style={s.profileEmail}>{me.email}</Text>
              </View>
              <TouchableOpacity style={s.editProfileBtn} onPress={() => { setEditName(me.name); setShowEditProfile(true); }} accessibilityRole="button">
                <Text style={s.editProfileBtnText}>{t('settings.modify')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.pwBtn} onPress={() => { setPwCurrent(''); setPwNew(''); setPwError(''); setShowChangePassword(true); }} accessibilityRole="button">
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
                accessibilityLabel="Enable biometrics"
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
              accessibilityRole="radio"
              accessibilityState={{ selected: currentLang === l.code }}
            >
              <Text style={s.langFlag}>{l.flag}</Text>
              <Text style={[s.langLabel, currentLang === l.code && s.langLabelActive]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.divider} />
        <AiConfigSection
          api={api}
          configPath="/api/users/me/ai-config"
          titleKey="titleUser"
          subtitleKey="subtitleUser"
        />

        <View style={s.divider} />

        <Text style={s.sectionLabel}>{t('settings.apiTokenTitle')}</Text>
        <Text style={{ fontSize: 12, color: '#6B6B63', marginBottom: 12 }}>
          Permet à des apps externes d'envoyer des notifications via{'\n'}
          <Text style={{ fontFamily: 'monospace', color: '#1A1A1A' }}>POST {serverUrl}/api/ingest{'\n'}</Text>
          avec{' '}<Text style={{ fontFamily: 'monospace', color: '#1A1A1A' }}>Authorization: Bearer &lt;token&gt;</Text>
        </Text>
        {ingestConfigured ? (
          <Text style={{ fontSize: 12, color: '#8A8A80', marginBottom: 8 }}>{t('settings.tokenActive')}</Text>
        ) : (
          <Text style={{ fontSize: 12, color: '#8A8A80', marginBottom: 8 }}>{t('settings.noToken')}</Text>
        )}
        <TouchableOpacity
          style={[s.editProfileBtn, { alignSelf: 'flex-start', marginTop: 8 }]}
          onPress={generateIngestToken}
          disabled={ingestTokenLoading}
          accessibilityRole="button"
        >
          {ingestTokenLoading
            ? <ActivityIndicator size="small" color={BRAND} />
            : <Text style={s.editProfileBtnText}>{ingestConfigured ? t('settings.regen') : 'Générer un token'}</Text>
          }
        </TouchableOpacity>

        {/* Modal token — affiché une seule fois */}
        <Modal visible={showTokenModal} transparent animationType="fade" onRequestClose={() => {}}>
          <View style={s.tokenModalOverlay}>
            <View style={s.tokenModalBox}>
              <View style={s.tokenModalWarning}>
                <Feather name="alert-triangle" size={20} color="#fff" />
                <Text style={s.tokenModalWarningText}>{t('settings.copyNow')}</Text>
              </View>
              <Text style={s.tokenModalDesc}>
                {t('settings.tokenOnce')}
              </Text>
              <View style={s.tokenModalTokenRow}>
                <Text style={s.tokenModalToken} selectable numberOfLines={2}>
                  {ingestToken}
                </Text>
              </View>
              <TouchableOpacity
                style={[s.tokenModalCopyBtn, ingestCopied && s.tokenModalCopyBtnDone]}
                onPress={copyIngestToken}
                accessibilityRole="button"
              >
                <Feather name={ingestCopied ? 'check' : 'copy'} size={16} color="#fff" />
                <Text style={s.tokenModalCopyText}>{ingestCopied ? t('settings.copied') : t('settings.copyToken')}</Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && ingestToken && (
                <TouchableOpacity
                  style={s.tokenModalShortcutBtn}
                  onPress={() => Linking.openURL(`${serverUrl}/api/shortcut?token=${encodeURIComponent(ingestToken)}`)}
                  accessibilityRole="button"
                >
                  <Feather name="share" size={15} color={BRAND} />
                  <Text style={s.tokenModalShortcutText}>Installer raccourci iOS</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.tokenModalDoneBtn}
                onPress={() => { setShowTokenModal(false); setIngestToken(null); }}
                accessibilityRole="button"
              >
                <Text style={s.tokenModalDoneText}>{t('settings.tokenCopied')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={s.divider} />

        <Text style={s.sectionLabel}>{t('admin.about')}</Text>
        <View style={s.block}>
          <View style={[s.aboutRow, { borderBottomWidth: 1, borderBottomColor: '#F0F0EC' }]}>
            <Text style={s.aboutLabel}>{t('admin.version')}</Text>
            <Text style={s.aboutValue}>{appVersion}</Text>
          </View>
          <TouchableOpacity style={s.aboutRow} onPress={() => Linking.openURL('https://hae.breizhzion.com')}>
            <Text style={s.aboutLabel}>{t('admin.officialSite')}</Text>
            <Text style={[s.aboutValue, { color: BRAND }]}>hae.breizhzion.com ›</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.copyright}>{t('admin.copyright', { year: new Date().getFullYear() })}</Text>

        <TouchableOpacity style={s.advancedToggle} onPress={() => setAdvancedVisible(v => !v)}>
          <Text style={s.advancedToggleText}>{advancedVisible ? '▲' : '▼'} {t('admin.advancedSettings')}</Text>
        </TouchableOpacity>

        {advancedVisible && (
          <View style={s.dangerBlock}>
            <Text style={s.dangerZoneLabel}>{t('admin.dangerZone')}</Text>
            <View style={s.block}>
              <TouchableOpacity style={[s.dangerRow, { borderBottomWidth: 1, borderColor: '#F0F0EC' }]} onPress={() => {
                resetOnboarding();
                router.replace('/onboarding');
              }}>
                <Text style={[s.dangerLabel, { color: '#4A4A44' }]}>{t('settings.reviewOnboarding')}</Text>
                <Text style={s.dangerHint}>S'affichera au prochain démarrage de l'app.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.dangerRow} onPress={handleResetApp}>
                <Text style={s.dangerLabel}>{t('admin.resetData')}</Text>
                <Text style={s.dangerHint}>{t('admin.resetDesc')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={s.spacer} />

        <TouchableOpacity style={s.logoutBtn} onPress={() => { resetPrefs(); logout(); router.replace('/(auth)/login'); }} accessibilityRole="button">
          <Text style={s.logoutText}>{t('settings.logout')}</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={showEditProfile} transparent animationType="slide" onRequestClose={() => setShowEditProfile(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEditProfile(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal={true}>
              <Text style={s.sheetTitle}>{t('settings.editProfile')}</Text>
              <Text style={[s.sectionLabel, { marginBottom: 8 }]}>{t('settings.name')}</Text>
              <TextInput style={s.sheetInput} value={editName} onChangeText={setEditName} autoFocus accessibilityLabel="Full name" maxLength={100} />
              <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={saveProfile} disabled={editProfileLoading} accessibilityRole="button" accessibilityState={{ disabled: editProfileLoading }}>
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
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal={true}>
              <Text style={s.sheetTitle}>{t('settings.changePasswordTitle')}</Text>
              <Text style={[s.sectionLabel, { marginBottom: 8 }]}>{t('settings.currentPassword')}</Text>
              <TextInput style={s.sheetInput} value={pwCurrent} onChangeText={setPwCurrent} secureTextEntry autoFocus accessibilityLabel="Current password" maxLength={128} />
              <Text style={[s.sectionLabel, { marginTop: 12, marginBottom: 8 }]}>{t('settings.newPassword')}</Text>
              <TextInput style={s.sheetInput} value={pwNew} onChangeText={setPwNew} secureTextEntry accessibilityLabel="New password" maxLength={128} />
              {pwError ? <Text style={[s.inviteError, { marginTop: 8 }]}>{pwError}</Text> : null}
              <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={changePassword} disabled={pwLoading} accessibilityRole="button" accessibilityState={{ disabled: pwLoading }}>
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
  tokenRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  tokenText:        { flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#1A1A1A' },
  tokenBtn:         { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  block:            { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#EBEBEB' },
  aboutRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14 },
  aboutLabel:       { fontSize: 14, color: '#4A4A44', fontWeight: '500' },
  aboutValue:       { fontSize: 13, color: '#6B6B63', fontWeight: '500' },
  copyright:        { fontSize: 11, color: '#8A8A80', textAlign: 'center', marginTop: 10, marginBottom: 4 },
  advancedToggle:   { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  advancedToggleText:{ fontSize: 11, fontWeight: '600', color: '#8A8A80', letterSpacing: 0.5 },
  dangerBlock:      { marginBottom: 8 },
  dangerZoneLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 10 },
  dangerRow:        { paddingHorizontal: 14, paddingVertical: 12 },
  dangerLabel:      { fontSize: 14, fontWeight: '600', color: BRAND },
  dangerHint:       { fontSize: 12, color: '#6B6B63', marginTop: 3 },
  tokenModalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  tokenModalBox:        { backgroundColor: '#fff', borderRadius: 16, width: '100%', overflow: 'hidden' },
  tokenModalWarning:    { backgroundColor: BRAND, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  tokenModalWarningText:{ color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  tokenModalDesc:       { fontSize: 13, color: '#4A4A44', lineHeight: 20, padding: 16, paddingBottom: 8 },
  tokenModalTokenRow:   { marginHorizontal: 16, backgroundColor: '#F5F5F0', borderRadius: 10, padding: 14, marginBottom: 16 },
  tokenModalToken:      { fontFamily: 'monospace', fontSize: 12, color: '#1A1A1A', lineHeight: 20 },
  tokenModalCopyBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', marginHorizontal: 16, borderRadius: 10, paddingVertical: 13 },
  tokenModalCopyBtnDone:{ backgroundColor: '#16a34a' },
  tokenModalCopyText:   { color: '#fff', fontSize: 14, fontWeight: '700' },
  tokenModalShortcutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, borderWidth: 1.5, borderColor: BRAND + '55', borderRadius: 10, paddingVertical: 12 },
  tokenModalShortcutText:{ fontSize: 14, fontWeight: '600', color: BRAND },
  tokenModalDoneBtn:    { alignItems: 'center', paddingVertical: 16 },
  tokenModalDoneText:   { fontSize: 14, color: '#6B6B63', fontWeight: '600' },
});
