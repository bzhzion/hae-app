import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { token, serverUrl } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${serverUrl}/api/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#A00000" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Projets</Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-4xl mb-4">🗂️</Text>
            <Text className="text-gray-400">Aucun projet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
            onPress={() => router.push(`/(app)/project/${item.id}`)}
          >
            <Text className="font-semibold text-gray-900">{item.name}</Text>
            {item.description ? (
              <Text className="text-gray-400 text-sm mt-1" numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
