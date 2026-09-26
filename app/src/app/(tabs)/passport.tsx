// Passport: stamps you collect, and a "When I visit" plan built from places your partner showed you.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Stamp } from '@/components/Stamp';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { Button, Chip, T } from '@/components/ui';
import { getItinerary, getMatches, getWall } from '@/lib/data';
import { dayNumber } from '@/lib/time';
import { colors, fonts, radius } from '@/lib/theme';
import type { ItineraryStop, Match } from '@/lib/types';

const STAMP_COLORS = [colors.dusk, colors.lantern, '#2F3570', '#1F7A45', '#8A5A08'];
const TOTAL_STAMPS = 12;

type StampInfo = { label: string; color: string; textColor?: string };

export default function Passport() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stamps, setStamps] = useState<StampInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [plan, setPlan] = useState<ItineraryStop[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const ms = (await getMatches()).filter((m) => m.status !== 'ended');
        setMatches(ms);
        setSelected((s) => s ?? ms[0]?.id ?? null);
        // Stamps are worked out from your windows: one per city with windows, plus milestones
        const walls = await Promise.all(ms.map((m) => getWall(m.id).catch(() => [])));
        const earned: StampInfo[] = [];
        ms.forEach((m, i) => {
          if (walls[i].length) earned.push({ label: m.city, color: STAMP_COLORS[i % STAMP_COLORS.length] });
        });
        if (walls.some((w) => w.length)) earned.push({ label: 'First window', color: colors.hand });
        if (ms.some((m) => dayNumber(m.created_at) >= 7)) earned.push({ label: '7 days', color: colors.light, textColor: colors.ink });
        if (walls.some((w) => w.length >= 10)) earned.push({ label: '10 windows', color: colors.lantern });
        setStamps(earned);
      })().catch(() => {});
    }, []),
  );

  useEffect(() => {
    if (!selected) return;
    setLoadingPlan(true);
    setPlan(null);
    getItinerary(selected)
      .then(setPlan)
      .catch(() => setPlan([]))
      .finally(() => setLoadingPlan(false));
  }, [selected]);

  const match = matches.find((m) => m.id === selected);
  const p = match?.partner;

  const share = () => {
    if (!plan || !match) return;
    const lines = plan.map((s) => `Day ${s.day}: ${s.place} — "${s.tip}"`).join('\n');
    Share.share({ message: `When I visit ${match.city} (built from ${p?.name}'s windows on Window)\n\n${lines}` });
  };

  return (
    <Screen scroll gap={16} padBottom={TAB_BAR_SPACE} edges={['top']} style={{ paddingHorizontal: 20 }}>
      <T variant="display">Passport</T>

      <View style={{ padding: 16, borderRadius: 20, backgroundColor: colors.ink, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.nightMuted }}>Stamps collected</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.nightMuted }}>{stamps.length} of {TOTAL_STAMPS}</Text>
        </View>
        {stamps.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {stamps.map((s, i) => (
              <Animated.View key={s.label} entering={FadeInDown.delay(i * 90).springify()}>
                <Stamp label={s.label} color={s.color} textColor={s.textColor} width={70} height={76} tilt={[-3, 2, -1, 3][i % 4]} />
              </Animated.View>
            ))}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.nightSoft }}>Your first stamp arrives with your first window.</Text>
        )}
      </View>

      {matches.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {matches.map((m) => (
            <Chip key={m.id} small label={m.city} selected={m.id === selected} onPress={() => setSelected(m.id)} />
          ))}
        </ScrollView>
      ) : null}

      {match ? (
        <>
          <View>
            <T variant="heading">When I visit {match.city}</T>
            <T variant="small">Built from places {p?.name} showed you</T>
          </View>
          {loadingPlan ? (
            <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={colors.dusk} />
              <T variant="small">Planning your trip from {p?.name}&apos;s windows…</T>
            </View>
          ) : plan && plan.length ? (
            <View style={{ gap: 10 }}>
              {plan.map((s, i) => (
                <Animated.View
                  key={`${s.place}-${i}`}
                  entering={FadeInDown.delay(i * 80)}
                  style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.white }}
                >
                  <Text style={{ width: 48, fontFamily: fonts.display, color: colors.dusk }}>Day {s.day}</Text>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: fonts.semibold }}>{s.place}</T>
                    <T variant="hand" style={{ fontSize: 20, lineHeight: 23 }}>{s.tip}</T>
                  </View>
                </Animated.View>
              ))}
              <Button variant="outline" title={`Share my ${match.city} plan`} onPress={share} style={{ marginTop: 4 }} />
            </View>
          ) : (
            <T variant="muted">Save a few of {p?.name}&apos;s windows and your plan will build itself here.</T>
          )}
        </>
      ) : null}
    </Screen>
  );
}
