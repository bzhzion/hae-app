import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { makeApi } from '@/lib/api';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import { useOrgStore } from '@/stores/org';

interface Project { id: string; name: string; description?: string; color?: string; is_personal: number; owner_type: string; owner_id: string; my_role: string; }

const BRAND = '#A00000';
const BG = '#FAFAF8';

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { token, serverUrl, logout } = useAuthStore();
  const { currentProjectId, setCurrentProject } = useProjectStore();
  const { orgs, setOrgs } = useOrgStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projOrgId, setProjOrgId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [editProj, setEditProj] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  const editProject = async () => {
    if (!editProj || !editName.trim()) { setEditError(t('projects.nameRequired')); return; }
    setEditing(true);
    setEditError('');
    try {
      await api('PATCH', `/api/projects/${editProj.id}`, { name: editName.trim(), description: editDesc.trim() || undefined });
      setShowEdit(false);
      await load();
    } catch (e: any) { setEditError(e.message); }
    finally { setEditing(false); }
  };

  const openProjectMenu = (p: Project) => {
    if (p.my_role !== 'owner') return;
    Alert.alert(p.name, 'Actions', [
      { text: t('projects.modify'), onPress: () => { setEditProj(p); setEditName(p.name); setEditDesc(p.description ?? ''); setEditError(''); setShowEdit(true); } },
      { text: t('projects.delete'), style: 'destructive', onPress: () => deleteProject(p) },
      { text: t('projects.cancel'), style: 'cancel' },
    ]);
  };

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projs, orgList] = await Promise.all([
        api('GET', '/api/projects'),
        api('GET', '/api/organisations'),
      ]);
      setProjects(Array.isArray(projs) ? projs : []);
      setOrgs(Array.isArray(orgList) ? orgList : []);
    } catch {}
    finally { setLoading(false); }
  }, [api, setOrgs]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const select = (p: Project) => {
    setCurrentProject(p.id, p.name, p.owner_type, p.owner_id);
    router.navigate('/(app)/(tabs)/tasks');
  };

  const openCreate = () => {
    setProjName(''); setProjDesc(''); setProjOrgId(null); setCreateError('');
    setShowCreate(true);
  };

  const createProject = async () => {
    setCreateError('');
    if (!projName.trim()) { setCreateError(t('projects.nameRequired')); return; }
    setCreating(true);
    try {
      await api('POST', '/api/projects', {
        name: projName.trim(),
        description: projDesc.trim() || undefined,
        orgId: projOrgId ?? undefined,
      });
      setShowCreate(false);
      await load();
    } catch (e: any) { setCreateError(e.message); }
    finally { setCreating(false); }
  };

  const deleteProject = (p: Project) => {
    Alert.alert(t('projects.delete'), t('projects.confirmDelete', { name: p.name }), [
      { text: t('projects.cancel'), style: 'cancel' },
      { text: t('projects.delete'), style: 'destructive', onPress: async () => {
        try { await api('DELETE', `/api/projects/${p.id}`); await load(); }
        catch (e: any) { Alert.alert(t('common.error'), e.message); }
      }},
    ]);
  };

  const personal   = projects.filter(p => p.is_personal);
  const shared     = projects.filter(p => !p.is_personal && p.owner_type === 'user');
  const orgProjects = projects.filter(p => p.owner_type === 'organisation');

  const renderProject = ({ item }: { item: Project; index: number }) => {
    const active = item.id === currentProjectId;
    return (
      <TouchableOpacity
        style={[s.card, active && s.cardActive]}
        onPress={() => select(item)}
        onLongPress={() => openProjectMenu(item)}
        accessibilityRole="button"
        accessibilityLabel={active ? `${item.name}, selected` : item.name}
      >
        <View style={s.cardBody}>
          <Text style={[s.cardTitle, active && s.cardTitleActive]}>{item.name}</Text>
          {item.description ? <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
        {active ? <View style={s.activeDot} accessible={false} /> : <Text style={s.cardArrow}>›</Text>}
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={BRAND} accessibilityLabel="Loading projects" /></View>;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>{t('projects.title')}</Text>
      </View>

      <FlatList
        data={[]}
        keyExtractor={() => 'dummy'}
        renderItem={null}
        contentContainerStyle={s.list}
        ListEmptyComponent={
          <>
            {personal.length > 0 && (
              <>
                <Text style={s.groupLabel}>{t('projects.personal').toUpperCase()}</Text>
                {personal.map((item, i) => <View key={item.id}>{renderProject({ item, index: i })}{i < personal.length - 1 && <View style={s.sep} />}</View>)}
              </>
            )}
            {shared.length > 0 && (
              <>
                <Text style={[s.groupLabel, { marginTop: personal.length > 0 ? 24 : 0 }]}>{t('projects.shared').toUpperCase()}</Text>
                {shared.map((item, i) => <View key={item.id}>{renderProject({ item, index: i })}{i < shared.length - 1 && <View style={s.sep} />}</View>)}
              </>
            )}
            {orgProjects.length > 0 && (
              <>
                <Text style={[s.groupLabel, { marginTop: (personal.length > 0 || shared.length > 0) ? 24 : 0 }]}>{t('projects.organisations').toUpperCase()}</Text>
                {orgProjects.map((item, i) => {
                  const orgName = orgs.find(o => o.id === item.owner_id)?.name;
                  return (
                    <View key={item.id}>
                      {(i === 0 || orgProjects[i - 1].owner_id !== item.owner_id) && orgName ? (
                        <Text style={s.orgSubLabel}>{orgName}</Text>
                      ) : null}
                      {renderProject({ item, index: i })}
                      {i < orgProjects.length - 1 && <View style={s.sep} />}
                    </View>
                  );
                })}
              </>
            )}
            {projects.length === 0 && (
              <View style={s.emptyWrap}><Text style={s.emptyMain}>{t('projects.noProjects')}</Text></View>
            )}
          </>
        }
      />

      {/* Modal éditer projet */}
      <Modal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEdit(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>{t('projects.editProject').toUpperCase()}</Text>
          <TextInput style={s.sheetInput} placeholder={t('projects.projectName')} placeholderTextColor="#A0A098" value={editName} onChangeText={setEditName} autoFocus accessibilityLabel="Project name" />
          <TextInput style={[s.sheetInput, { marginTop: 10, height: 64, textAlignVertical: 'top' }]} placeholder={t('projects.description')} placeholderTextColor="#A0A098" value={editDesc} onChangeText={setEditDesc} multiline />
          {editError ? <Text style={s.error}>{editError}</Text> : null}
          <TouchableOpacity style={s.saveBtn} onPress={editProject} disabled={editing}>
            {editing ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('common.save')}</Text>}
          </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={openCreate}
        activeOpacity={0.85}
        accessibilityLabel="Create a project"
        accessibilityRole="button"
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Modal créer projet */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal={true}>
          <Text style={s.sheetTitle}>{t('projects.createProject').toUpperCase()}</Text>
          <TextInput
            style={s.sheetInput}
            placeholder={t('projects.projectName')}
            placeholderTextColor="#A0A098"
            value={projName}
            onChangeText={setProjName}
            autoFocus
            accessibilityLabel="Project name"
          />
          <TextInput
            style={[s.sheetInput, { marginTop: 10, height: 64, textAlignVertical: 'top' }]}
            placeholder={t('projects.description')}
            placeholderTextColor="#A0A098"
            value={projDesc}
            onChangeText={setProjDesc}
            multiline
          />

          <Text style={s.inputLabelSm}>{t('projects.assignToOrg').toUpperCase()}</Text>
          <View style={s.orgRow}>
            <TouchableOpacity
              style={[s.orgOpt, projOrgId === null && s.orgOptSel]}
              onPress={() => setProjOrgId(null)}
              accessibilityRole="radio"
              accessibilityState={{ checked: projOrgId === null }}
            >
              <Text style={[s.orgOptText, projOrgId === null && s.orgOptTextSel]}>{t('projects.personal_label')}</Text>
            </TouchableOpacity>
            {orgs.filter(o => ['owner', 'admin'].includes(o.my_role)).map(o => (
              <TouchableOpacity
                key={o.id}
                style={[s.orgOpt, projOrgId === o.id && s.orgOptSel]}
                onPress={() => setProjOrgId(o.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: projOrgId === o.id }}
              >
                <Text style={[s.orgOptText, projOrgId === o.id && s.orgOptTextSel]} numberOfLines={1}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {createError ? <Text style={s.error}>{createError}</Text> : null}
          <TouchableOpacity style={s.saveBtn} onPress={createProject} disabled={creating}>
            {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('projects.create')}</Text>}
          </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BG },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  header:          { paddingBottom: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: '#EBEBEB' },
  title:           { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, flex: 1 },
  fab:             { position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8 }, android: { elevation: 6 } }) },
  list:            { paddingVertical: 8 },
  groupLabel:      { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', paddingHorizontal: 24, paddingVertical: 8 },
  orgSubLabel:     { fontSize: 11, fontWeight: '600', color: '#6B6B63', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  sep:             { height: 1, backgroundColor: '#F0F0EC', marginLeft: 24 },
  card:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  cardActive:      { backgroundColor: '#FFF5F5' },
  cardBody:        { flex: 1 },
  cardTitle:       { fontSize: 15, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.2 },
  cardTitleActive: { color: BRAND },
  cardDesc:        { fontSize: 12, color: '#6B6B63', marginTop: 2 },
  cardArrow:       { fontSize: 20, color: '#A8A8A0', marginLeft: 8 },
  activeDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND },
  emptyWrap:       { alignItems: 'center', marginTop: 80 },
  emptyMain:       { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
  backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:           { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle:      { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 16 },
  sheetInput:      { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  inputLabelSm:    { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginTop: 14, marginBottom: 8 },
  orgRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  orgOpt:          { borderRadius: 8, borderWidth: 1.5, borderColor: '#EBEBEB', paddingHorizontal: 12, paddingVertical: 8 },
  orgOptSel:       { borderColor: BRAND, backgroundColor: '#FFF5F5' },
  orgOptText:      { fontSize: 13, fontWeight: '600', color: '#6B6B63', maxWidth: 120 },
  orgOptTextSel:   { color: BRAND },
  error:           { fontSize: 13, color: BRAND, marginBottom: 8 },
  saveBtn:         { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:     { color: '#fff', fontSize: 15, fontWeight: '700' },
});
