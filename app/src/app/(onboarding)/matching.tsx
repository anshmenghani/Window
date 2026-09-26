// Finding your match: make the 3–5 s wait feel magical while POST /match runs.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { Button, T, Tick } from '@/components/ui';
import { findMatches } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import type { MatchResult } from '@/lib/types';

export default function Matching() {
  const { profile } = useSession();
  const city = profile?.dream_places[0] ?? 'your dream city';
  const home = profile?.home_city ?? 'your city';
  const likes = (profile?.interests ?? []).slice(0, 2).map((s) => s.toLowerCase());

  const [ticks, setTicks] = useState(0);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const glow = useSharedValue(0.4);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const run = () => {
    setError(null);
    setResults(null);
    setTicks(0);
    const timers = [1, 2, 3].map((n) => setTimeout(() => setTicks((t) => Math.max(t, n)), n * 1200));
    findMatches()
      .then(setResults)
      .catch((e) => setError(e instanceof Error ? e.message : 'Matching failed.'));
    return () => timers.forEach(clearTimeout);
  };

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
    return run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = results !== null && ticks >= 3;
  const first = results?.find((r) => r.status === 'matched' && r.match);

  const lines = [`People who live in ${city}`, 'Matching your interests', `Who dreams of ${home}?`];

  return (
    <Screen dark bg={colors.ink} gap={30} style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 36 }}>
      <Arch width={230} height={290} border={10} frameColor="#2E3566" bars lifted={false} bottomRadius={20}>
        <View style={{ flex: 1, backgroundColor: '#3A4378' }}>
          <Animated.View style={[{ position: 'absolute', inset: 0 }, glowStyle]}>
            <LinearGradient colors={['rgba(242,184,75,0)', 'rgba(242,184,75,0.35)', 'rgba(242,184,75,0.8)']} locations={[0.2, 0.6, 1]} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      </Arch>

      <View style={{ gap: 10, alignItems: 'center' }}>
        <T variant="title" style={{ color: colors.postcard, textAlign: 'center', fontSize: 28 }}>
          {done && !first ? `No one in ${city} yet` : done ? 'We found your window' : `Looking for your window in ${city}`}
        </T>
        <T variant="muted" style={{ color: colors.nightSoft, textAlign: 'center' }}>
          {done && !first
            ? 'We\'ll keep looking and let you know as soon as someone joins.'
            : `Someone who ${likes.length ? `loves ${likes.join(' and ')}, ` : ''}and dreams of ${home}.`}
        </T>
      </View>

      <View style={{ alignSelf: 'stretch', gap: 14, padding: 18, borderRadius: 20, backgroundColor: '#262C58' }}>
        {lines.map((l, i) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Tick dark done={ticks > i} />
            <T style={{ color: ticks > i ? colors.postcard : colors.nightSoft, fontSize: 15 }}>{l}</T>
          </View>
        ))}
      </View>

      <Spacer />
      {error ? (
        <View style={{ alignSelf: 'stretch', gap: 10 }}>
          <T style={{ color: '#F26B55', textAlign: 'center' }}>{error}</T>
          <Button title="Try again" onPress={run} />
        </View>
      ) : done ? (
        <Animated.View entering={FadeIn} style={{ alignSelf: 'stretch' }}>
          {first?.match ? (
            <Button title="See your match" onPress={() => router.replace({ pathname: '/match', params: { id: first.match!.id } })} />
          ) : (
            <Button title="Go to Today" onPress={() => router.replace('/today')} />
          )}
        </Animated.View>
      ) : (
        <View style={{ height: 56 }} />
      )}
    </Screen>
  );
}
