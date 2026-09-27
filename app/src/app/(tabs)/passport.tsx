// Passport: how close you've become, stamps that mark real moments in your letters,
// and a "When I visit" plan built from places your partner showed you.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import Animated, { FadeInDown, Keyframe } from 'react-native-reanimated';
import { PaperGrain } from '@/components/materials';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Stamp } from '@/components/Stamp';
import { TAB_BAR_SPACE } from '@/components/TabBar';
import { Button, Ledger, T } from '@/components/ui';
import { getBond, getItinerary, getMatches, getStamps } from '@/lib/data';
import { Crane } from '@/components/Crane';
import { COZY } from '@/lib/config';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, fonts, motion, shadow } from '@/lib/theme';
import type { Bond, ItineraryStop, Match, MemoryStamp } from '@/lib/types';

// each kind of moment gets its own ink
const INK: Record<MemoryStamp['kind'], { color: string; text?: string }> = {
  together: { color: colors.terracotta },
  place: { color: colors.dusk },
  first: { color: colors.hand },
  voice: { color: colors.walnut },
  moment: { color: colors.light, text: colors.ink },
};

/** A tiny engraved mark on each stamp: two cups, a pin, an envelope, a voice, a star. */
function StampMark({ kind, color }: { kind: MemoryStamp['kind']; color: string }) {
  return (
    <Svg width={24} height={20} viewBox="0 0 24 20" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'together' ? (<><Circle cx={9} cy={10} r={6} /><Circle cx={15} cy={10} r={6} /></>) : null}
      {kind === 'place' ? <Path d="M12 18s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10zM12 10a2 2 0 1 0 0-.01" /> : null}
      {kind === 'first' ? (<><Rect x={3} y={4} width={18} height={12} rx={1} /><Path d="M3 5l9 6 9-6" /></>) : null}
      {kind === 'voice' ? <Path d="M5 8v4M9 5v10M13 7v6M17 4v12M21 8v4" /> : null}
      {kind === 'moment' ? <Path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /> : null}
    </Svg>
  );
}

// an ink stamp pressed onto the page
const press = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 1.4 }, { rotate: '7deg' }] },
  55: { opacity: 1, transform: [{ scale: 0.95 }, { rotate: '-2deg' }] },
  80: { transform: [{ scale: 1.02 }, { rotate: '1deg' }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { rotate: '0deg' }] },
}).duration(420);

export default function Passport() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [stamps, setStamps] = useState<MemoryStamp[]>([]);
  const [bond, setBond] = useState<Bond | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [plan, setPlan] = useState<ItineraryStop[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [visit, setVisit] = useState(0); // reload the trip plan each time the tab is opened

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // One pen pal at a time
        const ms = (await getMatches()).filter((m) => m.status !== 'ended').slice(0, 1);
        setMatches(ms);
        setSelected(ms[0]?.id ?? null);
        setVisit((v) => v + 1);
        // Stamps mark real moments in your letters (the AI names them); the bond is counted from what you've shared
        if (ms[0]) {
          const [st, b] = await Promise.all([getStamps(ms[0].id).catch(() => []), getBond(ms[0].id).catch(() => null)]);
          setStamps(st);
          setBond(b);
        } else {
          setStamps([]);
          setBond(null);
        }
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
  }, [selected, visit]);

  const match = matches.find((m) => m.id === selected);
  const p = match?.partner;
  const theirCity = p?.home_city || match?.city;

  const share = () => {
    if (!plan || !match) return;
    const lines = plan.map((s) => `Day ${s.day}: ${s.place} — "${s.tip}"`).join('\n');
    Share.share({ message: `When I visit ${theirCity} (built from ${p?.name}'s windows on Window)\n\n${lines}` });
  };

  return (
    <Screen scroll gap={18} padBottom={TAB_BAR_SPACE} edges={['top']} textured style={{ paddingHorizontal: 20 }}>
      <Ledger label="Passport" note={match ? `${theirCity} · with ${p?.name}` : undefined} />

      {bond && p ? <BondCard bond={bond} name={p.name} /> : null}

      {/* the stamps page of a worn passport */}
      <View style={[{ padding: 16, borderRadius: 4, backgroundColor: colors.postcard, gap: 14, overflow: 'hidden', borderLeftWidth: 10, borderLeftColor: colors.walnut }, shadow.card]}>
        <PaperGrain />
        {/* faint guilloche lines like a passport page */}
        {[0, 1, 2, 3].map((k) => (
          <View key={k} style={{ position: 'absolute', left: -40, right: -40, top: 30 + k * 34, height: 1, backgroundColor: 'rgba(111,123,87,0.12)', transform: [{ rotate: '-4deg' }] }} />
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="eyebrow">Stamps from your letters</T>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>{stamps.length}</Text>
        </View>
        {stamps.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {stamps.map((s, i) => {
              const ink = INK[s.kind] ?? INK.moment;
              return (
                <Animated.View key={s.id} entering={press.delay(300 + i * 160)}>
                  <Stamp label={s.title} sub={s.sub} color={ink.color} textColor={ink.text} width={92} height={104} lines={3} tilt={[-3, 2, -1, 3][i % 4]} edgeColor={colors.postcard}>
                    <StampMark kind={s.kind} color={ink.text ?? colors.postcard} />
                  </Stamp>
                </Animated.View>
              );
            })}
          </View>
        ) : (
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>Your first stamp arrives with your first letter.</Text>
        )}
      </View>

      {match ? (
        <>
          <View>
            <T variant="heading">When I visit {theirCity}</T>
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
              <Button variant="outline" title={`Share my ${theirCity} plan`} onPress={share} style={{ marginTop: 2 }} />
            </View>
          ) : (
            <T variant="muted">Save a few of {p?.name}&apos;s windows and your plan will build itself here.</T>
          )}
        </>
      ) : null}
    </Screen>
  );
}

/** How close you've become, with the crane marking how far along you are to the next level. */
function BondCard({ bond, name }: { bond: Bond; name: string }) {
  const pct = Math.round(bond.progress * 100);
  const stats = [
    `${bond.letters} letter${bond.letters === 1 ? '' : 's'}`,
    `${bond.together} prompt${bond.together === 1 ? '' : 's'} answered together`,
    `${bond.voices} voice note${bond.voices === 1 ? '' : 's'}`,
  ].join(' · ');
  return (
    <View style={{ gap: 8 }}>
      <T variant="eyebrow" style={{ color: colors.muted }}>You and {name}</T>
      <T variant="heading" style={{ fontSize: 23, lineHeight: 28 }}>{bond.name}</T>
      {bond.next ? (
        <View style={{ height: 30, justifyContent: 'center', marginTop: 2 }}>
          {/* a stitched route to the next level; the stitches you've covered are inked */}
          <View style={{ height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.dash }} />
          <View style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 2, backgroundColor: colors.terracotta, borderRadius: 1 }} />
          {COZY.crane ? (
            <View style={{ position: 'absolute', left: `${pct}%`, marginLeft: -17, top: -6 }}>
              <Crane size={34} mood="rest" perched={false} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="small">{stats}</T>
      </View>
      {bond.next ? <T variant="small" style={{ color: colors.walnut }}>Next: {bond.next}. Answering prompts together gets you there fastest.</T> : null}
    </View>
  );
}
