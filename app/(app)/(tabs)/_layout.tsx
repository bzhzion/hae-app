import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TABS = [
  { name: 'tasks',    label: 'TASKS'    },
  { name: 'projects', label: 'PROJETS'  },
  { name: 'settings', label: 'RÉGLAGES' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs screenOptions={({ route }) => {
      const tab = TABS.find(t => t.name === route.name);
      return {
        headerShown: false,
        tabBarActiveTintColor: '#A00000',
        tabBarInactiveTintColor: '#B0B0A8',
        tabBarStyle: {
          backgroundColor: '#FAFAF8',
          borderTopWidth: 1,
          borderTopColor: '#EBEBEB',
          height: 48 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabel: ({ focused }) => (
          <Text style={{
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 1.5,
            color: focused ? '#1A1A1A' : '#C4C4BE',
          }}>
            {tab?.label}
          </Text>
        ),
        tabBarIcon: ({ focused }) => (
          <View style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: focused ? '#A00000' : 'transparent',
            marginBottom: 2,
          }} />
        ),
      };
    }}>
      {TABS.map(t => <Tabs.Screen key={t.name} name={t.name} />)}
    </Tabs>
  );
}
