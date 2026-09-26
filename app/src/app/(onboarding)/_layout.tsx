import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.mist } }}>
      <Stack.Screen name="matching" options={{ gestureEnabled: false, animation: 'fade', contentStyle: { backgroundColor: colors.night } }} />
      <Stack.Screen name="match" options={{ gestureEnabled: false, animation: 'fade' }} />
    </Stack>
  );
}
