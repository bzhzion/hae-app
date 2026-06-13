import { useState, useCallback, useMemo, useRef } from 'react';
import { makeApi } from '@/lib/api';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar';
import AiConfigSection from '@/components/AiConfigSection';

const BRAND = '#A00000';
const BG = '#FAFAF8';
const ORG_ROLE_COLORS: Record<string, string> = { owner: '#A00000', admin: '#7c3aed', member: '#6b7280' };
const ORG_ROLES = ['member', 'admin', 'owner'];

interface OrgMember { id: string; name: string; email: string; avatar_url?: string | null; role: string; }
interface Org { id: string; name: string; description?: string | null; my_role: string | null; members: OrgMember[]; }
interface UserHit { id: string; name: string; email: string; avatar_url?: string | null; }

export default function OrgScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: orgId } = useLocalSearchParams<{ id: string }>();
  const { serverUrl, token, user: me } = useAuthStore();
  const { t } = useTranslation();
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit org
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Add member
  const [showAdd, setShowAdd] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResults, setSearchResults] = useState<UserHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const canManage = org?.my_role === 'owner' || org?.my_role === 'admin' || me?.role === 'admin';
  const isOwner = org?.my_role === 'owner' || me?.role === 'admin';

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await api('GET', `/api/organisations/${orgId}`);
      setOrg(data);
    } catch {}
    finally { setLoading(false); }
  }, [api, orgId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveEdit = async () => {
    if (!editName.trim()) return;
    setEditLoading(true);
    try {
      await api('PATCH', `/api/organisations/${orgId}`, { name: editName.trim(), description: editDesc.trim() || null });
      setShowEdit(false);
      await load();
    } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
    finally { setEditLoading(false); }
  };

  const deleteOrg = () => {
    Alert.alert(
      t('orgs.deleteOrg', { defaultValue: 'Supprimer l\'organisation' }),
      t('orgs.deleteConfirm', { defaultValue: 'Cette action est irréversible.' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete', { defaultValue: 'Supprimer' }), style: 'destructive', onPress: async () => {
          try {
            await api('DELETE', `/api/organisations/${orgId}`);
            router.replace('/(app)/(tabs)/organisations');
          } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
        }},
      ]
    );
  };

  const handleSearchEmail = (text: string) => {
    setSearchEmail(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 3) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api('GET', `/api/users/search?email=${encodeURIComponent(text)}`);
        const memberIds = new Set(org?.members.map(m => m.id));
        setSearchResults((Array.isArray(results) ? results : []).filter((u: UserHit) => !memberIds.has(u.id)));
      } catch {}
      finally { setSearching(false); }
    }, 400);
  };

  const addMember = async (user: UserHit) => {
    setAddLoading(true);
    try {
      await api('POST', `/api/organisations/${orgId}/members`, { userId: user.id, memberRole: 'member' });
      setShowAdd(false);
      setSearchEmail('');
      setSearchResults([]);
      await load();
    } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
    finally { setAddLoading(false); }
  };

  const changeMemberRole = (m: OrgMember) => {
    const current = ORG_ROLES.indexOf(m.role);
    const next = ORG_ROLES[(current + 1) % ORG_ROLES.length];
    Alert.alert(
      t('projectSettings.changeRoleTitle'),
      `${m.name} : ${m.role} → ${next}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: async () => {
          try {
            await api('PATCH', `/api/organisations/${orgId}/members/${m.id}`, { memberRole: next });
            await load();
          } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
        }},
      ]
    );
  };

  const removeMember = (m: OrgMember) => {
    const isSelf = m.id === me?.id;
    Alert.alert(
      isSelf ? 'Quitter l\'org' : 'Retirer le membre',
      isSelf ? 'Quitter cette organisation ?' : `Retirer ${m.name} ?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: isSelf ? 'Quitter' : t('common.confirm'), style: 'destructive', onPress: async () => {
          try {
            await api('DELETE', `/api/organisations/${orgId}/members/${m.id}`);
            if (isSelf) router.replace('/(app)/(tabs)/organisations');
            else await load();
          } catch (e: any) { Alert.alert(t('admin.error'), e.message); }
        }},
      ]
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button">
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{org?.name ?? '...'}</Text>
          {org?.description ? <Text style={s.subtitle} numberOfLines={1}>{org.description}</Text> : null}
        </View>
        {canManage && (
          <TouchableOpacity style={s.iconBtn} onPress={() => { setEditName(org?.name ?? ''); setEditDesc(org?.description ?? ''); setShowEdit(true); }} accessibilityRole="button">
            <Feather name="edit-2" size={16} color="#4A4A44" />
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity style={[s.iconBtn, { backgroundColor: '#FFF0F0' }]} onPress={deleteOrg} accessibilityRole="button">
            <Feather name="trash-2" size={16} color={BRAND} />
          </TouchableOpacity>
        )}
      </View>

      {loading && !org ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}>

          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>MEMBRES{org?.members.length ? ` (${org.members.length})` : ''}</Text>
            {canManage && (
              <TouchableOpacity style={s.addMemberBtn} onPress={() => { setSearchEmail(''); setSearchResults([]); setShowAdd(true); }} accessibilityRole="button">
                <Feather name="user-plus" size={13} color={BRAND} />
                <Text style={s.addMemberText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>

          {org?.members.map(m => (
            <View key={m.id} style={s.row}>
              <UserAvatar name={m.name} serverUrl={serverUrl} token={token ?? undefined} size={36} avatarUrl={m.avatar_url ?? undefined} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{m.name}{m.id === me?.id ? ' (moi)' : ''}</Text>
                <Text style={s.rowSub}>{m.email}</Text>
              </View>
              <TouchableOpacity
                style={[s.roleBadge, { backgroundColor: (ORG_ROLE_COLORS[m.role] ?? '#6b7280') + '18', borderColor: (ORG_ROLE_COLORS[m.role] ?? '#6b7280') + '55' }]}
                onPress={() => canManage && m.role !== 'owner' ? changeMemberRole(m) : undefined}
                accessibilityRole="button"
              >
                <Text style={[s.roleText, { color: ORG_ROLE_COLORS[m.role] ?? '#6b7280' }]}>{m.role}</Text>
              </TouchableOpacity>
              {((canManage && m.id !== me?.id && m.role !== 'owner') || (m.id === me?.id && org?.my_role !== 'owner')) && (
                <TouchableOpacity style={s.removeBtn} onPress={() => removeMember(m)} accessibilityRole="button">
                  <Feather name={m.id === me?.id ? 'log-out' : 'x'} size={13} color="#8A8A80" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={s.divider} />

          <AiConfigSection
            api={api}
            configPath={`/api/organisations/${orgId}/ai-config`}
            titleKey="titleOrg"
            subtitleKey="subtitleOrg"
          />

        </ScrollView>
      )}

      {/* Modal edit org */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEdit(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={s.sheetTitle}>MODIFIER L'ORGANISATION</Text>
              <Text style={s.inputLabel}>NOM</Text>
              <TextInput style={s.input} value={editName} onChangeText={setEditName} autoFocus accessibilityLabel="Org name" />
              <Text style={[s.inputLabel, { marginTop: 12 }]}>DESCRIPTION</Text>
              <TextInput style={s.input} value={editDesc} onChangeText={setEditDesc} placeholder="Optionnel" placeholderTextColor="#A0A098" accessibilityLabel="Org description" />
              <TouchableOpacity style={[s.saveBtn, { marginTop: 16 }]} onPress={saveEdit} disabled={editLoading} accessibilityRole="button">
                {editLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal add member */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowAdd(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}>
              <Text style={s.sheetTitle}>AJOUTER UN MEMBRE</Text>
              <Text style={s.inputLabel}>CHERCHER PAR EMAIL</Text>
              <View style={s.searchRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  value={searchEmail}
                  onChangeText={handleSearchEmail}
                  autoFocus
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="utilisateur@exemple.com"
                  placeholderTextColor="#A0A098"
                  accessibilityLabel="Search email"
                />
                {searching && <ActivityIndicator color={BRAND} style={{ marginLeft: 8 }} />}
              </View>
              {searchResults.length > 0 && (
                <View style={s.resultList}>
                  {searchResults.map(u => (
                    <TouchableOpacity key={u.id} style={s.resultRow} onPress={() => addMember(u)} disabled={addLoading} accessibilityRole="button">
                      <UserAvatar name={u.name} serverUrl={serverUrl} token={token ?? undefined} size={32} avatarUrl={u.avatar_url ?? undefined} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName}>{u.name}</Text>
                        <Text style={s.rowSub}>{u.email}</Text>
                      </View>
                      <Feather name="plus" size={16} color={BRAND} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {searchEmail.length >= 3 && !searching && searchResults.length === 0 && (
                <Text style={s.noResult}>Aucun utilisateur trouvé</Text>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BG },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:     { fontSize: 28, color: '#4A4A44', fontWeight: '300', marginTop: -4 },
  title:        { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  subtitle:     { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  iconBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body:         { padding: 24 },
  sectionRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63' },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: BRAND + '44', backgroundColor: '#FFF5F5' },
  addMemberText:{ fontSize: 12, fontWeight: '600', color: BRAND },
  divider:      { height: 1, backgroundColor: '#F0F0EC', marginVertical: 24 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowName:      { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  rowSub:       { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  roleBadge:    { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  removeBtn:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F0' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle:   { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 16 },
  inputLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 6 },
  input:        { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  saveBtn:      { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  saveBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  searchRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  resultList:   { borderWidth: 1, borderColor: '#EBEBEB', borderRadius: 10, overflow: 'hidden' },
  resultRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F0' },
  noResult:     { fontSize: 13, color: '#8A8A80', textAlign: 'center', marginTop: 8 },
});
