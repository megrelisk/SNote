import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { Pressable } from 'react-native';
import { useColors } from '@/lib/theme';

/** Bottom navigation: Drives · Recent · Calendar · Settings, plus a Quick note action. */
export default function TabsLayout() {
  const colors = useColors();
  const icon =
    (name: React.ComponentProps<typeof Ionicons>['name']) =>
    ({ color, size }: { color: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.bgSoft, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable onPress={() => router.push('/capture')} hitSlop={10} style={{ paddingHorizontal: 16 }} accessibilityLabel="Quick note">
            <Ionicons name="create-outline" size={24} color={colors.accent} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Drives', tabBarIcon: icon('folder-open-outline') }} />
      <Tabs.Screen name="recent" options={{ title: 'Recent', tabBarIcon: icon('time-outline') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
