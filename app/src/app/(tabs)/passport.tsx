// Passport: stamps you collect, and a "When I visit" plan built from places your partner showed you.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import Animated, { FadeInDown, Keyframe } from 'react-native-reanimated';
import { PaperGrain } from '@/components/materials';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Stamp } from '@/components/Stamp';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { Button, Ledger, T } from '@/components/ui';
import { getItinerary, getMatches, getWall } from '@/lib/data';
import { dayNumber } from '@/lib/time';
import { colors, fonts, motion, shadow } from '@/lib/theme';
import type { ItineraryStop, Match } from '@/lib/types';

const STAMP_COLORS = [colors.terracotta, colors.dusk, colors.hand, colors.walnut];
const TOTAL_STAMPS = 12;

type StampInfo = { label: string; sub?: string; color: string; textColor?: string };

// an ink stamp pressed onto the page
const press = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.35 }] },
  100: { opacity: 1, transform: [{ scale: 1 }] },
}).duration(220);

export default function Passport() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stamps, setStamps] = useState<StampInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [plan, setPlan] = useState<ItineraryStop[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // One pen pal at a time
        const ms = (await getMatches()).filter((m) => m.status !== 'ended').slice(0, 1);
        setMatches(ms);
        setSelected(ms[0]?.id ?? null);
        // Stamps are worked out from your windows: one per city with windows, plus milestones
        const walls = await Promise.all(ms.map((m) => getWall(m.id).catch(() => [])));
        const earned: StampInfo[] = [];
        ms.forEach((m, i) => {
          if (walls[i].length) earned.push({ label: m.city, sub: new Date(m.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(), color: STAMP_COLORS[i % STAMP_COLORS.length] });
        });
        if (walls.some((w) => w.length)) earned.push({ label: 'First window', color: colors.hand });
        if (ms.some((m) => dayNumber(m.created_at) >= 7)) earned.push({ label: '7 days', color: colors.light, textColor: colors.ink });
        if (walls.some((w) => w.length >= 10)) earned.push({ label: '10 windows', color: colors.dusk });
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
    <Screen scroll gap={18} padBottom={TAB_BAR_SPACE} edges={['top']} textured style={{ paddingHorizontal: 20 }}>
      <Ledger label="Passport" note={match ? `${match.city} · with ${p?.name}` : undefined} />

      {/* the stamps page of a worn passport */}
      <View style={[{ padding: 16, borderRadius: 4, backgroundColor: colors.postcard, gap: 14, overflow: 'hidden', borderLeftWidth: 10, borderLeftColor: colors.walnut }, shadow.card]}>
        <PaperGrain />
        {/* faint guilloche lines like a passport page */}
        {[0, 1, 2, 3].map((k) => (
          <View key={k} style={{ position: 'absolute', left: -40, right: -40, top: 30 + k * 34, height: 1, backgroundColor: 'rgba(111,123,87,0.12)', transform: [{ rotate: '-4deg' }] }} />
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="eyebrow">Visas &amp; stamps</T>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>{stamps.length} of {TOTAL_STAMPS}</Text>
        </View>
        {stamps.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {stamps.map((s, i) => (
              <Animated.View key={s.label} entering={press.delay(300 + i * 160)}>
                <Stamp label={s.label} sub={s.sub} color={s.color} textColor={s.textColor} width={72} height={80} tilt={[-3, 2, -1, 3][i % 4]} edgeColor={colors.postcard} />
              </Animated.View>
            ))}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>Your first stamp arrives with your first window.</Text>
        )}
      </View>

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
            // a folded itinerary sheet
            <View style={[{ backgroundColor: colors.postcard, borderRadius: 2, padding: 16, gap: 12, overflow: 'hidden', transform: [{ rotate: '-0.5deg' }] }, shadow.card]}>
              <View style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: 'rgba(110,68,41,0.14)' }} />
              {plan.map((s, i) => (
                <Animated.View key={`${s.place}-${i}`} entering={FadeInDown.delay(i * motion.stagger).duration(motion.settle)} style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={{ width: 46, fontFamily: fonts.displayItalic, fontSize: 15, color: colors.terracotta }}>Day {s.day}</Text>
                  <View style={{ flex: 1, paddingBottom: 10, borderBottomWidth: i < plan.length - 1 ? 1 : 0, borderBottomColor: colors.line, borderStyle: 'dashed' }}>
                    <T style={{ fontFamily: fonts.semibold }}>{s.place}</T>
                    <T variant="hand" style={{ fontSize: 21, lineHeight: 23 }}>{s.tip}</T>
                  </View>
                </Animated.View>
              ))}
              <Button variant="outline" title={`Share my ${match.city} plan`} onPress={share} style={{ marginTop: 2 }} />
            </View>
          ) : (
            <T variant="muted">Save a few of {p?.name}&apos;s windows and your plan will build itself here.</T>
          )}
        </>
      ) : null}
    </Screen>
  );
}
