// Today (home): the daily ritual. One glance tells you if their window arrived.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Arch } from '@/components/Arch';
import { CityScene } from '@/components/CityScene';
import { SkyCard } from '@/components/SkyCard';
import { KnockPad } from '@/components/KnockPad';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { CameraIcon, SunIcon } from '@/components/Icons';
import { Button, T } from '@/components/ui';
import { getMatches, getToday } from '@/lib/data';
import { useInbox } from '@/lib/inbox';
import { useSession } from '@/lib/session';
import { openedWindows } from '@/lib/seen';
import { dayNumber, hourIn, longDate, timeAgo } from '@/lib/time';
import { colors, fonts, radius } from '@/lib/theme';
import type { Match, WindowItem } from '@/lib/types';

type TodayState = { theirs?: WindowItem; mine?: WindowItem; sentToday: boolean };

export default function Today() {
  const { profile } = useSession();
  const { version } = useInbox();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [today, setToday] = useState<Record<string, TodayState>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const ms = (await getMatches()).filter((m) => m.status === 'active');
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
  const others = matches?.slice(1) ?? [];
  const t = main ? today[main.id] : undefined;

  return (
    <Screen
      scroll
      gap={18}
      padBottom={TAB_BAR_SPACE}
      edges={['top']}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dusk} />}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View>
          <T variant="small" style={{ fontSize: 14 }}>{longDate(tz)}</T>
          <T variant="display">Today</T>
        </View>
        {main ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.honey }}>
            <SunIcon />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.honeyText }}>
              Day {dayNumber(main.created_at)} with {main.partner.name}
            </Text>
          </View>
        ) : null}
      </View>

      {matches && !main ? (
        <View style={{ gap: 14, paddingVertical: 30, alignItems: 'center' }}>
          <T variant="heading" style={{ textAlign: 'center' }}>Your windows are on their way</T>
          <T variant="muted" style={{ textAlign: 'center' }}>We&apos;re still looking for someone in your dream cities.</T>
          <Button title="Look again" onPress={() => router.push('/matching')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}

      {main ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TheirWindow match={main} w={t?.theirs} />
            <YourWindow match={main} mine={t?.mine} sent={!!t?.sentToday} />
          </View>
          <KnockPad partner={main.partner} />
          <SkyCard person={main.partner} />
        </>
      ) : null}

      {others.length ? (
        <View style={{ gap: 10 }}>
          <T variant="label" style={{ color: colors.muted }}>Your other windows</T>
          {others.map((m, i) => (
            <OtherRow key={m.id} match={m} state={today[m.id]} color={['#F4D27A', '#3F477F', '#D9573F'][i % 3]} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const CARD_H = 230;

function TheirWindow({ match, w }: { match: Match; w?: WindowItem }) {
  const [boxW, setBoxW] = useState(0);
  const isNew = !!w && !openedWindows.has(w.id);
  const frost = useSharedValue(1);
  const frostStyle = useAnimatedStyle(() => ({ opacity: frost.value }));

  useEffect(() => {
    // The frosted glass clears when their window has arrived
    frost.value = w ? withDelay(300, withTiming(0, { duration: 900 })) : 1;
  }, [w, frost]);

  return (
    <Pressable
      style={{ flex: 1, gap: 8 }}
      disabled={!w}
      onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
      onPress={() => {
        if (!w) return;
        openedWindows.add(w.id);
        router.push({ pathname: '/window/[id]', params: { id: w.id } });
      }}
    >
      {boxW ? (
        <Arch width={boxW} height={CARD_H} border={6} bottomRadius={16}>
          {w ? <Image source={{ uri: w.photo_url }} style={{ flex: 1 }} contentFit="cover" transition={300} /> : <CityScene id="their" />}
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: 0 }, frostStyle]}>
            <BlurView intensity={40} tint="light" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {!w ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink, textAlign: 'center', paddingHorizontal: 12 }}>On its way…</Text> : null}
            </BlurView>
          </Animated.View>
          {isNew ? (
            <Animated.View entering={FadeIn.delay(900)} style={{ position: 'absolute', left: 8, top: 64, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.light }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.ink }}>New</Text>
            </Animated.View>
          ) : null}
        </Arch>
      ) : (
        <View style={{ height: CARD_H }} />
      )}
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{match.partner.name}&apos;s window</Text>
      <T variant="small" style={{ marginTop: -6 }}>
        {w ? `${match.partner.home_city} · ${timeAgo(w.created_at)}` : `${match.partner.home_city} · not sent yet`}
      </T>
    </Pressable>
  );
}

function YourWindow({ match, mine, sent }: { match: Match; mine?: WindowItem; sent: boolean }) {
  const [boxW, setBoxW] = useState(0);
  return (
    <Pressable
      style={{ flex: 1, gap: 8 }}
      onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}
      disabled={sent}
      onPress={() => router.push({ pathname: '/capture', params: { match: match.id } })}
    >
      {boxW ? (
        <Arch width={boxW} height={CARD_H} border={6} bottomRadius={16} lifted={!!mine}>
          {mine ? (
            <Image source={{ uri: mine.photo_url }} style={{ flex: 1 }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#C9D2EA', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, marginLeft: -2.5, backgroundColor: colors.postcard }} />
              <View style={{ position: 'absolute', left: 0, right: 0, top: '46%', height: 5, backgroundColor: colors.postcard }} />
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.postcard, alignItems: 'center', justifyContent: 'center' }}>
                <CameraIcon />
              </View>
            </View>
          )}
        </Arch>
      ) : (
        <View style={{ height: CARD_H }} />
      )}
      <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Your window</Text>
      <T variant="small" style={{ marginTop: -6 }}>{sent ? 'Sent today ✓' : 'Not sent yet · tap to open'}</T>
    </Pressable>
  );
}

function OtherRow({ match, state, color }: { match: Match; state?: TodayState; color: string }) {
  const p = match.partner;
  const asleep = hourIn(p.tz) >= 23 || hourIn(p.tz) < 7;
  const status = state?.theirs && state.sentToday
    ? 'You both sent today'
    : state?.theirs
      ? 'New window · tap to open'
      : asleep
        ? `Asleep · it's ${hourIn(p.tz) < 7 ? 'early morning' : 'late'} in ${p.home_city}`
        : 'Their window hasn\'t arrived yet';
  return (
    <Pressable
      onPress={() =>
        state?.theirs
          ? router.push({ pathname: '/window/[id]', params: { id: state.theirs.id } })
          : router.push({ pathname: '/capture', params: { match: match.id } })
      }
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.white },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={{ width: 44, height: 52, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: color, overflow: 'hidden' }}>
        {state?.theirs ? <Image source={{ uri: state.theirs.photo_url }} style={{ flex: 1 }} contentFit="cover" /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: fonts.semibold }}>{p.name} · {p.home_city}</T>
        <T variant="small">{status}</T>
      </View>
    </Pressable>
  );
}
