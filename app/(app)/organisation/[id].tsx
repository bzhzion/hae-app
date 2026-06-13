import { useState, useCallback, useMemo } from 'react';
import { makeApi } from '@/lib/api';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView, ActivityIndicator, Alert } from 'react-native';
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

interface OrgMember { id: string; name: string; email: string; avatar_url?: string | null; role: string; }
interface Org { id: string; name: string; description?: string | null; my_role: string | null; members: OrgMember[]; }

export default function OrgScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: orgId } = useLocalSearchParams<{ id: string }>();
  const { serverUrl, token, user: me } = useAuthStore();
  const { t } = useTranslation();
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const canManage = org?.my_role === 'owner' || org?.my_role === 'admin' || me?.role === 'admin';

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

  const changeMemberRole = (m: OrgMember) => {
    const roles = ['member', 'admin', 'owner'];
    const current = roles.indexOf(m.role);
    const next = roles[(current + 1) % roles.length];
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
      isSelf ? t('orgs.leaveOrg', { defaultValue: 'Quitter l\'org' }) : t('orgs.removeMember', { defaultValue: 'Retirer le membre' }),
      isSelf ? t('orgs.leaveConfirm', { defaultValue: 'Quitter cette organisation ?' }) : `${m.name} ?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: isSelf ? t('orgs.leave', { defaultValue: 'Quitter' }) : t('common.confirm'), style: 'destructive', onPress: async () => {
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
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Back" accessibilityRole="button">
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{org?.name ?? '...'}</Text>
          {org?.description ? <Text style={s.subtitle} numberOfLines={1}>{org.description}</Text> : null}
        </View>
      </View>

      {loading && !org ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : (
        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}>

          <Text style={s.sectionLabel}>{t('admin.users', { defaultValue: 'MEMBRES' })}{org?.members.length ? ` (${org.members.length})` : ''}</Text>
          {org?.members.map(m => (
            <View key={m.id} style={s.row}>
              <UserAvatar name={m.name} serverUrl={serverUrl} token={token ?? undefined} size={36} avatarUrl={m.avatar_url ?? undefined} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{m.name}{m.id === me?.id ? ` ${t('admin.me')}` : ''}</Text>
                <Text style={s.rowSub}>{m.email}</Text>
              </View>
              {canManage && m.role !== 'owner' ? (
                <TouchableOpacity
                  style={[s.roleBadge, { backgroundColor: (ORG_ROLE_COLORS[m.role] ?? '#6b7280') + '15', borderColor: (ORG_ROLE_COLORS[m.role] ?? '#6b7280') + '44' }]}
                  onPress={() => changeMemberRole(m)}
                  accessibilityRole="button"
                >
                  <Text style={[s.roleText, { color: ORG_ROLE_COLORS[m.role] ?? '#6b7280' }]}>{m.role}</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.roleBadge, { backgroundColor: (ORG_ROLE_COLORS[m.role] ?? '#6b7280') + '15', borderColor: (ORG_ROLE_COLORS[m.role] ?? '#6b7280') + '44' }]}>
                  <Text style={[s.roleText, { color: ORG_ROLE_COLORS[m.role] ?? '#6b7280' }]}>{m.role}</Text>
                </View>
              )}
              {(canManage && m.id !== me?.id && m.role !== 'owner') || (m.id === me?.id && org?.my_role !== 'owner') ? (
                <TouchableOpacity style={s.removeBtn} onPress={() => removeMember(m)} accessibilityRole="button">
                  <Feather name={m.id === me?.id ? 'log-out' : 'x'} size={14} color="#8A8A80" />
                </TouchableOpacity>
              ) : null}
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
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backText:    { fontSize: 28, color: '#4A4A44', fontWeight: '300', marginTop: -4 },
  title:       { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  subtitle:    { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body:        { padding: 24 },
  sectionLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#6B6B63', marginBottom: 10 },
  divider:     { height: 1, backgroundColor: '#F0F0EC', marginVertical: 24 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rowName:     { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  rowSub:      { fontSize: 12, color: '#6B6B63', marginTop: 1 },
  roleBadge:   { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  roleText:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  removeBtn:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F0' },
});
