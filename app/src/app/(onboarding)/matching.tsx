// Finding your match: make the 3–5 s wait feel magical while POST /match runs.
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { Crane } from '@/components/Crane';
import { COZY } from '@/lib/config';
import { Button, T, TextLink } from '@/components/ui';
import { findMatches } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors, fonts, motion, shadow } from '@/lib/theme';
import type { MatchResult } from '@/lib/types';

export default function Matching() {
  const { profile } = useSession();
  const places = profile?.dream_places ?? [];
  const city = places.length > 1 ? `${places.slice(0, -1).join(', ')} or ${places[places.length - 1]}` : places[0] ?? 'your dream city';
  const home = profile?.home_city ?? 'your city';
  const likes = (profile?.interests ?? []).slice(0, 2).map((s) => s.toLowerCase());

  const [ticks, setTicks] = useState(0);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // warm lamplight drifting slowly behind the frosted glass
  const glow = useSharedValue(0);
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 40 - glow.value * 80 }, { translateX: -20 + glow.value * 40 }] }));
  // the crane drifts back and forth in front of the window while it searches
  const drift = useSharedValue(0);
  const driftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -70 + drift.value * 140 }, { translateY: Math.sin(drift.value * Math.PI) * -18 }, { scaleX: 1 }] }));

  // While no one is free, keep checking every few seconds: the moment someone in your dream city
  // opens this screen too, you both get matched and both phones flip to the postcard.
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const stopPolling = () => {
    if (poll.current) clearTimeout(poll.current);
    poll.current = null;
  };
  const check = (tries: number) => {
    findMatches()
      .then((r) => {
        if (!alive.current) return;
        setResults(r);
        const found = r.find((x) => x.status === 'matched' && x.match);
        if (found && tries > 0) {
          // someone just arrived while you were waiting: reveal the postcard on its own
          poll.current = setTimeout(() => router.replace({ pathname: '/match', params: { id: found.match!.id } }), 1600);
        } else if (!found && tries < 150) {
          poll.current = setTimeout(() => check(tries + 1), 4000);
        }
      })
      .catch((e) => {
        if (alive.current) setError(e instanceof Error ? e.message : 'Matching failed.');
      });
  };

  const run = () => {
    setError(null);
    setResults(null);
    setTicks(0);
    stopPolling();
    const timers = [1, 2, 3].map((n) => setTimeout(() => setTicks((t) => Math.max(t, n)), n * 1200));
    check(0);
    return () => timers.forEach(clearTimeout);
  };

  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    drift.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
    alive.current = true;
    const clear = run();
    return () => {
      alive.current = false;
      stopPolling();
      clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = results !== null && ticks >= 3;
  const first = results?.find((r) => r.status === 'matched' && r.match);

  const lines = [`someone who lives in ${places[0] ?? city}`, 'who loves what you love', `and dreams of ${home}`];
  const foundCity = first?.match?.city;

  return (
    <Screen dark gap={26} style={{ alignItems: 'center', paddingHorizontal: 28, paddingTop: 36 }}>
      <Arch width={220} height={280} border={10} bars dark lifted bottomRadius={6}>
        <View style={{ flex: 1, backgroundColor: '#2A2530' }}>
          <Animated.View style={[{ position: 'absolute', left: -40, right: -40, top: 40, height: 260 }, glowStyle]}>
            <LinearGradient
              colors={['rgba(224,169,85,0)', 'rgba(224,169,85,0.55)', 'rgba(224,169,85,0)']}
              locations={[0, 0.5, 1]}
              style={{ flex: 1, borderRadius: 200 }}
            />
          </Animated.View>
          <BlurView intensity={30} tint="dark" style={{ position: 'absolute', inset: 0 }} />
        </View>
      </Arch>
      {COZY.crane ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 150, alignSelf: 'center' }, driftStyle]}>
          <Crane size={70} mood={done && first ? 'alert' : 'fly'} perched={false} />
        </Animated.View>
      ) : null}

      <View style={{ gap: 10, alignItems: 'center' }}>
        <T variant="title" style={{ color: colors.nightSoft, textAlign: 'center' }}>
          {done && !first ? `Waiting for someone in ${city}` : done ? `We found your window in ${foundCity}` : `Looking for your window in ${city}`}
        </T>
        <T variant="muted" style={{ color: colors.nightSoft, textAlign: 'center' }}>
          {done && !first
            ? `Keep this screen open. The moment someone in ${city} opens their window, you'll meet here.`
            : `Someone who ${likes.length ? `loves ${likes.join(' and ')}, ` : ''}and dreams of ${home}.`}
        </T>
      </View>

      {/* status notes, pinned up one at a time */}
      <View style={{ alignSelf: 'stretch', gap: 10, minHeight: 150 }}>
        {lines.slice(0, ticks).map((l, i) => (
          <Animated.View key={l} entering={FadeInDown.duration(motion.settle)} style={{ alignSelf: i % 2 ? 'flex-end' : 'flex-start' }}>
            <View style={[{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 2, backgroundColor: colors.postcard, transform: [{ rotate: `${[-2, 1.5, -1][i]}deg` }] }, shadow.card]}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink }}>{l} ✓</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Spacer />
      {error ? (
        <View style={{ alignSelf: 'stretch', gap: 10 }}>
          <T style={{ color: colors.amber, textAlign: 'center' }}>{error}</T>
          <Button dark title="Try again" onPress={run} />
        </View>
      ) : done ? (
        <Animated.View entering={FadeIn} style={{ alignSelf: 'stretch' }}>
          {first?.match ? (
            <Button dark title="See your match" onPress={() => router.replace({ pathname: '/match', params: { id: first.match!.id } })} />
          ) : (
            <TextLink dark title="Go to Today for now" onPress={() => router.replace('/today')} style={{ alignSelf: 'center' }} />
          )}
        </Animated.View>
      ) : (
        <View style={{ height: 56 }} />
      )}
    </Screen>
  );
}
