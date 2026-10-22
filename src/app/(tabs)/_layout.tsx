import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useSensors } from '@/lib/store';
import { useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { settings } = useSensors();
  const { c } = useTheme();

  // First launch (or demo switched off with no address saved): go to Connect.
  if (!settings.host && !settings.demo) return <Redirect href="/connect" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar state={props.state} navigateToTab={props.navigateToTab} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg }, animation: 'shift' }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
