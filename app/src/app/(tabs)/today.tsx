// Today: a windowsill. Their window, large; yours, smaller, waiting beside it.
// Below: the knock rail and a paper strip showing their sky right now.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInRight, useAnimatedStyle, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { CityScene } from '@/components/CityScene';
import { SkyCard } from '@/components/SkyCard';
import { KnockPad } from '@/components/KnockPad';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { CameraIcon } from '@/components/Icons';
import { Wood } from '@/components/materials';
import { Button, Ledger, T } from '@/components/ui';
import { getMatches, getToday } from '@/lib/data';
import { useInbox } from '@/lib/inbox';
import { useSession } from '@/lib/session';
import { openedWindows } from '@/lib/seen';
import { dayNumber, longDate, timeAgo } from '@/lib/time';
import { colors, fonts, gutter, motion, shadow } from '@/lib/theme';
import type { Match, WindowItem } from '@/lib/types';

type TodayState = { theirs?: WindowItem; mine?: WindowItem; sentToday: boolean };

export default function Today() {
  const { profile } = useSession();
  const { version } = useInbox();
  const { width: screenW } = useWindowDimensions();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [today, setToday] = useState<Record<string, TodayState>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // One pen pal at a time: the (single) current match, active or paused
    const ms = (await getMatches()).filter((m) => m.status !== 'ended').slice(0, 1);
    setMatches(ms);
    const entries = await Promise.all(ms.map(async (m) => [m.id, await getToday(m.id)] as const));
    setToday(Object.fromEntries(entries));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );
  useEffect(() => {
    if (version) load().catch(() => {});
  }, [version, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const tz = profile?.tz ?? 'America/New_York';
  const main = matches?.[0];
  const t = main ? today[main.id] : undefined;

  // windowsill geometry
  const inner = screenW - gutter * 2;
  const bigW = Math.round(inner * 0.6);
  const smallW = Math.round(inner * 0.34);

  return (
    <Screen
      scroll
      gap={18}
      padBottom={TAB_BAR_SPACE}
      edges={['top']}
      textured
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.walnut} />}
    >
      <Ledger label={longDate(tz)} note={main ? `Day ${dayNumber(main.created_at)} with ${main.partner.name}` : undefined} />

      {matches && !main ? (
        <View style={{ gap: 14, paddingVertical: 30, alignItems: 'center' }}>
          <T variant="heading" style={{ textAlign: 'center' }}>Your window is on its way</T>
          <T variant="muted" style={{ textAlign: 'center' }}>We&apos;re still looking for someone in your dream cities.</T>
          <Button title="Look again" onPress={() => router.push('/matching')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}

      {main?.status === 'paused' ? (
        <T style={{ fontSize: 14, color: colors.walnut, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.walnut }}>
          Your window with {main.partner.name} is paused. Resume it from the You tab.
        </T>
      ) : null}

      {main ? (
        <>
          {/* the windowsill */}
          <View style={{ marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 6 }}>
              <TheirWindow match={main} w={t?.theirs} width={bigW} />
              <YourWindow match={main} mine={t?.mine} sent={!!t?.sentToday} width={smallW} />
            </View>
            <View style={[{ height: 14, marginHorizontal: -8, borderRadius: 3, overflow: 'hidden' }, shadow.card]}>
              <Wood />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 10 }}>
              <MuseumLabel
                title={`${main.partner.name}'s window`}
                sub={t?.theirs ? `${main.partner.home_city} · ${timeAgo(t.theirs.created_at)}` : `${main.partner.home_city} · on its way`}
              />
              <MuseumLabel align="right" title="Your window" sub={t?.sentToday ? 'sent today ✓' : 'not sent yet'} />
            </View>
          </View>

          <KnockPad partner={main.partner} />
          <SkyCard person={main.partner} />
        </>
      ) : null}
    </Screen>
  );
}

function MuseumLabel({ title, sub, align = 'left' }: { title: string; sub: string; align?: 'left' | 'right' }) {
  return (
    <View style={{ alignItems: align === 'left' ? 'flex-start' : 'flex-end', maxWidth: '58%' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 15, color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted }}>{sub}</Text>
    </View>
  );
}

function TheirWindow({ match, w, width }: { match: Match; w?: WindowItem; width: number }) {
  const height = Math.round(width * 1.32);
  const isNew = !!w && !openedWindows.has(w.id);
  const frost = useSharedValue(1);
  const frostStyle = useAnimatedStyle(() => ({ opacity: frost.value, transform: [{ scale: 1 + (1 - frost.value) * 0.12 }] }));

  useEffect(() => {
    // Condensation clears from the glass when their window has arrived
    frost.value = w ? withDelay(250, withTiming(0, { duration: 900, easing: Easing.out(Easing.quad) })) : 1;
  }, [w, frost]);

  return (
    <Pressable
      disabled={!w}
      accessibilityLabel={w ? `Open ${match.partner.name}'s window` : `${match.partner.name}'s window hasn't arrived yet`}
      onPress={() => {
        if (!w) return;
        openedWindows.add(w.id);
        router.push({ pathname: '/window/[id]', params: { id: w.id } });
      }}
    >
      <Arch width={width} height={height} border={9} bottomRadius={4} glass>
        {w ? <Image source={{ uri: w.photo_url }} style={{ flex: 1 }} contentFit="cover" transition={300} /> : <CityScene id="their" where={match.partner} bike={false} />}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, frostStyle]}>
          <BlurView intensity={45} tint="light" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['rgba(255,249,237,0.35)', 'rgba(255,249,237,0.1)']} style={{ position: 'absolute', inset: 0 }} />
            {!w ? <Text style={{ fontFamily: fonts.hand, fontSize: 22, color: colors.hand, textAlign: 'center', paddingHorizontal: 12 }}>on its way…</Text> : null}
          </BlurView>
        </Animated.View>
      </Arch>
      {isNew ? (
        <Animated.View entering={SlideInRight.delay(1100).duration(motion.settle)} style={{ position: 'absolute', right: -10, top: height * 0.34 }}>
          <View style={[{ paddingVertical: 4, paddingHorizontal: 10, backgroundColor: colors.terracotta, transform: [{ rotate: '4deg' }] }, shadow.soft]}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.postcard }}>NEW</Text>
          </View>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function YourWindow({ match, mine, sent, width }: { match: Match; mine?: WindowItem; sent: boolean; width: number }) {
  const height = Math.round(width * 1.32);
  return (
    <Pressable
      disabled={sent}
      accessibilityLabel={sent ? 'Your window was sent today' : 'Take today\'s window'}
      onPress={() => router.push({ pathname: '/capture', params: { match: match.id } })}
    >
      <Arch width={width} height={height} border={7} bottomRadius={4} bars={!mine} barWidth={4} glass>
        {mine ? (
          <Image source={{ uri: mine.photo_url }} style={{ flex: 1 }} contentFit="cover" />
        ) : (
          <LinearGradient colors={['#E9DDC5', '#D8C6A4']} style={{ flex: 1 }} />
        )}
      </Arch>
      {!mine ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: height * 0.46 - 22, alignItems: 'center' }}>
          <View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.postcard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line }, shadow.soft]}>
            <CameraIcon size={22} color={colors.walnut} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}
