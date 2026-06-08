import { View, Text } from 'react-native';

export default function NextScreen() {
  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Next</Text>
      </View>
      <View className="flex-1 items-center justify-center">
        <Text className="text-4xl mb-4">▶️</Text>
        <Text className="text-gray-400">Prochaines actions</Text>
      </View>
    </View>
  );
}
