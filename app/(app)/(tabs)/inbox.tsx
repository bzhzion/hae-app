import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';

interface Card {
  id: string;
  title: string;
  description?: string;
}

export default function InboxScreen() {
  const { token, serverUrl } = useAuthStore();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    try {
      // TODO: récupérer le projet "Personnel" puis la colonne Inbox
      setLoading(false);
    } catch {
      setLoading(false);
    }
  };

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
        <Text className="text-2xl font-bold text-gray-900">Inbox</Text>
      </View>
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-4xl mb-4">📥</Text>
            <Text className="text-gray-400">Inbox vide. Bien joué.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <Text className="font-medium text-gray-900">{item.title}</Text>
            {item.description ? (
              <Text className="text-gray-400 text-sm mt-1" numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
