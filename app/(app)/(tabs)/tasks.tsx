import { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, FlatList, Dimensions, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, TextInput, Keyboard, Image, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import CardDetailSheet from '@/components/CardDetailSheet';

const { width } = Dimensions.get('window');

const GTD_PAGES = [
  { key: 'gtd_inbox',   label: 'INBOX'   },
  { key: 'gtd_next',    label: 'NEXT'    },
  { key: 'gtd_urgent',  label: 'URGENT'  },
  { key: 'gtd_someday', label: 'SOMEDAY' },
  { key: 'gtd_waiting', label: 'WAITING' },
];

const TAB_W = 88;

interface Card { id: string; title: string; description?: string; due_date?: number | null; stopwatch_total?: number; stopwatch_started_at?: number | null; column_id?: string; project_id?: string; }
interface Column { id: string; type: string; cards: Card[]; }

export default function TasksScreen() {
  const [page, setPage] = useState(0);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<ScrollView>(null);
  const headerRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, serverUrl, logout } = useAuthStore();
  const { currentProjectId, currentProjectName } = useProjectStore();

  const fetchProject = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/projects/${currentProjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { logout(); router.replace('/(auth)/login'); return; }
      const data = await res.json();
      const cols: Column[] = data.columns ?? [];
      const withCards = await Promise.all(
        cols.map(async (col) => {
          const r = await fetch(`${serverUrl}/api/columns/${col.id}/cards`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const cards = await r.json();
          return { ...col, cards: Array.isArray(cards) ? cards : [] };
        })
      );
      setColumns(withCards);
    } catch {}
    finally { setLoading(false); }
  }, [currentProjectId, serverUrl, token, logout, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProject();
    setRefreshing(false);
  }, [fetchProject]);

  const openCard = (card: Card) => {
    setActiveCard(card);
    expandAnim.setValue(0);
    Animated.spring(expandAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };

  const closeCard = () => {
    Animated.timing(expandAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
      setActiveCard(null);
    });
  };

  const handleCardUpdated = useCallback((updated: Partial<Card> & { id: string }) => {
    setColumns(prev => prev.map(col => ({
      ...col,
      cards: col.cards.map(c => c.id === updated.id ? { ...c, ...updated } : c),
    })));
  }, []);

  const handleCardDeleted = useCallback((cardId: string) => {
    setColumns(prev => prev.map(col => ({
      ...col,
      cards: col.cards.filter(c => c.id !== cardId),
    })));
  }, []);

  const createCard = useCallback(async (colType: string) => {
    const title = newCardTitle.trim();
    if (!title) { setAddingInColumn(null); return; }
    const col = columns.find(c => c.type === colType);
    if (!col) return;
    Keyboard.dismiss();
    setAddingInColumn(null);
    setNewCardTitle('');
    try {
      const res = await fetch(`${serverUrl}/api/columns/${col.id}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.status === 401) { logout(); router.replace('/(auth)/login'); return; }
      await fetchProject();
    } catch {}
  }, [newCardTitle, columns, serverUrl, token, fetchProject, logout, router]);

  useEffect(() => { fetchProject(); }, [currentProjectId]);
  useFocusEffect(useCallback(() => { fetchProject(); }, [fetchProject]));

  const goTo = (i: number) => {
    pagerRef.current?.scrollTo({ x: i * width, animated: true });
    centerTab(i);
    setPage(i);
  };

  const centerTab = (i: number) => {
    const offset = i * TAB_W - width / 2 + TAB_W / 2;
    headerRef.current?.scrollTo({ x: Math.max(0, offset), animated: true });
  };

  const onScroll = (e: any) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) { setPage(i); centerTab(i); }
  };

  const getCards = (type: string): Card[] =>
    columns.find(c => c.type === type)?.cards ?? [];

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <Image source={require('@/assets/icon.png')} style={s.logo} />
          <Text style={s.projectName} numberOfLines={1}>
            {currentProjectName ?? 'Aucun projet'}
          </Text>
          {currentProjectId && (
            <TouchableOpacity onPress={() => { setAddingInColumn(GTD_PAGES[page].key); setNewCardTitle(''); }} style={s.addBtn}>
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          )}
        </View>
        <ScrollView ref={headerRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {GTD_PAGES.map((p, i) => {
            const count = getCards(p.key).length;
            return (
              <TouchableOpacity key={p.key} onPress={() => goTo(i)} style={s.tab}>
                <View style={s.tabRow}>
                  <Text style={[s.tabLabel, page === i && s.tabLabelActive]}>{p.label}</Text>
                  {count > 0 && <Text style={[s.tabCount, page === i && s.tabCountActive]}>{count}</Text>}
                </View>
                <View style={[s.tabDot, page === i && s.tabDotActive]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {!currentProjectId ? (
        <View style={s.empty}>
          <Text style={s.emptyMain}>Aucun projet sélectionné.</Text>
          <Text style={s.emptySub}>Va dans Projets pour en choisir un.</Text>
        </View>
      ) : loading ? (
        <View style={s.empty}><ActivityIndicator color={BRAND} /></View>
      ) : (
        <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll} scrollEventThrottle={16} style={s.pager}>
          {GTD_PAGES.map((p) => {
            const cards = getCards(p.key);
            return (
              <View key={p.key} style={s.page}>
                {cards.length === 0 ? (
                  <ScrollView
                    contentContainerStyle={s.emptyScrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
                  >
                    {addingInColumn === p.key ? (
                      <View style={[s.quickAdd, { width: width - 40 }]}>
                        <TextInput
                          autoFocus
                          style={s.quickInput}
                          placeholder="Nouvelle tâche..."
                          placeholderTextColor="#C4C4BE"
                          value={newCardTitle}
                          onChangeText={setNewCardTitle}
                          onSubmitEditing={() => createCard(p.key)}
                          onBlur={() => { if (!newCardTitle.trim()) setAddingInColumn(null); }}
                          returnKeyType="done"
                        />
                      </View>
                    ) : (
                      <View style={s.emptyState}>
                        <Text style={s.emptyMain}>Rien ici.</Text>
                        <Text style={s.emptySub}>Bien joué.</Text>
                      </View>
                    )}
                  </ScrollView>
                ) : (
                  <FlatList
                    data={cards}
                    keyExtractor={c => c.id}
                    style={{ width }}
                    contentContainerStyle={s.cardList}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
                    ListHeaderComponent={addingInColumn === p.key ? (
                      <View style={s.quickAdd}>
                        <TextInput
                          autoFocus
                          style={s.quickInput}
                          placeholder="Nouvelle tâche..."
                          placeholderTextColor="#C4C4BE"
                          value={newCardTitle}
                          onChangeText={setNewCardTitle}
                          onSubmitEditing={() => createCard(p.key)}
                          onBlur={() => { if (!newCardTitle.trim()) setAddingInColumn(null); }}
                          returnKeyType="done"
                        />
                      </View>
                    ) : null}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={s.card} onPress={() => openCard(item)} activeOpacity={0.7}>
                        <Text style={s.cardTitle}>{item.title}</Text>
                        {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                        {item.due_date ? (
                          <View style={s.dueBadge}>
                            <Text style={s.dueText}>{new Date(item.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  />
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <CardDetailSheet
        card={activeCard}
        expandAnim={expandAnim}
        token={token ?? ''}
        serverUrl={serverUrl ?? ''}
        projectId={currentProjectId ?? ''}
        insets={insets}
        onClose={closeCard}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
        onNeedRefetch={fetchProject}
      />
    </View>
  );
}

const BRAND = '#A00000';
const BG = '#FAFAF8';

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },
  header:         { backgroundColor: BG, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  headerTop:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 14, gap: 10 },
  logo:           { width: 28, height: 28, borderRadius: 6 },
  projectName:    { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.5, flex: 1 },
  addBtn:         { width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  addBtnText:     { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '300' },
  quickAdd:       { paddingHorizontal: 4, paddingVertical: 8 },
  quickInput:     { fontSize: 15, fontWeight: '500', color: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: BRAND, paddingVertical: 8 },
  tabs:           { flexDirection: 'row', paddingHorizontal: 20 },
  tab:            { width: TAB_W, paddingBottom: 10, alignItems: 'center' },
  tabRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabLabel:       { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, color: '#C4C4BE' },
  tabLabelActive: { color: '#1A1A1A' },
  tabCount:       { fontSize: 9, fontWeight: '700', color: '#C4C4BE', backgroundColor: '#F0F0EC', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  tabCountActive: { color: BRAND, backgroundColor: '#F5E0E0' },
  tabDot:         { width: 3, height: 3, borderRadius: 2, backgroundColor: 'transparent', marginTop: 5 },
  tabDotActive:   { backgroundColor: BRAND },
  pager:          { flex: 1 },
  page:           { width, flex: 1 },
  cardList:       { padding: 16, paddingTop: 12 },
  card:           {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  cardTitle:      { fontSize: 15, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.3, lineHeight: 21 },
  cardDesc:       { fontSize: 13, color: '#9A9A92', marginTop: 6, lineHeight: 18 },
  dueBadge:       { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#FFF5F5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#F5D0D0' },
  dueText:        { fontSize: 11, fontWeight: '600', color: BRAND, letterSpacing: 0.3 },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyScrollContent: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  emptyState:     { alignItems: 'center' },
  emptyMain:      { fontSize: 18, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.3 },
  emptySub:       { fontSize: 13, color: '#B0B0A8', marginTop: 6 },
});
