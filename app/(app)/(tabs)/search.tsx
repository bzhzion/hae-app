import { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, ScrollView, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import CardDetailSheet from '@/components/CardDetailSheet';

const HISTORY_KEY = 'hae_search_history';

const BRAND = '#A00000';
const BG = '#FAFAF8';

interface Label { id: string; name: string; color: string; }
interface Card { id: string; title: string; description?: string; due_date?: number | null; labels?: Label[]; column_id?: string; project_id?: string; position?: number; column_name?: string; project_name?: string; }
interface Project { id: string; name: string; columns: Column[]; }
interface Column { id: string; name: string; type: string; project_id?: string; project_name?: string; }

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { token, serverUrl } = useAuthStore();

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [loaded, setLoaded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const loadHistory = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      setHistory(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  const saveToHistory = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const prev: string[] = raw ? JSON.parse(raw) : [];
      const next = [trimmed, ...prev.filter(x => x !== trimmed)].slice(0, 5);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const projs: Project[] = await res.json();
      setProjects(Array.isArray(projs) ? projs : []);

      const cards: Card[] = [];
      await Promise.all((projs as Project[]).map(async (proj) => {
        await Promise.all(proj.columns.map(async (col) => {
          const r = await fetch(`${serverUrl}/api/columns/${col.id}/cards`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cs = await r.json();
          if (Array.isArray(cs)) {
            cs.forEach(c => cards.push({
              ...c,
              column_name: col.name,
              project_name: proj.name,
            }));
          }
        }));
      }));
      setAllCards(cards);
      setLoaded(true);
    } catch {}
    finally { setLoading(false); }
  }, [serverUrl, token]);

  useFocusEffect(useCallback(() => {
    loadHistory();
    if (!loaded) loadAll();
  }, [loaded, loadAll, loadHistory]));

  const allLabels = useMemo(() => {
    const map = new Map<string, Label>();
    allCards.forEach(c => c.labels?.forEach(l => map.set(l.id, l)));
    return Array.from(map.values());
  }, [allCards]);

  const results = useMemo(() => {
    if (!query.trim() && !selectedProject && !selectedLabel) return [];
    return allCards.filter(c => {
      const q = query.toLowerCase();
      const matchQuery = !q || c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
      const matchProj = !selectedProject || c.project_name === selectedProject;
      const matchLabel = !selectedLabel || c.labels?.some(l => l.id === selectedLabel);
      return matchQuery && matchProj && matchLabel;
    });
  }, [allCards, query, selectedProject, selectedLabel]);

  const openCard = (c: Card) => {
    setActiveCard(c);
    expandAnim.setValue(0);
    Animated.spring(expandAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };
  const closeCard = () => {
    Animated.timing(expandAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setActiveCard(null));
  };

  const projectForCard = (c: Card) => projects.find(p => p.name === c.project_name);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <TextInput
          style={s.searchInput}
          placeholder={t('search.placeholder')}
          placeholderTextColor="#A0A098"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => saveToHistory(query)}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoFocus
        />
        {loading && <ActivityIndicator color={BRAND} style={{ marginLeft: 8 }} />}
      </View>

      {/* Filtres projets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
        <TouchableOpacity
          style={[s.chip, !selectedProject && s.chipActive]}
          onPress={() => setSelectedProject(null)}
        >
          <Text style={[s.chipText, !selectedProject && s.chipTextActive]}>{t('search.all')}</Text>
        </TouchableOpacity>
        {projects.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[s.chip, selectedProject === p.name && s.chipActive]}
            onPress={() => setSelectedProject(selectedProject === p.name ? null : p.name)}
          >
            <Text style={[s.chipText, selectedProject === p.name && s.chipTextActive]}>{p.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtres labels */}
      {allLabels.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
          {allLabels.map(l => (
            <TouchableOpacity
              key={l.id}
              style={[s.labelChip, { borderColor: l.color + '88', backgroundColor: selectedLabel === l.id ? l.color + '22' : 'transparent' }]}
              onPress={() => setSelectedLabel(selectedLabel === l.id ? null : l.id)}
            >
              <View style={[s.labelDot, { backgroundColor: l.color }]} />
              <Text style={[s.chipText, { color: l.color }]}>{l.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={results}
        keyExtractor={c => c.id}
        contentContainerStyle={results.length === 0 ? undefined : s.list}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            {query.trim() || selectedProject || selectedLabel ? (
              <Text style={s.emptyText}>{t('search.noResults')}</Text>
            ) : history.length > 0 ? (
              <View style={s.historyBox}>
                <Text style={s.historyLabel}>{t('search.recentSearches')}</Text>
                {history.map((h, i) => (
                  <TouchableOpacity key={i} style={s.historyItem} onPress={() => setQuery(h)}>
                    <Feather name="clock" size={13} color="#8A8A80" />
                    <Text style={s.historyText}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={s.emptyText}>{t('search.typeToSearch')}</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.result} onPress={() => openCard(item)} activeOpacity={0.7}>
            <View style={s.breadcrumb}>
              <Text style={s.breadText}>{item.project_name}</Text>
              <Text style={s.breadSep}> › </Text>
              <Text style={s.breadText}>{item.column_name}</Text>
            </View>
            <Text style={s.resultTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={s.resultDesc} numberOfLines={2}>{item.description}</Text>
            ) : null}
            {(item.labels?.length ?? 0) > 0 && (
              <View style={s.labelRow}>
                {item.labels!.map(l => (
                  <View key={l.id} style={[s.resultLabel, { backgroundColor: l.color + '22', borderColor: l.color + '66' }]}>
                    <Text style={[s.resultLabelText, { color: l.color }]}>{l.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={s.sep} />}
      />

      <CardDetailSheet
        card={activeCard}
        expandAnim={expandAnim}
        token={token ?? ''}
        serverUrl={serverUrl ?? ''}
        projectId={activeCard ? (projectForCard(activeCard)?.id ?? '') : ''}
        insets={insets}
        onClose={closeCard}
        onCardUpdated={(u) => setAllCards(prev => prev.map(c => c.id === u.id ? { ...c, ...u } : c))}
        onCardDeleted={(id) => setAllCards(prev => prev.filter(c => c.id !== id))}
        onNeedRefetch={loadAll}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#EBEBEB', gap: 8 },
  backBtn:        { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  searchInput:    { flex: 1, height: 40, backgroundColor: '#F5F5F0', borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: '#1A1A1A' },
  filterRow:      { borderBottomWidth: 1, borderColor: '#F0F0EC' },
  filterContent:  { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  chip:           { borderRadius: 16, borderWidth: 1.5, borderColor: '#EBEBEB', paddingHorizontal: 12, paddingVertical: 5, backgroundColor: '#fff' },
  chipActive:     { borderColor: BRAND, backgroundColor: '#FFF5F5' },
  chipText:       { fontSize: 12, fontWeight: '600', color: '#6B6B63' },
  chipTextActive: { color: BRAND },
  labelChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 5 },
  labelDot:       { width: 7, height: 7, borderRadius: 4 },
  list:           { paddingVertical: 8 },
  emptyWrap:      { paddingTop: 24 },
  empty:          { alignItems: 'center' },
  emptyText:      { fontSize: 15, color: '#6B6B63', fontWeight: '500', textAlign: 'center', paddingTop: 40 },
  historyBox:     { paddingHorizontal: 20 },
  historyLabel:   { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: '#8A8A80', marginBottom: 8 },
  historyItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderColor: '#F5F5F0' },
  historyText:    { fontSize: 14, color: '#4A4A44', fontWeight: '500' },
  result:         { paddingHorizontal: 20, paddingVertical: 14 },
  breadcrumb:     { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  breadText:      { fontSize: 10, fontWeight: '600', color: '#6B6B63', letterSpacing: 0.5 },
  breadSep:       { fontSize: 10, color: '#8A8A80' },
  resultTitle:    { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },
  resultDesc:     { fontSize: 12, color: '#6B6B63', marginTop: 3, lineHeight: 17 },
  labelRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  resultLabel:    { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  resultLabelText:{ fontSize: 10, fontWeight: '700' },
  sep:            { height: 1, backgroundColor: '#F5F5F0', marginLeft: 20 },
});
