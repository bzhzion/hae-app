import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const BRAND = '#A00000';
const INACTIVE = '#8A8A80';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ icon, iconActive, focused }: { icon: IoniconsName; iconActive: IoniconsName; focused: boolean }) {
  return <Ionicons name={focused ? iconActive : icon} size={22} color={focused ? BRAND : INACTIVE} />;
}

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: focused ? BRAND : INACTIVE }}>
      {label.toUpperCase()}
    </Text>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const tabBarStyle = {
    backgroundColor: '#FAFAF8',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    height: 56 + insets.bottom,
    paddingBottom: insets.bottom,
  };

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle }}>
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.tasks')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon icon="checkbox-outline" iconActive="checkbox" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="organisations"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.orgs')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon icon="people-outline" iconActive="people" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.notifications')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon icon="notifications-outline" iconActive="notifications" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: ({ focused }) => <TabLabel label={t('tabs.settings')} focused={focused} />,
          tabBarIcon: ({ focused }) => <TabIcon icon="person-outline" iconActive="person" focused={focused} />,
        }}
      />
      <Tabs.Screen name="projects"      options={{ href: null }} />
      <Tabs.Screen name="calendar"      options={{ href: null }} />
      <Tabs.Screen name="search"        options={{ href: null }} />
    </Tabs>
  );
}
