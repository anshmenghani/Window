// Today: a windowsill. Their window, large; yours, smaller, waiting beside it.
// Below: today's shared prompt and a paper strip showing their sky right now.
// (Knocks only come from the physical windows; when one arrives, the crane hops and their window rattles.)
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInRight, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { CityScene } from '@/components/CityScene';
import { SkyCard } from '@/components/SkyCard';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { CameraIcon } from '@/components/Icons';
import { Crane } from '@/components/Crane';
import { Curtains, SillPlant, Wallpaper } from '@/components/Cozy';
import { COZY } from '@/lib/config';
import { Wood } from '@/components/materials';
import { Button, Ledger, T } from '@/components/ui';
import { getMatches, getToday, getTodayPrompt } from '@/lib/data';
import { PromptSlip } from '@/components/PromptSlip';
import { useInbox } from '@/lib/inbox';
import { useSession } from '@/lib/session';
import { openedWindows } from '@/lib/seen';
import { dayNumber, hourIn, longDate, timeAgo, timeIn } from '@/lib/time';
import { colors, fonts, gutter, motion, shadow } from '@/lib/theme';
import type { DailyPrompt, Match, WindowItem } from '@/lib/types';

type TodayState = { theirs?: WindowItem; mine?: WindowItem; sentToday: boolean };

export default function Today() {
  const { profile } = useSession();
  const { version, knocks } = useInbox();
  const [cranePulse, setCranePulse] = useState(0);
  const [rattle, setRattle] = useState(0); // their window rattles in its frame when they knock
  const [wallTo, setWallTo] = useState(0); // where the wall ends and the sill begins
  const { width: screenW } = useWindowDimensions();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [today, setToday] = useState<Record<string, TodayState>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [prompt, setPrompt] = useState<DailyPrompt | null>(null);

  const load = useCallback(async () => {
    // One pen pal at a time: the (single) current match, active or paused
    const ms = (await getMatches()).filter((m) => m.status !== 'ended').slice(0, 1);
    setMatches(ms);
    const entries = await Promise.all(ms.map(async (m) => [m.id, await getToday(m.id)] as const));
    setToday(Object.fromEntries(entries));
    // today's shared prompt is a bonus: if it can't load, Today still works
    setPrompt(ms[0] ? await getTodayPrompt(ms[0].id).catch(() => null) : null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => {});
    }, [load]),
  );
  useEffect(() => {
    if (version) load().catch(() => {});
  }, [version, load]);
  // someone knocked on your window: the crane on the sill startles
  useEffect(() => {
    if (!knocks) return;
    setCranePulse((n) => n + 1);
    setRattle((n) => n + 1);
  }, [knocks]);

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
  const craneSize = 80;
  const craneLeft = Math.round((bigW + inner - smallW) / 2 - craneSize / 2);
  const fresh = !!t?.theirs && !openedWindows.has(t.theirs.id);

  return (
    <Screen
      scroll
      gap={18}
      padBottom={TAB_BAR_SPACE}
      edges={['top']}
      textured
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.walnut} />}
    >
      {/* the room: date, greeting and the two windows, with wallpaper on the wall behind them */}
      <View style={{ gap: 18 }}>
        {COZY.wallpaper && main && wallTo ? (
          <Wallpaper style={{ top: -12, left: -gutter, right: -gutter, height: wallTo + 12 }} />
        ) : null}
        <Ledger label={longDate(tz)} note={main ? `Day ${dayNumber(main.created_at)} with ${main.partner.name}` : undefined} />
        {profile ? (
          <View style={{ gap: 2, marginTop: -4 }}>
            <T variant="heading">{greeting(hourIn(tz))}, {profile.name}.</T>
            {main ? (
              <T variant="small" style={{ fontSize: 14 }}>
                It&apos;s {timeIn(main.partner.tz)} in {main.partner.home_city}.
                {fresh ? ` ${main.partner.name} left you a window.` : t?.sentToday ? ` Your window is on its way to ${main.partner.name}.` : ''}
              </T>
            ) : null}
          </View>
        ) : null}

        {main?.status === 'paused' ? (
          <T style={{ fontSize: 14, color: colors.walnut, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: colors.walnut }}>
            Your window with {main.partner.name} is paused. Resume it from the You tab.
          </T>
        ) : null}

        {main ? (
          <View
            onLayout={(e) => setWallTo(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
            style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 4 }}
          >
            <TheirWindow match={main} w={t?.theirs} width={bigW} rattle={rattle} />
            <YourWindow match={main} mine={t?.mine} sent={!!t?.sentToday} width={smallW} />
            {/* the paper crane that carries your letters, resting on the sill between the windows */}
            {COZY.crane ? (
              <Pressable
                accessibilityLabel="The paper crane that carries your windows"
                onPress={() => setCranePulse((n) => n + 1)}
                hitSlop={6}
                style={{ position: 'absolute', left: craneLeft, bottom: -Math.round(craneSize * 0.8 * 0.27) }}
              >
                <Crane size={craneSize} mood={fresh ? 'alert' : 'rest'} pulse={cranePulse} />
              </Pressable>
            ) : null}
            {/* a leaf for every day you've been pen pals */}
            {COZY.plant ? (
              <View style={{ position: 'absolute', right: -10, bottom: -12 }}>
                <SillPlant days={dayNumber(main.created_at)} size={60} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {matches && !main ? (
        <View style={{ gap: 14, paddingVertical: 30, alignItems: 'center' }}>
          {COZY.crane ? <Crane size={64} mood="rest" /> : null}
          <T variant="heading" style={{ textAlign: 'center' }}>No pen pal yet</T>
          <T variant="muted" style={{ textAlign: 'center' }}>Your crane is still looking for someone in your dream cities.</T>
          <Button title="Look again" onPress={() => router.push('/matching')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}

      {main ? (
        <>
          {/* the sill itself, and the museum labels under each window */}
          <View style={{ marginTop: -18 }}>
            <View style={[{ height: 14, marginHorizontal: -8, borderRadius: 3, overflow: 'hidden' }, shadow.card]}>
              <Wood />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginTop: 10 }}>
              <MuseumLabel
                title={`${main.partner.name}'s window`}
                sub={t?.theirs ? `${main.partner.home_city} · left ${timeAgo(t.theirs.created_at)}` : `${main.partner.home_city} · on its way`}
              />
              <MuseumLabel align="right" title="Your window" sub={t?.sentToday ? 'sent today ✓' : 'not sent yet'} />
            </View>
          </View>

          {prompt ? (
            <PromptSlip
              prompt={prompt}
              partnerName={main.partner.name}
              onAnswer={() => router.push({ pathname: '/capture', params: { match: main.id, prompt: prompt.id } })}
            />
          ) : null}

          <SkyCard person={main.partner} />
        </>
      ) : null}
    </Screen>
  );
}

function greeting(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Up late';
}

function MuseumLabel({ title, sub, align = 'left' }: { title: string; sub: string; align?: 'left' | 'right' }) {
  return (
    <View style={{ alignItems: align === 'left' ? 'flex-start' : 'flex-end', maxWidth: '58%' }}>
      <Text style={{ fontFamily: fonts.display, fontSize: 15, color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted }}>{sub}</Text>
    </View>
  );
}

function TheirWindow({ match, w, width, rattle }: { match: Match; w?: WindowItem; width: number; rattle: number }) {
  const height = Math.round(width * 1.32);
  const isNew = !!w && !openedWindows.has(w.id);
  const frost = useSharedValue(1);
  const frostStyle = useAnimatedStyle(() => ({ opacity: frost.value, transform: [{ scale: 1 + (1 - frost.value) * 0.12 }] }));
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { rotate: `${shake.value * 0.25}deg` }] }));
  useEffect(() => {
    if (!rattle) return;
    shake.value = withSequence(
      withTiming(-3, { duration: 45 }), withTiming(3, { duration: 55 }), withTiming(-2, { duration: 55 }),
      withTiming(1.5, { duration: 55 }), withTiming(0, { duration: 60 }),
    );
  }, [rattle, shake]);

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
      <Animated.View style={shakeStyle}>
      <Arch width={width} height={height} border={9} bottomRadius={4} glass>
        {w ? <Image source={{ uri: w.photo_url }} style={{ flex: 1 }} contentFit="cover" transition={300} /> : <CityScene id="their" where={match.partner} bike={false} />}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, frostStyle]}>
          <BlurView intensity={45} tint="light" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['rgba(255,249,237,0.35)', 'rgba(255,249,237,0.1)']} style={{ position: 'absolute', inset: 0 }} />
            {!w ? <Text style={{ fontFamily: fonts.hand, fontSize: 22, color: colors.hand, textAlign: 'center', paddingHorizontal: 12 }}>on its way…</Text> : null}
          </BlurView>
        </Animated.View>
        {/* gingham curtains: drawn while you wait, tied back once their window arrives */}
        {COZY.curtains ? <Curtains open={!!w} width={width - 18} height={height - 18} /> : null}
      </Arch>
      </Animated.View>
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
