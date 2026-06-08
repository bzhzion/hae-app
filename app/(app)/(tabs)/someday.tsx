import { View, Text } from 'react-native';

export default function SomedayScreen() {
  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-14 pb-4 border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">Someday</Text>
      </View>
      <View className="flex-1 items-center justify-center">
        <Text className="text-4xl mb-4">☁️</Text>
        <Text className="text-gray-400">Un jour peut-être</Text>
      </View>
    </View>
  );
}
