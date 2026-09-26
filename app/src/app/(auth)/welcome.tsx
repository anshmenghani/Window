// Welcome: explain Window in one screen and get people in.
// The arch preview slowly crossfades between three cities, each showing its real local time.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { CityScene, Mood } from '@/components/CityScene';
import { WindowLogo } from '@/components/Icons';
import { Button, T } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';
import { timeIn } from '@/lib/time';

const PREVIEWS: { city: string; tz: string; mood: Mood }[] = [
  { city: 'Kyoto', tz: 'Asia/Tokyo', mood: 'morning' },
  { city: 'Lisbon', tz: 'Europe/Lisbon', mood: 'sunset' },
  { city: 'Seoul', tz: 'Asia/Seoul', mood: 'night' },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % PREVIEWS.length), 3500);
    return () => clearInterval(id);
  }, []);
  const p = PREVIEWS[i];

  return (
    <Screen gap={22} style={{ paddingHorizontal: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <WindowLogo />
        <Text style={{ fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.5, color: colors.ink }}>window</Text>
      </View>

      <Arch width={280} height={340} border={10} bottomRadius={22} bars barWidth={6} style={{ alignSelf: 'center' }}>
        <Animated.View key={p.city} entering={FadeIn.duration(900)} exiting={FadeOut.duration(900)} style={{ position: 'absolute', inset: 0 }}>
          <CityScene mood={p.mood} id="welcome" bike={false} />
        </Animated.View>
        <View
          style={{
            position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(255,253,248,0.94)',
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.light }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>
            {p.city} · {timeIn(p.tz)}
          </Text>
        </View>
      </Arch>

      <View style={{ gap: 10 }}>
        <T variant="display">See the world through someone&apos;s window.</T>
        <T variant="muted" style={{ fontSize: 16, lineHeight: 23 }}>
          One photo a day from a real person in the place you dream about. Translated, explained, and just for you.
        </T>
      </View>

      <Spacer />
      <View style={{ gap: 6 }}>
        <Button title="Open your window" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} />
        <Button variant="ghost" title="I already have an account" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })} />
      </View>
    </Screen>
  );
}
