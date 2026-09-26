// Root of the app: loads fonts, provides the session + live inbox, and sets up navigation.
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
} from '@expo-google-fonts/figtree';
import { Caveat_500Medium, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { SessionProvider } from '@/lib/session';
import { InboxProvider } from '@/lib/inbox';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold,
    Caveat_500Medium, Caveat_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SessionProvider>
      <InboxProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.mist } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="capture" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.night } }} />
          <Stack.Screen name="sending" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="window/[id]" />
        </Stack>
      </InboxProvider>
    </SessionProvider>
  );
}
