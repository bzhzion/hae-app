import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, Dimensions, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, TextInput, Keyboard, Image, Platform, Animated, Alert, Modal, KeyboardAvoidingView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useStt } from '@/hooks/useStt';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import CardDetailSheet from '@/components/CardDetailSheet';
import { FlatList } from 'react-native';

const { width } = Dimensions.get('window');

const GTD_ORDER = ['gtd_inbox','gtd_someday','gtd_next','gtd_urgent','gtd_waiting','gtd_done'];
const GTD_EN_NAMES: Record<string, string[]> = {
  gtd_inbox:   ['inbox',   'Inbox'],
  gtd_next:    ['next',    'Next'],
  gtd_urgent:  ['urgent',  'Urgent'],
  gtd_someday: ['someday', 'Someday'],
  gtd_waiting: ['waiting', 'Waiting'],
  gtd_done:    ['done',    'Done'],
};
const GTD_DEFAULTS: Record<string, string> = {
  gtd_inbox:   'À TRIER',
  gtd_next:    'PROCHAIN',
  gtd_urgent:  'URGENT',
  gtd_someday: 'UN JOUR',
  gtd_waiting: 'EN ATTENTE',
  gtd_done:    'FAIT',
};
const GTD_ICONS: Record<string, string> = {
  gtd_inbox:   'inbox',
  gtd_next:    'zap',
  gtd_urgent:  'alert-circle',
  gtd_someday: 'clock',
  gtd_waiting: 'pause-circle',
  gtd_done:    'check-circle',
};

const GTD_HINTS: Record<string, string> = {
  gtd_inbox:   'Boîte de réception — tout ce qui entre',
  gtd_next:    'Prochaines actions concrètes',
  gtd_urgent:  'À faire immédiatement',
  gtd_someday: 'Idées et projets pour plus tard',
  gtd_waiting: 'En attente d\'une réponse externe',
  gtd_done:    'Tâches terminées',
};

const TAB_W = 100;

function fmtSecs(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function RunningTimer({ total, startedAt }: { total: number; startedAt: number }) {
  const [display, setDisplay] = useState(() => total + Math.floor((Date.now() - startedAt) / 1000));
  useEffect(() => {
    const id = setInterval(() => setDisplay(p => p + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={rt.wrap}>
      <Feather name="play-circle" size={11} color="#A00000" />
      <Text style={rt.text}>{fmtSecs(display)}</Text>
    </View>
  );
}
const rt = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  text: { fontSize: 11, fontWeight: '700', color: '#A00000', letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
});

interface Label { id: string; name: string; color: string; }
interface Card { id: string; title: string; description?: string; due_date?: number | null; stopwatch_total?: number; stopwatch_started_at?: number | null; column_id?: string; project_id?: string; labels?: Label[]; position?: number; checklist_total?: number; checklist_done?: number; comment_count?: number; }
interface Column { id: string; name: string; type: string; cards: Card[]; }

export default function TasksScreen() {
  const { t } = useTranslation();
  const GTD_LABELS: Record<string, string> = {
    gtd_inbox:   t('tasks.inbox'),
    gtd_next:    t('tasks.next'),
    gtd_urgent:  t('tasks.urgent'),
    gtd_someday: t('tasks.someday'),
    gtd_waiting: t('tasks.waiting'),
    gtd_done:    t('tasks.done'),
  };
  const GTD_HINTS_T: Record<string, string> = {
    gtd_inbox:   t('tasks.renameHint_inbox'),
    gtd_next:    t('tasks.renameHint_next'),
    gtd_urgent:  t('tasks.renameHint_urgent'),
    gtd_someday: t('tasks.renameHint_someday'),
    gtd_waiting: t('tasks.renameHint_waiting'),
    gtd_done:    t('tasks.renameHint_done'),
  };
  const [page, setPage] = useState(0);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addingInColumn, setAddingInColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [renamingCol, setRenamingCol] = useState<Column | null>(null);
  const [renameText, setRenameText] = useState('');
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pagerRef = useRef<ScrollView>(null);
  const headerRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, serverUrl, logout } = useAuthStore();
  const { currentProjectId, currentProjectName, pendingCardId, setPendingCard, pendingNewCardTitle, setPendingNewCardTitle, refreshKey } = useProjectStore();
  const { state: sttState, toggle: sttToggle } = useStt();

  const handleMicPress = useCallback(async () => {
    const text = await sttToggle();
    if (text) setNewCardTitle(prev => prev ? prev + ' ' + text : text);
  }, [sttToggle]);

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

  const pages = [
    ...GTD_ORDER.map(type => columns.find(c => c.type === type)).filter(Boolean) as Column[],
    ...columns.filter(c => c.type === 'custom'),
  ];

  const renameColumn = useCallback(async () => {
    if (!renamingCol || !renameText.trim()) { setRenamingCol(null); return; }
    try {
      await fetch(`${serverUrl}/api/columns/${renamingCol.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameText.trim() }),
      });
      setColumns(prev => prev.map(c => c.id === renamingCol.id ? { ...c, name: renameText.trim() } : c));
    } catch (e) { Alert.alert('Erreur', String(e)); }
    setRenamingCol(null);
  }, [renamingCol, renameText, serverUrl, token]);

  const createCard = useCallback(async (colId: string) => {
    const title = newCardTitle.trim();
    if (!title) { setAddingInColumn(null); return; }
    const col = columns.find(c => c.id === colId);
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


  useEffect(() => {
    if (currentProjectId) return;
    // Auto-select projet Personnel si aucun projet sélectionné
    (async () => {
      try {
        const res = await fetch(`${serverUrl}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const projects = await res.json();
        const personal = projects.find((p: any) => p.is_personal === 1) ?? projects[0];
        if (personal) useProjectStore.getState().setCurrentProject(personal.id, personal.name);
      } catch {}
    })();
  }, [currentProjectId, serverUrl, token]);

  useEffect(() => { fetchProject(); }, [currentProjectId]);
  useEffect(() => { if (refreshKey > 0) fetchProject(); }, [refreshKey]);
  useFocusEffect(useCallback(() => { fetchProject(); }, [fetchProject]));

  useEffect(() => {
    if (!pendingCardId || columns.length === 0) return;
    const card = columns.flatMap(c => c.cards).find(c => c.id === pendingCardId);
    if (!card) return;
    setPendingCard(null);
    setTimeout(() => openCard(card), 300);
  }, [pendingCardId, columns]);

  useEffect(() => {
    if (!pendingNewCardTitle || columns.length === 0) return;
    const first = columns[0];
    if (!first) return;
    setPendingNewCardTitle(null);
    setNewCardTitle(pendingNewCardTitle);
    setTimeout(() => setAddingInColumn(first.id), 100);
  }, [pendingNewCardTitle, columns]);

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

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <Image source={require('@/assets/icon.png')} style={s.logo} accessible={false} />
          <TouchableOpacity style={s.projectPill} onPress={() => router.push('/(app)/(tabs)/projects')} accessibilityRole="button" accessibilityLabel={currentProjectName ?? 'No project selected'}>
            <Text style={s.projectName} numberOfLines={1}>
              {currentProjectName ?? 'Aucun projet'}
            </Text>
            <Feather name="chevron-down" size={12} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/search')} style={s.roundBtn} accessibilityLabel="Search" accessibilityRole="button">
            <Feather name="search" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/(tabs)/calendar')} style={s.roundBtn} accessibilityLabel="Calendar" accessibilityRole="button">
            <Feather name="calendar" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/archives')} style={s.roundBtn} accessibilityLabel="Archives" accessibilityRole="button">
            <Feather name="archive" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(app)/project-settings')} style={s.roundBtn} accessibilityLabel="Project settings" accessibilityRole="button">
            <Feather name="settings" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView ref={headerRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {pages.map((col, i) => {
            const count = col.cards.length;
            const isDefaultName = GTD_EN_NAMES[col.type]?.includes(col.name);
            const label = (isDefaultName || !col.name ? (GTD_LABELS[col.type] ?? col.name) : col.name).toUpperCase();
            return (
              <TouchableOpacity
                key={col.id}
                onPress={() => goTo(i)}
                onLongPress={() => {
                  const isDefault = GTD_EN_NAMES[col.type]?.includes(col.name);
                  setRenamingCol(col);
                  setRenameText(isDefault || !col.name ? (GTD_LABELS[col.type] ?? col.name) : col.name);
                }}
                delayLongPress={500}
                style={s.tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: page === i }}
              >
                <View style={s.tabRow}>
                  <Feather
                    name={(GTD_ICONS[col.type] ?? 'layers') as any}
                    size={11}
                    color={page === i ? '#1A1A1A' : '#C4C4BE'}
                  />
                  <Text style={[s.tabLabel, page === i && s.tabLabelActive]}>{label}</Text>
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
          <Text style={s.emptyMain}>{t('tasks.noProject')}</Text>
          <Text style={s.emptySub}>{t('tasks.goToProjects')}</Text>
        </View>
      ) : loading && columns.length === 0 ? (
        <View style={s.empty}><ActivityIndicator color={BRAND} accessibilityLabel="Loading..." /></View>
      ) : (
        <ScrollView ref={pagerRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll} scrollEventThrottle={16} style={s.pager}>
          {pages.map((col) => {
            const cards = col.cards;
            return (
              <View key={col.id} style={s.page}>
                {cards.length === 0 ? (
                  <ScrollView
                    contentContainerStyle={s.emptyScrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
                    automaticallyAdjustKeyboardInsets={true}
                  >
                    {addingInColumn === col.id ? (
                      <View style={[s.quickAdd, { width: width - 40 }]}>
                        <View style={s.quickRow}>
                          <TextInput
                            autoFocus
                            style={[s.quickInput, { flex: 1 }]}
                            placeholder={t('tasks.newTask')}
                            placeholderTextColor="#A0A098"
                            value={newCardTitle}
                            onChangeText={setNewCardTitle}
                            onSubmitEditing={() => createCard(col.id)}
                            onBlur={() => { if (!newCardTitle.trim()) setAddingInColumn(null); }}
                            returnKeyType="done"
                            accessibilityLabel="New task title"
                          />
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[s.micBtn, sttState === 'recording' && s.micBtnActive]} onPress={handleMicPress} accessibilityLabel="Dicter">
                            {sttState === 'transcribing'
                              ? <ActivityIndicator size="small" color={BRAND} />
                              : <Feather name="mic" size={14} color={sttState === 'recording' ? '#fff' : BRAND} />}
                          </TouchableOpacity>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.cancelBtn} onPress={() => { setAddingInColumn(null); setNewCardTitle(''); }} accessibilityLabel="Annuler">
                            <Feather name="x" size={12} color="#8A8A80" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={s.emptyState}>
                        <Text style={s.emptyMain}>{t('tasks.nothingHere')}</Text>
                        <Text style={s.emptySub}>{t('tasks.wellDone')}</Text>
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
                    ListHeaderComponent={addingInColumn === col.id ? (
                      <View style={s.quickAdd}>
                        <View style={s.quickRow}>
                          <TextInput
                            autoFocus
                            style={[s.quickInput, { flex: 1 }]}
                            placeholder={t('tasks.newTask')}
                            placeholderTextColor="#A0A098"
                            value={newCardTitle}
                            onChangeText={setNewCardTitle}
                            onSubmitEditing={() => createCard(col.id)}
                            onBlur={() => { if (!newCardTitle.trim()) setAddingInColumn(null); }}
                            returnKeyType="done"
                            accessibilityLabel="New task title"
                          />
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[s.micBtn, sttState === 'recording' && s.micBtnActive]} onPress={handleMicPress} accessibilityLabel="Dicter">
                            {sttState === 'transcribing'
                              ? <ActivityIndicator size="small" color={BRAND} />
                              : <Feather name="mic" size={14} color={sttState === 'recording' ? '#fff' : BRAND} />}
                          </TouchableOpacity>
                          <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.cancelBtn} onPress={() => { setAddingInColumn(null); setNewCardTitle(''); }} accessibilityLabel="Annuler">
                            <Feather name="x" size={12} color="#8A8A80" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={s.card}
                        onPress={() => openCard(item)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={item.title}
                      >
                        <Text style={s.cardTitle}>{item.title}</Text>
                        {item.description ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                        {(item.checklist_total ?? 0) > 0 && (
                          <View style={s.checklistProgress} accessible={true} accessibilityLabel={`${item.checklist_done ?? 0}/${item.checklist_total} items done`}>
                            <View style={s.checklistBar}>
                              <View style={[s.checklistFill, { width: `${Math.round(((item.checklist_done ?? 0) / item.checklist_total!) * 100)}%` as any }]} />
                            </View>
                            <Text style={s.checklistCount}>{item.checklist_done ?? 0}/{item.checklist_total}</Text>
                          </View>
                        )}
                        {(item.due_date || item.stopwatch_started_at || (item.labels?.length ?? 0) > 0) && (
                          <View style={s.cardFooter}>
                            <View style={s.cardFooterLeft}>
                              {item.due_date ? (
                                <View style={s.dueBadge}>
                                  <Text style={s.dueText}>{new Date(item.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</Text>
                                </View>
                              ) : null}
                              {item.stopwatch_started_at ? (
                                <RunningTimer total={item.stopwatch_total ?? 0} startedAt={item.stopwatch_started_at} />
                              ) : null}
                              {(item.comment_count ?? 0) > 0 ? (
                                <View style={s.commentBubble}>
                                  <Feather name="message-circle" size={10} color="#6B6B63" />
                                  <Text style={s.commentBubbleText}>{item.comment_count}</Text>
                                </View>
                              ) : null}
                            </View>
                            {(item.labels?.length ?? 0) > 0 && (
                              <View style={s.cardLabels}>
                                {item.labels!.map(l => (
                                  <View key={l.id} style={[s.cardLabel, { backgroundColor: l.color + '22', borderColor: l.color + '66' }]}>
                                    <Text style={[s.cardLabelText, { color: l.color }]}>{l.name}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        )}
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

      <Modal visible={!!renamingCol} transparent animationType="fade" onRequestClose={() => setRenamingCol(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setRenamingCol(null)}>
          <TouchableOpacity activeOpacity={1} style={s.modalBox} accessibilityViewIsModal={true}>
            <Text style={s.modalTitle}>{t('tasks.renameColumn')}</Text>
            {renamingCol && GTD_HINTS_T[renamingCol.type] && (
              <Text style={s.modalHint}>{GTD_HINTS_T[renamingCol.type]}</Text>
            )}
            <TextInput
              style={s.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={renameColumn}
              accessibilityLabel="Column name"
            />
            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setRenamingCol(null)} style={s.modalCancel}>
                <Text style={s.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={renameColumn} style={s.modalConfirm}>
                <Text style={s.modalConfirmText}>{t('tasks.rename')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {currentProjectId && (
        <TouchableOpacity
          style={[s.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => { setAddingInColumn(pages[page]?.id ?? null); setNewCardTitle(''); }}
          activeOpacity={0.85}
          accessibilityLabel="Add task"
          accessibilityRole="button"
        >
          <Feather name="plus" size={26} color="#fff" />
        </TouchableOpacity>
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
  projectPill:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0F0EC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  projectName:    { fontSize: 13, fontWeight: '700', color: '#1A1A1A', letterSpacing: 0.5, flex: 1 },
  roundBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  badge:          { position: 'absolute', top: -2, right: -2, backgroundColor: '#fff', borderRadius: 6, minWidth: 12, height: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: BRAND },
  badgeText:      { color: BRAND, fontSize: 7, fontWeight: '700' },
  fab:            { position: 'absolute', right: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8 }, android: { elevation: 6 } }) },
  modalBackdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  modalBox:       { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%' },
  modalTitle:     { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  modalHint:      { fontSize: 12, color: '#6B6B63', marginBottom: 16, lineHeight: 17 },
  modalInput:     { borderWidth: 1.5, borderColor: BRAND, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#1A1A1A', marginTop: 12 },
  modalActions:   { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalCancel:    { paddingHorizontal: 16, paddingVertical: 8 },
  modalCancelText:{ fontSize: 14, color: '#6B6B63', fontWeight: '500' },
  modalConfirm:   { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  modalConfirmText:{ fontSize: 14, color: '#fff', fontWeight: '700' },
  quickAdd:       { paddingHorizontal: 4, paddingVertical: 8 },
  quickRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickInput:     { fontSize: 15, fontWeight: '500', color: '#1A1A1A', borderBottomWidth: 1, borderBottomColor: BRAND, paddingVertical: 8 },
  micBtn:         { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  micBtnActive:   { backgroundColor: BRAND },
  cancelBtn:      { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E8E8E4', alignItems: 'center', justifyContent: 'center' },
  tabs:           { flexDirection: 'row', paddingHorizontal: 20 },
  tab:            { width: TAB_W, paddingBottom: 10, alignItems: 'center' },
  tabRow:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabLabel:       { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, color: '#8A8A80' },
  tabLabelActive: { color: '#1A1A1A' },
  tabCount:       { fontSize: 9, fontWeight: '700', color: '#8A8A80', backgroundColor: '#F0F0EC', borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
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
  cardFooter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cardFooterLeft:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentBubble:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0F0EC', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  commentBubbleText: { fontSize: 10, fontWeight: '600', color: '#6B6B63' },
  cardLabels:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  cardLabel:      { borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  cardLabelText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  cardTitle:      { fontSize: 15, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.3, lineHeight: 21 },
  cardDesc:       { fontSize: 13, color: '#6B6B63', marginTop: 6, lineHeight: 18 },
  dueBadge:       { alignSelf: 'flex-start', backgroundColor: '#FFF5F5', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#F5D0D0' },
  dueText:           { fontSize: 11, fontWeight: '600', color: BRAND, letterSpacing: 0.3 },
  checklistProgress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  checklistBar:      { flex: 1, height: 4, backgroundColor: '#EBEBEB', borderRadius: 2, overflow: 'hidden' },
  checklistFill:     { height: 4, backgroundColor: BRAND, borderRadius: 2 },
  checklistCount:    { fontSize: 10, fontWeight: '600', color: '#6B6B63', minWidth: 28, textAlign: 'right' },
  empty:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyScrollContent: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  emptyState:     { alignItems: 'center' },
  emptyMain:      { fontSize: 18, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.3 },
  emptySub:       { fontSize: 13, color: '#6B6B63', marginTop: 6 },
});
