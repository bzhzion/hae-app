import { useState, useCallback, useMemo } from 'react';
import { makeApi } from '@/lib/api';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { showToast } from '@/stores/toast';
import { useOrgStore } from '@/stores/org';

const BRAND = '#A00000';
const BG = '#FAFAF8';

const ROLE_COLOR: Record<string, string> = { owner: BRAND, admin: '#2563eb', member: '#6b7280' };

export default function OrganisationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { serverUrl, token } = useAuthStore();
  const { orgs, setOrgs } = useOrgStore();
  const [loading, setLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/api/organisations');
      setOrgs(Array.isArray(data) ? data : []);
    } catch { showToast(t('common.loadError')); }
    finally { setLoading(false); }
  }, [api, setOrgs]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createOrg = async () => {
    setCreateError('');
    if (!newName.trim()) { setCreateError(t('orgs.nameRequired')); return; }
    setCreating(true);
    try {
      await api('POST', '/api/organisations', { name: newName.trim(), description: newDesc.trim() || undefined });
      setShowCreate(false);
      setNewName(''); setNewDesc('');
      await load();
    } catch (e: any) { setCreateError(e.message); }
    finally { setCreating(false); }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>{t('orgs.title')}</Text>
        <TouchableOpacity style={s.addBtn} accessibilityRole="button" onPress={() => { setShowCreate(true); setCreateError(''); setNewName(''); setNewDesc(''); }}>
          <Text style={s.addBtnText}>+ {t('orgs.create')}</Text>
        </TouchableOpacity>
      </View>

      {loading
        ? <View style={s.center}><ActivityIndicator color={BRAND} accessibilityLabel="Loading organisations" /></View>
        : (
          <FlatList
            data={orgs}
            keyExtractor={i => i.id}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Text style={s.emptyMain}>{t('orgs.noOrgs')}</Text>
                <Text style={s.emptySub}>{t('orgs.createOrJoin')}</Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={s.sep} />}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.row} accessibilityRole="button" accessibilityLabel={item.name + ' - ' + item.my_role} onPress={() => router.push(`/organisation/${item.id}`)}>
                <View style={s.orgAvatar}>
                  <Text style={s.orgAvatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.orgName}>{item.name}</Text>
                  {item.description ? <Text style={s.orgDesc} numberOfLines={1}>{item.description}</Text> : null}
                </View>
                <View style={[s.roleBadge, { backgroundColor: (ROLE_COLOR[item.my_role] ?? '#6b7280') + '15', borderColor: (ROLE_COLOR[item.my_role] ?? '#6b7280') + '44' }]}>
                  <Text style={[s.roleText, { color: ROLE_COLOR[item.my_role] ?? '#6b7280' }]}>{t(`orgs.roles.${item.my_role}`) ?? item.my_role}</Text>
                </View>
                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            )}
          />
        )
      }

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} accessibilityLabel="Close" accessibilityRole="button" onPress={() => setShowCreate(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>{t('orgs.newOrg').toUpperCase()}</Text>
          <Text style={s.inputLabel}>{t('orgs.orgName').toUpperCase()}</Text>
          <TextInput
            style={s.input}
            placeholder="Ex: Acme, Mon équipe..."
            placeholderTextColor="#A0A098"
            accessibilityLabel="Organisation name"
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />
          <Text style={s.inputLabel}>{t('orgs.description').toUpperCase()}</Text>
          <TextInput
            style={[s.input, { height: 72, textAlignVertical: 'top' }]}
            placeholder="Description de l'organisation..."
            placeholderTextColor="#A0A098"
            accessibilityLabel="Description"
            value={newDesc}
            onChangeText={setNewDesc}
            multiline
          />
          {createError ? <Text style={s.error}>{createError}</Text> : null}
          <TouchableOpacity style={s.saveBtn} accessibilityRole="button" accessibilityState={{ disabled: creating }} onPress={createOrg} disabled={creating}>
            {creating ? <ActivityIndicator color="#fff" accessibilityLabel="Creating..." /> : <Text style={s.saveBtnText}>{t('orgs.create')}</Text>}
          </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { paddingBottom: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: '#EBEBEB' },
  title:        { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, flex: 1 },
  addBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: BRAND },
  addBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
  list:         { paddingVertical: 8 },
  sep:          { height: 1, backgroundColor: '#F0F0EC', marginLeft: 72 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, gap: 12 },
  orgAvatar:    { width: 40, height: 40, borderRadius: 12, backgroundColor: BRAND + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  orgAvatarText:{ fontSize: 13, fontWeight: '800', color: BRAND },
  orgName:      { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  orgDesc:      { fontSize: 12, color: '#6B6B63', marginTop: 2 },
  roleBadge:    { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:     { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  arrow:        { fontSize: 20, color: '#A8A8A0' },
  emptyWrap:    { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyMain:    { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  emptySub:     { fontSize: 13, color: '#6B6B63' },
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle:   { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 20 },
  inputLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 6 },
  input:        { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#EBEBEB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  error:        { fontSize: 13, color: BRAND, marginBottom: 8 },
  saveBtn:      { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
});
