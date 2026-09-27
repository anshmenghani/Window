// Match reveal: the "aww" moment. A postcard flips in with your new window partner.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
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
import { colors, fonts, motion, shadow } from '@/lib/theme';
import { PaperGrain } from '@/components/materials';
import type { Match } from '@/lib/types';

export default function MatchReveal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useSession();
  const [match, setMatch] = useState<Match | null>(null);

  // The postcard slides in from just off-screen and settles at a slight angle; then it's stamped.
  const slide = useSharedValue(1);
  const stampIn = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.value * 440 }, { rotate: `${-1.5 + slide.value * 8}deg` }],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: stampIn.value,
    transform: [{ scale: 1.6 - stampIn.value * 0.6 }],
  }));

  useEffect(() => {
    getMatches().then((ms) => {
      const m = ms.find((x) => x.id === id) ?? ms[0] ?? null;
      setMatch(m);
      slide.value = withDelay(200, withSpring(0, { damping: 20, stiffness: 120, mass: 1 }));
      stampIn.value = withDelay(950, withTiming(1, { duration: motion.press + 60 }));
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 1050);
    });
  }, [id, slide, stampIn]);

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
      <T variant="eyebrow" style={{ textAlign: 'center', fontSize: 12, color: colors.muted }}>A letter arrived</T>

      <Animated.View style={[{ borderRadius: 4, backgroundColor: colors.postcard, overflow: 'hidden' }, shadow.card, cardStyle]}>
        <PaperGrain />
        {/* airmail edge */}
        <View style={{ flexDirection: 'row', height: 7, overflow: 'hidden' }}>
          {Array.from({ length: 30 }, (_, i) => (
            <View key={i} style={{ width: 14, height: 7, marginRight: 4, backgroundColor: i % 2 ? colors.sky : colors.terracotta, transform: [{ skewX: '-35deg' }] }} />
          ))}
        </View>
        <View style={{ padding: 20, gap: 14 }}>
          <Animated.View style={[{ position: 'absolute', right: 16, top: 14 }, stampStyle]}>
            <Stamp label={p.home_city || match.city} sub={p.country} color={colors.terracotta} edgeColor={colors.postcard} tilt={4}>
              <Svg width={36} height={38} viewBox="0 0 40 42" fill="none" stroke={colors.postcard} strokeWidth={1.8}>
                <Path d="M8 12h24M11 12l-3 5h24l-3-5M12 17v8M28 17v8M6 25h28M10 25l-3 5h26l-3-5M13 30v10M27 30v10" />
              </Svg>
            </Stamp>
          </Animated.View>
          <Animated.View
            style={[
              {
                position: 'absolute', right: 58, top: 72, width: 66, height: 66, borderRadius: 33, borderWidth: 1.5,
                borderColor: 'rgba(46,42,38,0.35)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-14deg' }],
              },
              { opacity: 0.9 },
              stampStyle,
            ]}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.7, color: 'rgba(46,42,38,0.5)', textAlign: 'center' }}>{postmark}</Text>
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 90 }}>
            {/* printed monogram */}
            <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: colors.terracotta, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: 29, borderWidth: 0.8, borderColor: 'rgba(185,88,61,0.5)' }} />
              <Text style={{ fontFamily: fonts.displayItalic, fontSize: 28, color: colors.terracotta }}>{p.name[0]}</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>{p.name}</Text>
              <T variant="small" style={{ fontSize: 14 }}>{p.home_city}, {p.country}</T>
              {p.location_verified ? (
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.ok, marginTop: 2 }}>✓ VERIFIED LOCAL</Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingRight: 70 }}>
            {tags.map((t) => <Tag key={t} label={t} />)}
          </View>

          <T variant="hand" style={{ fontSize: 25, lineHeight: 29 }}>{match.reason}</T>
          <View style={{ height: 1, backgroundColor: colors.line }} />
          {/* museum-label details */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted }}>
              local time <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{timeIn(p.tz)}</Text> · {aheadText(profile.tz, p.tz)}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.7, textTransform: 'uppercase', color: colors.muted }}>
              speaks {languageName(p.languages[0])}
            </Text>
          </View>
        </View>
      </Animated.View>

      <T variant="muted" style={{ textAlign: 'center', fontSize: 14 }}>
        Everything you send is translated both ways, so language is never a wall.
      </T>

      <Spacer />
      <View style={{ gap: 2 }}>
        <Button title="Write back with your first window" onPress={() => router.replace({ pathname: '/capture', params: { match: match.id } })} />
        <Button variant="ghost" title="Later" onPress={() => router.replace('/today')} />
        <T variant="small" style={{ textAlign: 'center', fontSize: 12 }}>You can pause or leave a window anytime.</T>
      </View>
    </Screen>
  );
}
