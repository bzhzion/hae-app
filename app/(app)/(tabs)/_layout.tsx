import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const GTD_TABS = [
  { name: 'inbox',   label: 'Inbox',   icon: '📥' },
  { name: 'next',    label: 'Next',    icon: '▶️' },
  { name: 'someday', label: 'Someday', icon: '☁️' },
  { name: 'projects',label: 'Projets', icon: '🗂️' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#A00000',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { borderTopColor: '#F3F4F6' },
        tabBarLabel: GTD_TABS.find((t) => t.name === route.name)?.label ?? route.name,
        tabBarIcon: ({ focused }) => {
          const tab = GTD_TABS.find((t) => t.name === route.name);
          return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{tab?.icon}</Text>;
        },
      })}
    >
      {GTD_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
