import { View, Image } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#A00000' }}>
      <Image source={require('../assets/icon-transparent.png')} style={{ width: 120, height: 120 }} resizeMode="contain" />
    </View>
  );
}
