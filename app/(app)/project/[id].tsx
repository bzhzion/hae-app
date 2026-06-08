import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';

interface Card {
  id: string;
  title: string;
  description?: string;
}

interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, serverUrl } = useAuthStore();
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const res = await fetch(`${serverUrl}/api/projects/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setColumns(data.columns ?? []);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#A00000" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-14 pb-4 bg-white border-b border-gray-100 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-[#A00000] text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Kanban</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="p-4">
        {columns.map((col) => (
          <View key={col.id} className="w-72 mr-3">
            <View className="bg-white rounded-xl p-3 border border-gray-100">
              <Text className="font-semibold text-gray-700 mb-3">{col.name}</Text>
              {col.cards?.map((card) => (
                <View key={card.id} className="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-100">
                  <Text className="text-gray-900 text-sm font-medium">{card.title}</Text>
                  {card.description ? (
                    <Text className="text-gray-400 text-xs mt-1" numberOfLines={2}>
                      {card.description}
                    </Text>
                  ) : null}
                </View>
              ))}
              {(!col.cards || col.cards.length === 0) && (
                <Text className="text-gray-300 text-sm text-center py-4">Vide</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
