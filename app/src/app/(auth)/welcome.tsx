// Welcome: explain Window in one screen and get people in.
// The arch preview slowly crossfades between three cities, each showing its real local time and real sky.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Wood } from '@/components/materials';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { CityScene } from '@/components/CityScene';
import { WindowLogo } from '@/components/Icons';
import { Button, T } from '@/components/ui';
import { colors, fonts, shadow } from '@/lib/theme';
import { findCity } from '@/lib/cities';
import { timeIn } from '@/lib/time';

const PREVIEWS = ['Kyoto', 'Lisbon', 'Seoul'].map((name) => findCity(name)!);

export default function Welcome() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % PREVIEWS.length), 3500);
    return () => clearInterval(id);
  }, []);
  const p = PREVIEWS[i];

  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift]);
  const curtainStyle = useAnimatedStyle(() => ({ left: -60 + drift.value * 220 }));

  return (
    <Screen gap={22} style={{ paddingHorizontal: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <WindowLogo />
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: 24, color: colors.ink }}>window</Text>
      </View>

      <View style={{ alignSelf: 'center', alignItems: 'center' }}>
        <Arch width={260} height={320} border={12} bottomRadius={6} bars barWidth={6} glass>
          <Animated.View key={p.name} entering={FadeIn.duration(900)} exiting={FadeOut.duration(900)} style={{ position: 'absolute', inset: 0 }}>
            <CityScene where={p} id={`welcome-${p.name}`} bike={false} />
          </Animated.View>
          {/* a curtain's shadow drifting across the glass */}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -20, bottom: -20, width: 120 }, curtainStyle]}>
            <LinearGradient colors={['rgba(46,42,38,0)', 'rgba(46,42,38,0.16)', 'rgba(46,42,38,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
          </Animated.View>
        </Arch>
        {/* the sill, and a small printed label under it */}
        <View style={[{ width: 300, height: 14, marginTop: -2, borderRadius: 3, overflow: 'hidden' }, shadow.card]}>
          <Wood />
        </View>
        <Text style={{ marginTop: 10, fontFamily: fonts.medium, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted, fontVariant: ['tabular-nums'] }}>
          {p.name} · {timeIn(p.tz)} now
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        <T variant="display">See the world through someone&apos;s window.</T>
        <T variant="muted" style={{ fontSize: 16, lineHeight: 23 }}>
          One photo a day from a real person in the place you dream about. Translated, explained, and just for you.
        </T>
      </View>

      <Spacer />
      <View style={{ gap: 4 }}>
        <Button title="Open your window" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signup' } })} />
        <Button variant="ghost" title="I already have an account" onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'login' } })} />
      </View>
    </Screen>
  );
}
