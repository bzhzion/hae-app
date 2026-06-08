import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';

interface Project { id: string; name: string; description?: string; }

export default function ProjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, serverUrl, logout } = useAuthStore();
  const { currentProjectId, setCurrentProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${serverUrl}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 401) { logout(); router.replace('/(auth)/login'); return; }
      const d = await r.json();
      setProjects(Array.isArray(d) ? d : []);
    } catch {}
    finally { setLoading(false); }
  }, [serverUrl, token]);

  useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

  const select = (p: Project) => {
    setCurrentProject(p.id, p.name);
    router.navigate('/(app)/(tabs)/tasks');
  };

  if (loading) return <View style={s.center}><ActivityIndicator color="#A00000" /></View>;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title}>Projets</Text>
        <Text style={s.count}>{projects.length}</Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={i => i.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<View style={s.emptyWrap}><Text style={s.emptyMain}>Aucun projet.</Text></View>}
        renderItem={({ item, index }) => {
          const active = item.id === currentProjectId;
          return (
            <TouchableOpacity style={[s.card, active && s.cardActive]} onPress={() => select(item)}>
              <View style={s.cardLeft}>
                <Text style={[s.cardIndex, active && s.cardIndexActive]}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <View style={s.cardBody}>
                <Text style={[s.cardTitle, active && s.cardTitleActive]}>{item.name}</Text>
                {item.description ? <Text style={s.cardDesc} numberOfLines={1}>{item.description}</Text> : null}
              </View>
              {active
                ? <View style={s.activeDot} />
                : <Text style={s.cardArrow}>›</Text>
              }
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={s.sep} />}
      />
    </View>
  );
}

const BRAND = '#A00000';
const BG = '#FAFAF8';

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BG },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG },
  header:          { paddingBottom: 20, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderColor: '#EBEBEB' },
  title:           { fontSize: 28, fontWeight: '800', color: '#1A1A1A', letterSpacing: -1, flex: 1 },
  count:           { fontSize: 13, fontWeight: '600', color: BRAND },
  list:            { paddingVertical: 8 },
  sep:             { height: 1, backgroundColor: '#F0F0EC', marginLeft: 72 },
  card:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  cardActive:      { backgroundColor: '#FFF5F5' },
  cardLeft:        { width: 32, marginRight: 16 },
  cardIndex:       { fontSize: 11, fontWeight: '700', color: '#D0D0C8', letterSpacing: 1 },
  cardIndexActive: { color: BRAND },
  cardBody:        { flex: 1 },
  cardTitle:       { fontSize: 15, fontWeight: '600', color: '#1A1A1A', letterSpacing: -0.2 },
  cardTitleActive: { color: BRAND },
  cardDesc:        { fontSize: 12, color: '#B0B0A8', marginTop: 2 },
  cardArrow:       { fontSize: 20, color: '#D0D0C8', marginLeft: 8 },
  activeDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND },
  emptyWrap:       { alignItems: 'center', marginTop: 80 },
  emptyMain:       { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
});
