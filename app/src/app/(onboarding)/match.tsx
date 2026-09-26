// Match reveal: the "aww" moment. A postcard flips in with your new window partner.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Stamp } from '@/components/Stamp';
import { Button, T, Tag } from '@/components/ui';
import { getMatches } from '@/lib/data';
import { useSession } from '@/lib/session';
import { languageName } from '@/lib/cities';
import { aheadText, timeIn } from '@/lib/time';
import { colors, fonts, radius, shadow } from '@/lib/theme';
import type { Match } from '@/lib/types';

export default function MatchReveal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [match, setMatch] = useState<Match | null>(null);

  const flip = useSharedValue(90);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${flip.value}deg` }, { rotate: '-1.5deg' }],
    opacity: flip.value > 80 ? 0 : 1,
  }));

  useEffect(() => {
    getMatches().then((ms) => {
      const m = ms.find((x) => x.id === id) ?? ms[0] ?? null;
      setMatch(m);
      flip.value = withDelay(250, withSpring(0, { damping: 14, stiffness: 90 }));
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 500);
    });
  }, [id, flip]);

  if (!match || !profile) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.dusk} />
      </Screen>
    );
  }

  const p = match.partner;
  const shared = p.interests.filter((i) => profile.interests.includes(i));
  const tags = (shared.length ? shared : p.interests).slice(0, 3);
  const date = new Date(match.created_at);
  const postmark = `${date.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${date.getDate()}\n${date.getFullYear()}`;

  return (
    <Screen gap={22} style={{ paddingHorizontal: 24, paddingTop: 24 }}>
      <T variant="eyebrow" style={{ textAlign: 'center', fontSize: 13 }}>You have a new window</T>

      <Animated.View style={[{ padding: 22, borderRadius: radius.lg, backgroundColor: colors.postcard, gap: 16 }, shadow.card, cardStyle]}>
        <View style={{ position: 'absolute', right: 18, top: 18 }}>
          <Stamp label={match.city}>
            <Svg width={40} height={42} viewBox="0 0 40 42" fill="none" stroke={colors.postcard} strokeWidth={1.8}>
              <Path d="M8 12h24M11 12l-3 5h24l-3-5M12 17v8M28 17v8M6 25h28M10 25l-3 5h26l-3-5M13 30v10M27 30v10" />
            </Svg>
          </Stamp>
        </View>
        <View
          style={{
            position: 'absolute', right: 12, top: 100, width: 66, height: 66, borderRadius: 33, borderWidth: 2,
            borderColor: 'rgba(29,34,64,0.35)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-14deg' }],
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7, color: 'rgba(29,34,64,0.5)', textAlign: 'center' }}>{postmark}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink }}>{p.name[0]}</Text>
          </View>
          <View>
            <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>{p.name}</Text>
            <T variant="small" style={{ fontSize: 14 }}>{p.home_city}, {p.country}</T>
            {p.location_verified ? (
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.ok, marginTop: 2 }}>✓ Verified local</Text>
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingRight: 80 }}>
          {tags.map((t) => <Tag key={t} label={t} />)}
        </View>

        <T variant="hand" style={{ fontSize: 25, lineHeight: 29 }}>{match.reason}</T>
        <View style={{ height: 1, backgroundColor: '#E3E6EF' }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <T variant="small">
            {p.name}&apos;s time: <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{timeIn(p.tz)}</Text> · {aheadText(profile.tz, p.tz)}
          </T>
          <T variant="small">Speaks {languageName(p.languages[0])}</T>
        </View>
      </Animated.View>

      <T variant="muted" style={{ textAlign: 'center', fontSize: 14 }}>
        Everything you send is translated both ways, so language is never a wall.
      </T>

      <Spacer />
      <View style={{ gap: 4 }}>
        <Button title="Say hello with your first window" onPress={() => router.replace({ pathname: '/capture', params: { match: match.id } })} />
        <Button variant="ghost" title="Later" onPress={() => router.replace('/today')} />
        <T variant="small" style={{ textAlign: 'center', fontSize: 12 }}>You can pause or leave a window anytime.</T>
      </View>
    </Screen>
  );
}
