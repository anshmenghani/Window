// Sending: the world turns, a stitched route draws from your city to theirs, and a tiny postcard
// flies across. Delivery never waits on the animation; status slips update as the AI works.
import { useEffect, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Globe } from '@/components/Globe';
import { Button, T, Tick } from '@/components/ui';
import { getMatches, watchWindow } from '@/lib/data';
import { onSendError } from '@/lib/outbox';
import { useSession } from '@/lib/session';
import { languageName } from '@/lib/cities';
import { distanceKm, roundKm } from '@/lib/time';
import { colors, fonts, motion, radius, shadow } from '@/lib/theme';
import type { Match, WindowProgress } from '@/lib/types';

export default function Sending() {
  const { window: windowId, match: matchId, caption } = useLocalSearchParams<{ window: string; match: string; caption?: string }>();
  const { profile } = useSession();
  const { width: screenW } = useWindowDimensions();
  const [match, setMatch] = useState<Match | null>(null);
  const [progress, setProgress] = useState<WindowProgress>({ status: 'uploading', steps: {} });
  const [error, setError] = useState<string | null>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    getMatches().then((ms) => setMatch(ms.find((m) => m.id === matchId) ?? ms[0] ?? null));
  }, [matchId]);

  useEffect(() => {
    if (!windowId) return;
    const stopWatch = watchWindow(windowId, setProgress);
    const stopErr = onSendError(windowId, setError);
    return () => {
      stopWatch();
      stopErr();
    };
  }, [windowId]);

  const partner = match?.partner;
  const lang = languageName(partner?.languages[0]);
  const km = profile && partner ? roundKm(distanceKm(profile, partner)) : null;
  const blocked = progress.status === 'blocked';
  const failed = progress.status === 'failed' || !!error;
  const ready = progress.status === 'ready';
  const globeSize = Math.min(screenW - 88, 260);

  const slips = [
    { label: 'checked for safety', done: !!progress.steps.safety },
    { label: `translated into ${lang}`, done: !!progress.steps.translated },
    { label: `ready for ${partner?.name ?? 'them'}`, done: ready },
  ];

  return (
    <Screen gap={18} style={{ paddingHorizontal: 24, paddingTop: 20 }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <T variant="heading" style={{ textAlign: 'center', fontSize: 23, lineHeight: 28 }}>
          {ready && landed ? `Delivered to ${partner?.home_city ?? ''}` : `On its way to ${partner?.home_city ?? '…'}`}
        </T>
        <T variant="small" style={{ textAlign: 'center', fontSize: 14 }}>
          {km ? `${km} km from ${profile?.home_city}` : ' '}
        </T>
      </View>

      <View style={{ alignItems: 'center' }}>
        {profile && partner ? (
          <Globe size={globeSize} from={{ lat: profile.lat, lng: profile.lng }} to={{ lat: partner.lat, lng: partner.lng }} onArrive={() => setLanded(true)} />
        ) : (
          <View style={{ height: globeSize }} />
        )}
      </View>

      {blocked || failed ? (
        <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.terracotta, gap: 4 }}>
          <T style={{ fontFamily: fonts.semibold, color: colors.terracotta }}>{blocked ? 'This window couldn\'t be sent' : 'Something went wrong'}</T>
          <T style={{ color: colors.ink, fontSize: 15 }}>
            {blocked ? 'It didn\'t pass our safety check. Try a different photo or caption.' : error ?? 'Your window didn\'t make it. Try sending it again.'}
          </T>
        </View>
      ) : (
        // the translation, on a cream note
        <View style={[{ padding: 16, borderRadius: radius.sm, backgroundColor: colors.postcard, gap: 8, overflow: 'hidden', transform: [{ rotate: '-0.6deg' }] }, shadow.card]}>
          <T variant="eyebrow">{partner?.name ?? 'They'} will read</T>
          {progress.caption_t ? (
            <Animated.Text entering={FadeIn.duration(motion.scene)} style={{ fontFamily: fonts.medium, fontSize: 19, lineHeight: 27, color: colors.ink }}>
              {progress.caption_t}
            </Animated.Text>
          ) : (
            <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.dash }}>translating…</Text>
          )}
          {caption ? <T variant="hand" style={{ fontSize: 21, color: colors.muted }}>you wrote: {caption}</T> : null}
        </View>
      )}

      {/* status slips */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {slips.map((s, i) => (
          <Animated.View key={s.label} entering={FadeInDown.delay(i * motion.stagger * 2).duration(motion.settle)}>
            <View
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, backgroundColor: s.done ? colors.okBg : colors.postcard, borderWidth: 1, borderColor: s.done ? 'rgba(94,107,69,0.35)' : colors.line, transform: [{ rotate: `${[-1.2, 0.8, -0.5][i]}deg` }] },
                shadow.soft,
              ]}
            >
              <Tick done={s.done} />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: s.done ? colors.ok : colors.muted }}>{s.label}</Text>
            </View>
          </Animated.View>
        ))}
      </View>

      <Spacer />
      <Button
        title={failed || blocked ? 'Try again' : 'Back to the windowsill'}
        onPress={() =>
          failed || blocked
            ? router.replace({ pathname: '/capture', params: { match: matchId } })
            : router.dismissTo('/today')
        }
      />
    </Screen>
  );
}
