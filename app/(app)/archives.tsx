import { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { showToast } from '@/stores/toast';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';

const BRAND = '#A00000';
const BG = '#FAFAF8';

interface Card { id: string; title: string; description?: string; due_date?: number | null; created_at: number; }

export default function ArchivesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, serverUrl } = useAuthStore();
  const { currentProjectId, currentProjectName, triggerRefresh } = useProjectStore();
  const [cards, setCards] = useState<Card[]>([]);
  const [trashColId, setTrashColId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/projects/${currentProjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      const trash = (data.columns ?? []).find((c: any) => c.type === 'gtd_trash');
      if (!trash) return;
      setTrashColId(trash.id);
      const r = await fetch(`${serverUrl}/api/columns/${trash.id}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`${r.status}`);
      const cs = await r.json();
      setCards(Array.isArray(cs) ? cs : []);
    } catch { showToast(t('common.loadError')); }
    finally { setLoading(false); }
  }, [currentProjectId, serverUrl, token]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const restore = useCallback(async (card: Card) => {
    try {
      const res = await fetch(`${serverUrl}/api/projects/${currentProjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const inbox = (data.columns ?? []).find((c: any) => c.type === 'gtd_inbox');
      if (!inbox) return;
      await fetch(`${serverUrl}/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: inbox.id }),
      });
      setCards(prev => prev.filter(c => c.id !== card.id));
      triggerRefresh();
    } catch (e: any) { Alert.alert(t('common.error'), e.message); }
  }, [currentProjectId, serverUrl, token, triggerRefresh, t]);

  const deleteForever = useCallback((card: Card) => {
    Alert.alert(t('archives.deleteForever'), t('archives.confirmDelete', { name: card.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try {
          await fetch(`${serverUrl}/api/cards/${card.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          setCards(prev => prev.filter(c => c.id !== card.id));
        } catch (e: any) { Alert.alert(t('common.error'), e.message); }
      }},
    ]);
  }, [serverUrl, token, t]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Back" accessibilityRole="button">
          <Feather name="arrow-left" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{t('archives.title')}</Text>
          {currentProjectName && <Text style={s.subtitle}>{currentProjectName}</Text>}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={s.center}><ActivityIndicator color={BRAND} accessibilityLabel="Loading archives" /></View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={c => c.id}
          accessibilityRole="list"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
          contentContainerStyle={cards.length === 0 ? s.emptyContainer : s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Feather name="archive" size={28} color="#A8A8A0" />
              </View>
              <Text style={s.emptyText}>{t('archives.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{item.title}</Text>
                {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                <Text style={s.cardDate}>{t('archives.archivedOn', { date: new Date(item.created_at).toLocaleDateString('fr-FR') })}</Text>
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={s.restoreBtn} onPress={() => restore(item)} accessibilityRole="button" accessibilityLabel={'Restore ' + item.title}>
                  <Feather name="rotate-ccw" size={13} color={BRAND} />
                  <Text style={s.restoreText}>{t('archives.restore')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => deleteForever(item)} accessibilityLabel={'Delete permanently ' + item.title} accessibilityRole="button">
                  <Feather name="trash-2" size={14} color={BRAND} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F0F0EC' }} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },
  header:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  backBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title:          { fontSize: 22, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  subtitle:       { fontSize: 12, color: '#6B6B63', marginTop: 2 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:           { paddingVertical: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:          { alignItems: 'center', gap: 12 },
  emptyIconWrap:  { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center' },
  emptyText:      { fontSize: 15, color: '#6B6B63', fontWeight: '500' },
  card:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  cardBody:       { flex: 1 },
  cardTitle:      { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  cardDesc:       { fontSize: 12, color: '#6B6B63', marginTop: 3 },
  cardDate:       { fontSize: 11, color: '#8A8A80', marginTop: 4 },
  actions:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restoreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, borderWidth: 1, borderColor: '#F5D0D0', backgroundColor: '#FFF5F5', paddingHorizontal: 10, paddingVertical: 6 },
  restoreText:    { fontSize: 12, fontWeight: '700', color: BRAND },
  deleteBtn:      { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F5D0D0', alignItems: 'center', justifyContent: 'center' },
});
