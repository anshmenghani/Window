// On its way: your postcard flies across the world while the AI checks, transcribes and translates it.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Button, T, Tick } from '@/components/ui';
import { getMatches, watchWindow } from '@/lib/data';
import { onSendError } from '@/lib/outbox';
import { useSession } from '@/lib/session';
import { languageName } from '@/lib/cities';
import { distanceKm, roundKm } from '@/lib/time';
import { colors, fonts, radius, shadow } from '@/lib/theme';
import type { Match, WindowProgress } from '@/lib/types';

const W = 342;
const H = 150;
// flight path: M24 128 Q171 -40 318 118
const P0 = { x: 24, y: 128 };
const C = { x: 171, y: -40 };
const P1 = { x: 318, y: 118 };

export default function Sending() {
  const { window: windowId, match: matchId, caption } = useLocalSearchParams<{ window: string; match: string; caption?: string }>();
  const { profile } = useSession();
  const [match, setMatch] = useState<Match | null>(null);
  const [progress, setProgress] = useState<WindowProgress>({ status: 'uploading', steps: {} });
  const [error, setError] = useState<string | null>(null);
  const [boxW, setBoxW] = useState(W);

  const t = useSharedValue(0);

  useEffect(() => {
    getMatches().then((ms) => setMatch(ms.find((m) => m.id === matchId) ?? null));
  }, [matchId]);

  useEffect(() => {
    if (!windowId) return;
    t.value = withTiming(0.8, { duration: 3200, easing: Easing.out(Easing.cubic) });
    const stopWatch = watchWindow(windowId, setProgress);
    const stopErr = onSendError(windowId, setError);
    return () => {
      stopWatch();
      stopErr();
    };
  }, [windowId, t]);

  useEffect(() => {
    if (progress.status === 'ready') t.value = withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) });
  }, [progress.status, t]);

  const scale = boxW / W;
  const cardStyle = useAnimatedStyle(() => {
    const u = t.value;
    const x = (1 - u) ** 2 * P0.x + 2 * (1 - u) * u * C.x + u ** 2 * P1.x;
    const y = (1 - u) ** 2 * P0.y + 2 * (1 - u) * u * C.y + u ** 2 * P1.y;
    return {
      transform: [
        { translateX: x * scale - 38 },
        { translateY: y - 40 },
        { rotate: `${-20 + u * 40}deg` },
        { scale: 1 - u * 0.25 },
      ],
    };
  });

  const partner = match?.partner;
  const lang = languageName(partner?.languages[0]);
  const km = profile && partner ? roundKm(distanceKm(profile, partner)) : null;
  const blocked = progress.status === 'blocked';
  const failed = progress.status === 'failed' || !!error;

  const steps = [
    { label: 'Checked for safety', done: !!progress.steps.safety },
    { label: 'Voice note turned into text', done: !!progress.steps.transcribed },
    { label: `Translated into ${lang}`, done: !!progress.steps.translated },
    { label: `Your voice, speaking ${lang}`, done: !!progress.steps.voiced },
  ];

  return (
    <Screen gap={22} style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <T variant="title" style={{ fontSize: 30, textAlign: 'center' }}>
          {progress.status === 'ready' ? `Delivered to ${partner?.home_city ?? ''}` : `On its way to ${partner?.home_city ?? '…'}`}
        </T>
        <T variant="muted" style={{ textAlign: 'center' }}>
          {km ? `${km} km, and it arrives in seconds.` : 'Arriving in seconds.'}
        </T>
      </View>

      <View style={{ height: H + 16 }} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
        <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          <Path d="M24 128 Q171 -40 318 118" fill="none" stroke={colors.dash} strokeWidth={2} strokeDasharray="4 7" />
        </Svg>
        <Text style={{ position: 'absolute', left: 4, top: 140, fontFamily: fonts.bold, fontSize: 12, color: colors.ink }}>{profile?.home_city}</Text>
        <Text style={{ position: 'absolute', right: 4, top: 130, fontFamily: fonts.bold, fontSize: 12, color: colors.ink }}>{partner?.home_city}</Text>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 76, height: 54, padding: 4, borderRadius: 6, backgroundColor: colors.postcard }, shadow.card, cardStyle]}>
          <View style={{ flex: 1, borderRadius: 3, backgroundColor: colors.dusk }} />
        </Animated.View>
      </View>

      {blocked || failed ? (
        <View style={{ padding: 18, borderRadius: radius.lg, backgroundColor: '#FBE4E2', gap: 6 }}>
          <T style={{ fontFamily: fonts.bold, color: colors.danger }}>{blocked ? 'This window couldn\'t be sent' : 'Something went wrong'}</T>
          <T style={{ color: colors.ink, fontSize: 15 }}>
            {blocked ? 'It didn\'t pass our safety check. Try a different photo or caption.' : error ?? 'Your window didn\'t make it. Try sending it again.'}
          </T>
        </View>
      ) : (
        <View style={[{ padding: 18, borderRadius: radius.lg, backgroundColor: colors.postcard, gap: 10 }, shadow.soft]}>
          <T variant="eyebrow">{partner?.name ?? 'They'} will read</T>
          {progress.caption_t ? (
            <Animated.Text entering={FadeIn} style={{ fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, color: colors.hand }}>
              {progress.caption_t}
            </Animated.Text>
          ) : (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.dash }}>Translating…</Text>
          )}
          {caption ? <T variant="hand" style={{ fontSize: 21, color: colors.muted }}>you wrote: {caption}</T> : null}
        </View>
      )}

      <View style={{ gap: 12, padding: 16, paddingHorizontal: 18, borderRadius: radius.lg, backgroundColor: colors.white }}>
        {steps.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Tick done={s.done} />
            <T style={{ fontSize: 15, color: s.done ? colors.ink : colors.muted }}>{s.label}</T>
          </View>
        ))}
      </View>

      <Spacer />
      <Button
        title={failed || blocked ? 'Try again' : 'Back to today'}
        onPress={() =>
          failed || blocked
            ? router.replace({ pathname: '/capture', params: { match: matchId } })
            : router.dismissTo('/today')
        }
      />
    </Screen>
  );
}
