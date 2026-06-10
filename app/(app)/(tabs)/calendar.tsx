import { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Modal, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import CardDetailSheet from '@/components/CardDetailSheet';

const BRAND = '#A00000';
const BG = '#FAFAF8';

interface Card { id: string; title: string; due_date?: number | null; column_id?: string; project_id?: string; description?: string; labels?: any[]; position?: number; }

function toYMD(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekday(year: number, month: number) {
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const months = t('calendar.months', { returnObjects: true }) as string[];
  const days = t('calendar.days', { returnObjects: true }) as string[];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, serverUrl } = useAuthStore();
  const { currentProjectId } = useProjectStore();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const [overflowCards, setOverflowCards] = useState<Card[]>([]);
  const [showOverflow, setShowOverflow] = useState(false);

  const load = useCallback(async () => {
    if (!currentProjectId) return;
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/api/projects/${currentProjectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const colIds: string[] = (data.columns ?? []).map((c: any) => c.id);
      const allCards: Card[] = [];
      await Promise.all(colIds.map(async (colId) => {
        const r = await fetch(`${serverUrl}/api/columns/${colId}/cards`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const cs = await r.json();
        if (Array.isArray(cs)) allCards.push(...cs);
      }));
      setCards(allCards.filter(c => c.due_date));
    } catch {}
    finally { setLoading(false); }
  }, [currentProjectId, serverUrl, token]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCard = (c: Card) => {
    setActiveCard(c);
    expandAnim.setValue(0);
    Animated.spring(expandAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
  };
  const closeCard = () => {
    Animated.timing(expandAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setActiveCard(null));
  };

  const cardsByDay = useMemo(() => {
    const map: Record<string, Card[]> = {};
    cards.forEach(c => {
      if (!c.due_date) return;
      const key = toYMD(c.due_date);
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [cards]);

  const todayStr = toYMD(Date.now());
  const dim = daysInMonth(year, month);
  const firstWD = firstWeekday(year, month);
  const cells: (number | null)[] = [...Array(firstWD).fill(null), ...Array.from({length: dim}, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={22} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={s.title}>{t('calendar.title')}</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="chevron-left" size={20} color="#4A4A44" />
          </TouchableOpacity>
          <View style={s.monthTitleRow}>
            <Text style={s.monthTitle}>{months[month]} {year}</Text>
            {(year !== now.getFullYear() || month !== now.getMonth()) && (
              <TouchableOpacity style={s.todayBtn} onPress={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="rotate-ccw" size={13} color={BRAND} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={nextMonth} style={s.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="chevron-right" size={20} color="#4A4A44" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}>
        {/* Jours de la semaine */}
        <View style={s.weekRow}>
          {days.map(d => <Text key={d} style={s.weekDay}>{d}</Text>)}
        </View>

        {/* Grille */}
        <View style={s.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={s.cell} />;
            const key = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const daycards = cardsByDay[key] ?? [];
            const isToday = key === todayStr;
            const isPast = key < todayStr && daycards.length > 0;
            return (
              <View key={key} style={[s.cell, isToday && s.cellToday]}>
                <Text style={[s.dayNum, isToday && s.dayNumToday]}>{day}</Text>
                {daycards.slice(0, 3).map(c => (
                  <TouchableOpacity key={c.id} onPress={() => openCard(c)} style={[s.chip, isPast && s.chipOverdue]}>
                    <Text style={[s.chipText, isPast && s.chipTextOverdue]} numberOfLines={1}>{c.title}</Text>
                  </TouchableOpacity>
                ))}
                {daycards.length > 3 && (
                  <TouchableOpacity onPress={() => { setOverflowCards(daycards); setShowOverflow(true); }}>
                    <Text style={s.more}>+{daycards.length - 3}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {loading && <ActivityIndicator color={BRAND} style={{ margin: 20 }} />}
      </ScrollView>

      {/* Overflow modal */}
      <Modal visible={showOverflow} transparent animationType="fade" onRequestClose={() => setShowOverflow(false)}>
        <TouchableOpacity style={s.overflowBackdrop} activeOpacity={1} onPress={() => setShowOverflow(false)}>
          <View style={s.overflowSheet}>
            <Text style={s.overflowTitle}>{t('calendar.allCards')}</Text>
            {overflowCards.map(c => (
              <TouchableOpacity key={c.id} style={s.overflowItem} onPress={() => { setShowOverflow(false); setTimeout(() => openCard(c), 100); }}>
                <Text style={s.overflowItemText}>{c.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <CardDetailSheet
        card={activeCard}
        expandAnim={expandAnim}
        token={token ?? ''}
        serverUrl={serverUrl ?? ''}
        projectId={currentProjectId ?? ''}
        insets={insets}
        onClose={closeCard}
        onCardUpdated={(u) => setCards(prev => prev.map(c => c.id === u.id ? { ...c, ...u } : c))}
        onCardDeleted={(id) => setCards(prev => prev.filter(c => c.id !== id))}
        onNeedRefetch={load}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BG },
  header:          { paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  headerTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  backBtn:         { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title:           { fontSize: 22, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  monthNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  navBtn:          { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  monthTitleRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthTitle:      { fontSize: 15, fontWeight: '700', color: '#4A4A44', letterSpacing: -0.2 },
  todayBtn:        { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#F5D0D0', alignItems: 'center', justifyContent: 'center' },
  weekRow:         { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F0F0EC' },
  weekDay:         { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', letterSpacing: 1, color: '#6B6B63' },
  grid:            { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell:            { width: '14.28%', minHeight: 72, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#F0F0EC', padding: 4 },
  cellToday:       { backgroundColor: '#FFF8F8' },
  dayNum:          { fontSize: 11, fontWeight: '600', color: '#6B6B63', marginBottom: 2 },
  dayNumToday:     { color: BRAND, fontWeight: '800' },
  chip:            { backgroundColor: '#EEF2FF', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1, marginBottom: 2 },
  chipOverdue:     { backgroundColor: '#FEE2E2' },
  chipText:        { fontSize: 9, fontWeight: '600', color: '#3730A3' },
  chipTextOverdue: { color: BRAND },
  more:            { fontSize: 9, color: '#6B6B63', fontWeight: '600' },
  overflowBackdrop:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  overflowSheet:   { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: 280, gap: 4 },
  overflowTitle:   { fontSize: 13, fontWeight: '700', color: '#6B6B63', letterSpacing: 1, marginBottom: 8 },
  overflowItem:    { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F5F5F0' },
  overflowItemText:{ fontSize: 14, fontWeight: '500', color: '#1A1A1A' },
});
