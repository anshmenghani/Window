// The four main tabs, with the custom floating tab bar.
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';
import { registerPushToken } from '@/lib/data';
import { colors } from '@/lib/theme';

export default function TabsLayout() {
  useEffect(() => {
    // Ask for notification permission once the user reaches the main app (knocks + new windows)
    registerPushToken().catch(() => {});
  }, []);

  return (
    <Tabs
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tabBar={(props: any) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.mist } }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="wall" />
      <Tabs.Screen name="passport" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
