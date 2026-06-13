import { useState, useCallback, useMemo, useRef } from 'react';
import { makeApi } from '@/lib/api';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useNotifStore } from '@/stores/notif';
import { useProjectStore } from '@/stores/project';

const BRAND = '#A00000';
const BG = '#FAFAF8';

interface Notif {
  id: string;
  type: string;
  card_id: string | null;
  card_title: string | null;
  project_id: string | null;
  project_name: string | null;
  owner_type: string | null;
  project_owner_id: string | null;
  title: string | null;
  body: string | null;
  url: string | null;
  is_read: number;
  created_at: number;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const TYPE_ICONS: Record<string, FeatherName> = {
  card_commented:    'message-circle',
  card_member_added: 'user-plus',
  card_due_soon:     'clock',
  card_moved:        'arrow-right-circle',
  inbox_message:     'inbox',
  default:           'bell',
};

function timeAgo(ts: number, t: (k: string, opts?: any) => string): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('notifications.justNow');
  if (m < 60) return t('notifications.minutesAgo', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('notifications.hoursAgo', { count: h });
  const d = Math.floor(h / 24);
  return t('notifications.daysAgo', { count: d });
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, serverUrl } = useAuthStore();
  const { setUnreadCount, decrement } = useNotifStore();
  const { setPendingCard, setCurrentProject } = useProjectStore();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [archived, setArchived] = useState<Notif[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, arch] = await Promise.all([
        api('GET', '/api/notifications', undefined, { silent: true }).catch(() => []),
        api('GET', '/api/notifications/archived', undefined, { silent: true }).catch(() => []),
      ]);
      const list: Notif[] = Array.isArray(data) ? data : [];
      setNotifs(list);
      setArchived(Array.isArray(arch) ? arch : []);
      setUnreadCount(list.filter(n => !n.is_read).length);
    } catch {}
    finally { setLoading(false); }
  }, [api, setUnreadCount]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = useCallback(async (n: Notif) => {
    try {
      if (!n.is_read) {
        await api('PATCH', `/api/notifications/${n.id}/read`);
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: 1 } : x));
        decrement();
      }
      if (n.card_id && n.project_id) {
        setCurrentProject(n.project_id, n.project_name ?? '', n.owner_type ?? 'user', n.project_owner_id ?? '');
        setPendingCard(n.card_id);
        router.navigate('/(app)/(tabs)/tasks');
      }
    } catch {}
  }, [api, decrement, setPendingCard, setCurrentProject, router]);

  const markAllRead = useCallback(async () => {
    try {
      await api('POST', '/api/notifications/read-all');
      setNotifs(prev => prev.map(x => ({ ...x, is_read: 1 })));
      setUnreadCount(0);
    } catch {}
  }, [api, setUnreadCount]);

  const dismiss = useCallback(async (id: string) => {
    const notif = notifs.find(x => x.id === id);
    swipeRefs.current.get(id)?.close();
    try {
      await api('PATCH', `/api/notifications/${id}/dismiss`);
      setNotifs(prev => {
        const updated = prev.filter(x => x.id !== id);
        setUnreadCount(updated.filter(x => !x.is_read).length);
        return updated;
      });
      if (notif) setArchived(prev => [{ ...notif, is_read: 1 }, ...prev]);
    } catch {}
  }, [api, setUnreadCount, notifs]);

  const dismissAll = useCallback(() => {
    Alert.alert(
      t('notifications.archiveAllTitle', { defaultValue: 'Tout archiver' }),
      t('notifications.archiveAllMsg', { defaultValue: 'Archiver toutes les notifications ?' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('notifications.archiveAll', { defaultValue: 'Archiver' }), onPress: async () => {
          try {
            await api('POST', '/api/notifications/dismiss-all');
            setArchived(prev => [...notifs.map(x => ({ ...x, is_read: 1 })), ...prev]);
            setNotifs([]);
            setUnreadCount(0);
          } catch {}
        }},
      ]
    );
  }, [api, setUnreadCount, notifs, t]);

  const unread = notifs.filter(n => !n.is_read).length;
  const displayList = showArchived ? archived : notifs;

  const renderSwipeRight = useCallback(() => (
    <View style={s.swipeAction}>
      <Feather name="archive" size={18} color="#fff" />
    </View>
  ), []);

  const renderItem = useCallback(({ item }: { item: Notif }) => (
    <Swipeable
      ref={ref => swipeRefs.current.set(item.id, ref)}
      renderRightActions={renderSwipeRight}
      overshootRight={false}
      friction={2}
      rightThreshold={72}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          dismiss(item.id);
        }
      }}
    >
      <TouchableOpacity
        style={[s.item, !item.is_read && s.itemUnread]}
        accessibilityRole="button"
        onPress={() => !showArchived && markRead(item)}
        activeOpacity={0.7}
      >
        <View style={s.iconWrap}>
          <Feather name={TYPE_ICONS[item.type] ?? TYPE_ICONS.default} size={16} color={BRAND} />
        </View>
        <View style={s.itemBody}>
          <Text style={s.itemTitle} numberOfLines={2}>
            {item.type === 'inbox_message'
              ? (item.title ?? t('notifications.fallback'))
              : (item.card_title ?? t('notifications.fallback'))}
          </Text>
          {item.type === 'inbox_message' && item.body ? (
            <Text style={s.itemBody2} numberOfLines={3}>{item.body}</Text>
          ) : null}
          <View style={s.itemMeta}>
            {item.project_name && (
              <View style={s.projectTag}>
                <Text style={s.projectTagText} numberOfLines={1}>{item.project_name}</Text>
              </View>
            )}
            <Text style={s.itemType}>{item.type.replace(/_/g, ' ')}</Text>
          </View>
          <View style={s.itemMetaRow}>
            <Text style={s.itemTime}>{timeAgo(item.created_at, t)}</Text>
            {item.type === 'inbox_message' && item.url ? (
              <TouchableOpacity onPress={() => Linking.openURL(item.url!)}>
                <Text style={s.itemLink}>Ouvrir</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {!item.is_read && !showArchived && <View style={s.dot} accessible={false} />}
      </TouchableOpacity>
    </Swipeable>
  ), [markRead, renderSwipeRight, showArchived, t]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>{t('notifications.title')}</Text>
        <View style={s.headerActions}>
          <TouchableOpacity onPress={() => setShowArchived(v => !v)} style={s.archiveToggle}>
            <Text style={[s.archiveToggleText, showArchived && { color: BRAND }]}>
              {showArchived ? t('notifications.inbox', { defaultValue: 'Inbox' }) : t('notifications.archives', { defaultValue: 'Archives' })}
              {!showArchived && archived.length > 0 ? ` (${archived.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      {(!showArchived && (unread > 0 || notifs.length > 0)) && (
        <View style={s.subHeader}>
          {unread > 0 && (
            <TouchableOpacity onPress={markAllRead}>
              <Text style={s.markAll}>{t('notifications.markAllRead')}</Text>
            </TouchableOpacity>
          )}
          {notifs.length > 0 && (
            <TouchableOpacity onPress={dismissAll} style={s.archiveBtn}>
              <Feather name="archive" size={14} color="#8A8A80" />
              <Text style={s.archiveBtnText}>Tout archiver</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading && !refreshing ? (
        <View style={s.center}><ActivityIndicator color={BRAND} /></View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={n => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
          contentContainerStyle={displayList.length === 0 ? s.emptyContainer : s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Feather name={showArchived ? 'archive' : 'bell'} size={32} color="#A8A8A0" />
              </View>
              <Text style={s.emptyText}>
                {showArchived
                  ? t('notifications.archiveEmpty', { defaultValue: 'Aucune archive' })
                  : t('notifications.empty')}
              </Text>
            </View>
          }
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: BG },
  header:           { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 0, paddingBottom: 10, borderColor: '#EBEBEB' },
  title:            { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, flex: 1 },
  headerActions:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subHeader:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  markAll:          { fontSize: 13, fontWeight: '700', color: BRAND },
  archiveBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5 },
  archiveBtnText:   { fontSize: 13, fontWeight: '500', color: '#8A8A80' },
  archiveToggle:    { paddingVertical: 4, paddingHorizontal: 6 },
  archiveToggleText:{ fontSize: 13, fontWeight: '600', color: '#8A8A80' },
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:             { paddingVertical: 8 },
  emptyContainer:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:            { alignItems: 'center', gap: 12 },
  emptyIconWrap:    { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center' },
  emptyText:        { fontSize: 15, color: '#6B6B63', fontWeight: '500' },
  item:             { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, gap: 12, backgroundColor: BG },
  itemUnread:       { backgroundColor: '#FFF8F8' },
  iconWrap:         { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemBody:         { flex: 1, gap: 2 },
  itemTitle:        { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },
  itemMeta:         { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  projectTag:       { backgroundColor: '#F0F0EC', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  projectTagText:   { fontSize: 10, fontWeight: '700', color: '#6b7280', letterSpacing: 0.3, maxWidth: 120 },
  itemType:         { fontSize: 11, color: '#6B6B63', textTransform: 'capitalize' },
  itemTime:         { fontSize: 11, color: '#8A8A80', marginTop: 2 },
  itemBody2:        { fontSize: 13, color: '#4A4A42', lineHeight: 18, marginTop: 2 },
  itemMetaRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  itemLink:         { fontSize: 11, fontWeight: '700', color: BRAND },
  dot:              { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND, marginTop: 6, flexShrink: 0 },
  sep:              { height: 1, backgroundColor: '#F5F5F0', marginLeft: 56 },
  swipeAction:      { backgroundColor: '#A00000', width: 72, alignItems: 'center', justifyContent: 'center' },
});
