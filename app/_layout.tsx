import { View } from 'react-native';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#A00000' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#A00000' } }} />
    </View>
  );
}
