import { useState, useCallback, useMemo } from 'react';
import { makeApi } from '@/lib/api';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  is_read: number;
  created_at: number;
}

type FeatherName = React.ComponentProps<typeof Feather>['name'];

const TYPE_ICONS: Record<string, FeatherName> = {
  card_commented:    'message-circle',
  card_member_added: 'user-plus',
  card_due_soon:     'clock',
  card_moved:        'arrow-right-circle',
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const api = useMemo(() => makeApi(serverUrl, token), [serverUrl, token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/api/notifications');
      const list: Notif[] = Array.isArray(data) ? data : [];
      setNotifs(list);
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

  const unread = notifs.filter(n => !n.is_read).length;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>{t('notifications.title')}</Text>
        {unread > 0 && (
          <TouchableOpacity accessibilityRole="button" onPress={markAllRead}>
            <Text style={s.markAll}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !refreshing ? (
        <View style={s.center}><ActivityIndicator color={BRAND} accessibilityLabel="Loading notifications" /></View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={n => n.id}
          accessibilityRole="list"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
          contentContainerStyle={notifs.length === 0 ? s.emptyContainer : s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Feather name="bell" size={32} color="#A8A8A0" />
              </View>
              <Text style={s.emptyText}>{t('notifications.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.item, !item.is_read && s.itemUnread]}
              accessibilityRole="button"
              accessibilityLabel={(item.card_title ?? t('notifications.fallback')) + ', ' + item.type.replace(/_/g, ' ') + ', ' + (item.is_read ? 'read' : 'unread')}
              onPress={() => markRead(item)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Feather
                  name={TYPE_ICONS[item.type] ?? TYPE_ICONS.default}
                  size={16}
                  color={BRAND}
                />
              </View>
              <View style={s.itemBody}>
                <Text style={s.itemTitle} numberOfLines={2}>
                  {item.card_title ?? t('notifications.fallback')}
                </Text>
                <View style={s.itemMeta}>
                  {item.project_name && (
                    <View style={s.projectTag}>
                      <Text style={s.projectTagText} numberOfLines={1}>{item.project_name}</Text>
                    </View>
                  )}
                  {item.type && (
                    <Text style={s.itemType}>{item.type.replace(/_/g, ' ')}</Text>
                  )}
                </View>
                <Text style={s.itemTime}>{timeAgo(item.created_at, t)}</Text>
              </View>
              {!item.is_read && <View style={s.dot} accessible={false} />}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: BG },
  header:         { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderColor: '#EBEBEB' },
  title:          { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, flex: 1 },
  markAll:        { fontSize: 13, fontWeight: '700', color: BRAND },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:           { paddingVertical: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  empty:          { alignItems: 'center', gap: 12 },
  emptyIconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5F5F0', alignItems: 'center', justifyContent: 'center' },
  emptyText:      { fontSize: 15, color: '#6B6B63', fontWeight: '500' },
  item:           { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  itemUnread:     { backgroundColor: '#FFF8F8' },
  iconWrap:       { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemBody:       { flex: 1, gap: 2 },
  itemTitle:      { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },
  itemMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  projectTag:     { backgroundColor: '#F0F0EC', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  projectTagText: { fontSize: 10, fontWeight: '700', color: '#6b7280', letterSpacing: 0.3, maxWidth: 120 },
  itemType:       { fontSize: 11, color: '#6B6B63', textTransform: 'capitalize' },
  itemTime:       { fontSize: 11, color: '#8A8A80', marginTop: 2 },
  dot:            { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND, marginTop: 6, flexShrink: 0 },
  sep:            { height: 1, backgroundColor: '#F5F5F0', marginLeft: 56 },
});
