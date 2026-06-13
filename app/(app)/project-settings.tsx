import { useState, useCallback, useMemo } from 'react';
import { makeApi } from '@/lib/api';
import { showToast } from '@/stores/toast';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import UserAvatar from '@/components/UserAvatar';
import AiConfigSection from '@/components/AiConfigSection';

const BRAND = '#A00000';
const BG = '#FAFAF8';

interface Member { id: string; name: string; email: string; avatar_url?: string; role: string; }
interface OrgMember { id: string; name: string; email: string; role: string; }
interface Label { id: string; name: string; color: string; }

const PRESET_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#6366f1','#a855f7','#ec4899','#64748b','#A00000'];

const ROLE_COLORS: Record<string, string> = { owner: '#A00000', admin: '#A00000', editor: '#2563eb', viewer: '#6b7280' };

export default function ProjectSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { serverUrl, token, user: me } = useAuthStore();
  const { currentProjectId, currentProjectName, currentProjectOwnerType, currentProjectOwnerId } = useProjectStore();

  const [members, setMembers] = useState<Member[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [labels, setLabels] = useState<Label[]>([]);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [labelNameDraft, setLabelNameDraft] = useState('');
  const [labelColorDraft, setLabelColorDraft] = useState('#6366f1');
  const [labelSaving, setLabelSaving] = useState(false);
  const [showAddLabel, setShowAddLabel] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteUserId, setInviteUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const api = useMemo(() => makeApi(serverUrl ?? '', token ?? ''), [serverUrl, token]);

  const loadMembers = useCallback(async () => {
    if (!currentProjectId) return;
    setLoadingMembers(true);
    try {
      const proj = await api('GET', `/api/projects/${currentProjectId}`);
      setMembers(Array.isArray(proj?.members) ? proj.members : []);
    } catch { showToast(t('common.loadError')); }
    finally { setLoadingMembers(false); }
  }, [currentProjectId, api]);

  const loadLabels = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const data = await api('GET', `/api/projects/${currentProjectId}/labels`);
      setLabels(Array.isArray(data) ? data : []);
    } catch { showToast(t('common.loadError')); }
  }, [currentProjectId, api]);

  const loadOrgMembers = useCallback(async () => {
    if (currentProjectOwnerType !== 'organisation' || !currentProjectOwnerId) return;
    try {
      const org = await api('GET', `/api/organisations/${currentProjectOwnerId}`);
      setOrgMembers(Array.isArray(org?.members) ? org.members : []);
    } catch { showToast(t('common.loadError')); }
  }, [currentProjectOwnerType, currentProjectOwnerId, api]);

  useFocusEffect(useCallback(() => {
    loadMembers();
    loadOrgMembers();
    loadLabels();
  }, [loadMembers, loadOrgMembers, loadLabels]));

  const invitableCandidates = orgMembers.filter(om => !members.some(m => m.id === om.id));

  const inviteMember = async () => {
    setInviteError('');
    setInviteLoading(true);
    try {
      let userId = inviteUserId;
      if (!userId) {
        if (!inviteEmail.trim()) { setInviteError(t('projectSettings.enterEmail')); setInviteLoading(false); return; }
        const found = await api('GET', `/api/users/search?email=${encodeURIComponent(inviteEmail.trim())}`);
        userId = found.id;
      }
      await api('POST', `/api/projects/${currentProjectId}/members`, { userId, role: inviteRole });
      setShowInvite(false);
      setInviteUserId(null);
      setInviteEmail('');
      await loadMembers();
    } catch (e: any) { setInviteError(e.message); }
    finally { setInviteLoading(false); }
  };

  const changeRole = (memberId: string, newRole: string) => {
    Alert.alert(t('projectSettings.changeRoleTitle'), t('projectSettings.changeRoleTo', { role: newRole }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: async () => {
        try {
          await api('PATCH', `/api/projects/${currentProjectId}/members/${memberId}`, { role: newRole });
          await loadMembers();
        } catch (e: any) { Alert.alert(t('common.error'), e.message); }
      }},
    ]);
  };

  const removeMember = (memberId: string, name: string) => {
    Alert.alert(t('projectSettings.removeTitle'), t('projectSettings.removeConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('projectSettings.removeTitle'), style: 'destructive', onPress: async () => {
        try {
          await api('DELETE', `/api/projects/${currentProjectId}/members/${memberId}`);
          await loadMembers();
        } catch (e: any) { Alert.alert(t('common.error'), e.message); }
      }},
    ]);
  };

  const openEditLabel = (label: Label) => {
    setEditingLabel(label);
    setLabelNameDraft(label.name);
    setLabelColorDraft(label.color);
  };

  const openAddLabel = () => {
    setEditingLabel(null);
    setLabelNameDraft('');
    setLabelColorDraft(PRESET_COLORS[0]);
    setShowAddLabel(true);
  };

  const saveLabel = async () => {
    const name = labelNameDraft.trim();
    if (!name) return;
    setLabelSaving(true);
    try {
      if (editingLabel) {
        await api('PATCH', `/api/labels/${editingLabel.id}`, { name, color: labelColorDraft });
        setEditingLabel(null);
      } else {
        await api('POST', `/api/projects/${currentProjectId}/labels`, { name, color: labelColorDraft });
        setShowAddLabel(false);
      }
      await loadLabels();
    } catch (e: any) { Alert.alert(t('common.error'), e.message); }
    finally { setLabelSaving(false); }
  };

  const deleteLabel = (label: Label) => {
    Alert.alert(label.name, t('common.confirmDelete', { name: label.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try {
          await api('DELETE', `/api/labels/${label.id}`);
          setEditingLabel(null);
          await loadLabels();
        } catch (e: any) { Alert.alert(t('common.error'), e.message); }
      }},
    ]);
  };

  const isLabelModalOpen = !!editingLabel || showAddLabel;
  const closeLabelModal = () => { setEditingLabel(null); setShowAddLabel(false); };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Back" accessibilityRole="button">
          <Feather name="arrow-left" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('projectSettings.title')}</Text>
          {currentProjectName && <Text style={s.subtitle}>{currentProjectName}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        {!currentProjectId ? (
          <Text style={s.empty}>{t('projectSettings.noProject')}</Text>
        ) : (
          <>
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>{t('projectSettings.members').toUpperCase()}</Text>
              <TouchableOpacity onPress={() => { setShowInvite(true); setInviteError(''); setInviteUserId(null); setInviteEmail(''); }} accessibilityRole="button">
                <Text style={s.sectionAction}>{t('projectSettings.invite')}</Text>
              </TouchableOpacity>
            </View>
            {loadingMembers
              ? <ActivityIndicator color={BRAND} style={{ marginVertical: 12 }} accessibilityLabel="Loading members" />
              : members.map(m => (
                <View key={m.id} style={s.row}>
                  <UserAvatar name={m.name} avatarUrl={m.avatar_url} serverUrl={serverUrl} token={token ?? undefined} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{m.name}{m.id === me?.id ? ` ${t('projectSettings.me')}` : ''}</Text>
                    <Text style={s.rowSub}>{m.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.roleBadge, { backgroundColor: (ROLE_COLORS[m.role] ?? '#6b7280') + '15', borderColor: (ROLE_COLORS[m.role] ?? '#6b7280') + '44' }]}
                    onPress={() => m.id !== me?.id && m.role !== 'owner' && Alert.alert(t('projectSettings.role'), t('projectSettings.changeRoleTitle') + ' :', [
                      { text: 'viewer', onPress: () => changeRole(m.id, 'viewer') },
                      { text: 'editor', onPress: () => changeRole(m.id, 'editor') },
                      { text: t('common.cancel'), style: 'cancel' },
                    ])}
                    accessibilityRole="button"
                    accessibilityLabel={`Role: ${m.role}. Tap to change.`}
                  >
                    <Text style={[s.roleText, { color: ROLE_COLORS[m.role] ?? '#6b7280' }]}>{m.role}</Text>
                  </TouchableOpacity>
                  {m.id !== me?.id && m.role !== 'owner' && (
                    <TouchableOpacity style={s.removeBtn} onPress={() => removeMember(m.id, m.name)} accessibilityLabel={`Remove ${m.name}`} accessibilityRole="button">
                      <Feather name="x" size={13} color="#6B6B63" />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            }

            <View style={s.divider} />

            {/* Labels */}
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>{t('projectSettings.labels').toUpperCase()}</Text>
              <TouchableOpacity onPress={openAddLabel} accessibilityRole="button">
                <Text style={s.sectionAction}>+ {t('common.add')}</Text>
              </TouchableOpacity>
            </View>
            <View style={s.labelsWrap}>
              {labels.map(l => (
                <TouchableOpacity
                  key={l.id}
                  style={[s.labelPill, { backgroundColor: l.color + '22', borderColor: l.color + '66' }]}
                  onPress={() => openEditLabel(l)}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit label ${l.name}`}
                >
                  <View style={[s.labelDot, { backgroundColor: l.color }]} />
                  <Text style={[s.labelPillText, { color: l.color }]}>{l.name}</Text>
                  <Feather name="edit-2" size={11} color={l.color + 'AA'} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              ))}
              {labels.length === 0 && <Text style={s.emptyLabels}>{t('cards.noLabels')}</Text>}
            </View>

            <View style={s.divider} />
            <AiConfigSection
              api={api}
              configPath={`/api/projects/${currentProjectId}/ai-config`}
              titleKey="titleProject"
              subtitleKey="subtitleProject"
            />

            <View style={s.divider} />
            <TouchableOpacity style={s.archiveBtn} onPress={() => router.push('/(app)/archives')} accessibilityRole="button">
              <View style={s.archiveBtnLeft}>
                <Feather name="archive" size={16} color="#4A4A44" />
                <Text style={s.archiveBtnText}>{t('projectSettings.archives')}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#8A8A80" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Label edit / add modal */}
      <Modal visible={isLabelModalOpen} transparent animationType="slide" onRequestClose={closeLabelModal}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeLabelModal} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} accessibilityViewIsModal={true}>
              <Text style={s.sheetTitle}>{(editingLabel ? t('projectSettings.editLabel') : t('projectSettings.newLabel')).toUpperCase()}</Text>
              <Text style={[s.sectionLabel, { marginBottom: 6 }]}>{t('common.nameLabel')}</Text>
              <TextInput
                style={s.sheetInput}
                value={labelNameDraft}
                onChangeText={setLabelNameDraft}
                placeholder={t('cards.labelName')}
                placeholderTextColor="#A0A098"
                autoFocus
                maxLength={50}
                accessibilityLabel="Label name"
              />
              <Text style={[s.sectionLabel, { marginTop: 16, marginBottom: 8 }]}>{t('projectSettings.color').toUpperCase()}</Text>
              <View style={s.colorRow}>
                {PRESET_COLORS.map(c => (
                  <TouchableOpacity key={c} style={[s.colorDot, { backgroundColor: c }, labelColorDraft === c && s.colorDotSel]} onPress={() => setLabelColorDraft(c)} accessibilityRole="radio" accessibilityState={{ checked: labelColorDraft === c }} accessibilityLabel={c} />
                ))}
              </View>
              <View style={[s.labelPreview, { backgroundColor: labelColorDraft + '22', borderColor: labelColorDraft + '66' }]}>
                <View style={[s.labelDot, { backgroundColor: labelColorDraft }]} />
                <Text style={[s.labelPillText, { color: labelColorDraft }]}>{labelNameDraft || t('cards.labelName')}</Text>
              </View>
              <TouchableOpacity style={s.saveBtn} onPress={saveLabel} disabled={labelSaving || !labelNameDraft.trim()}>
                {labelSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
              {editingLabel && (
                <TouchableOpacity style={s.deleteBtn} onPress={() => deleteLabel(editingLabel)}>
                  <Text style={s.deleteBtnText}>{t('common.delete')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowInvite(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={[s.sheet, { paddingBottom: insets.bottom + 24, maxHeight: '80%' }]} accessibilityViewIsModal={true}>
              <Text style={s.sheetTitle}>{t('projectSettings.addToProject').toUpperCase()}</Text>
              {currentProjectOwnerType === 'organisation' ? (
                <>
                  <Text style={[s.sectionLabel, { marginBottom: 8 }]}>{t('projectSettings.orgMembers').toUpperCase()}</Text>
                  {invitableCandidates.length === 0
                    ? <Text style={{ fontSize: 13, color: '#6B6B63', marginBottom: 12 }}>{t('projectSettings.allAlreadyIn')}</Text>
                    : invitableCandidates.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[s.candidateRow, inviteUserId === c.id && s.candidateRowSel]}
                        onPress={() => setInviteUserId(inviteUserId === c.id ? null : c.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: inviteUserId === c.id }}
                      >
                        <View style={s.candidateAvatar}>
                          <Text style={s.candidateAvatarText}>{c.name.slice(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.candidateName}>{c.name}</Text>
                          <Text style={s.candidateEmail}>{c.email}</Text>
                        </View>
                        {inviteUserId === c.id && <Text style={{ color: BRAND, fontWeight: '700' }}>✓</Text>}
                      </TouchableOpacity>
                    ))
                  }
                </>
              ) : (
                <>
                  <Text style={[s.sectionLabel, { marginBottom: 8 }]}>{t('projectSettings.emailLabel').toUpperCase()}</Text>
                  <TextInput
                    style={s.sheetInput}
                    placeholder={t('projectSettings.emailPlaceholder')}
                    placeholderTextColor="#A0A098"
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                    maxLength={254}
                    accessibilityLabel="Member email address"
                  />
                </>
              )}
              <Text style={[s.sectionLabel, { marginTop: 12 }]}>{t('projectSettings.role').toUpperCase()}</Text>
              <View style={s.roleRow}>
                {(['viewer', 'editor'] as const).map(r => (
                  <TouchableOpacity key={r} style={[s.roleOption, inviteRole === r && s.roleOptionSel]} onPress={() => setInviteRole(r)} accessibilityRole="radio" accessibilityState={{ checked: inviteRole === r }}>
                    <Text style={[s.roleOptionText, inviteRole === r && s.roleOptionTextSel]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {inviteError ? <Text style={s.inviteError}>{inviteError}</Text> : null}
              <TouchableOpacity
                style={s.saveBtn}
                onPress={inviteMember}
                disabled={inviteLoading || (currentProjectOwnerType === 'organisation' && invitableCandidates.length === 0)}
              >
                {inviteLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{t('projectSettings.addButton')}</Text>}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container:          { flex: 1, backgroundColor: BG },
  header:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  backBtn:            { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title:              { fontSize: 22, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle:           { fontSize: 12, color: '#6B6B63', marginTop: 2 },
  body:               { padding: 24 },
  empty:              { fontSize: 14, color: '#6B6B63', textAlign: 'center', marginTop: 40 },
  sectionHead:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel:       { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 10 },
  sectionAction:      { fontSize: 13, fontWeight: '700', color: BRAND },
  divider:            { height: 1, backgroundColor: '#F0F0EC', marginVertical: 24 },
  row:                { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowName:            { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  rowSub:             { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  roleBadge:          { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:           { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  removeBtn:          { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center' },
  archiveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#EBEBEB' },
  archiveBtnLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  archiveBtnText:     { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  sheet:              { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  sheetTitle:         { fontSize: 13, fontWeight: '700', letterSpacing: 1, color: '#6B6B63', marginBottom: 16 },
  sheetInput:         { fontSize: 15, color: '#1A1A1A', borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  roleRow:            { flexDirection: 'row', gap: 8, marginBottom: 8 },
  roleOption:         { flex: 1, borderRadius: 8, borderWidth: 1.5, borderColor: '#EBEBEB', paddingVertical: 10, alignItems: 'center' },
  roleOptionSel:      { borderColor: BRAND, backgroundColor: '#FFF5F5' },
  roleOptionText:     { fontSize: 13, fontWeight: '600', color: '#6B6B63' },
  roleOptionTextSel:  { color: BRAND },
  inviteError:        { fontSize: 13, color: BRAND, marginBottom: 8 },
  saveBtn:            { backgroundColor: BRAND, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText:        { color: '#fff', fontSize: 15, fontWeight: '700' },
  candidateRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, marginBottom: 2 },
  candidateRowSel:    { backgroundColor: '#FFF5F5' },
  candidateAvatar:    { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND + '18', alignItems: 'center', justifyContent: 'center' },
  candidateAvatarText:{ fontSize: 11, fontWeight: '700', color: BRAND },
  candidateName:      { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  candidateEmail:     { fontSize: 11, color: '#6B6B63' },
  labelsWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  labelPill:          { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  labelDot:           { width: 8, height: 8, borderRadius: 4 },
  labelPillText:      { fontSize: 13, fontWeight: '600' },
  emptyLabels:        { fontSize: 13, color: '#A0A098', fontStyle: 'italic' },
  colorRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  colorDot:           { width: 28, height: 28, borderRadius: 14 },
  colorDotSel:        { borderWidth: 3, borderColor: '#1A1A1A' },
  labelPreview:       { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  deleteBtn:          { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1.5, borderColor: '#ef4444' },
  deleteBtnText:      { color: '#ef4444', fontSize: 15, fontWeight: '700' },
});
