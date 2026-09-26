// Dream places: pick up to 3 cities. You get ONE pen pal, the best fit who lives in any of them.
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { CheckIcon, CloseIcon, SearchIcon } from '@/components/Icons';
import { Button, Field, StepHeader, T } from '@/components/ui';
import { saveProfile } from '@/lib/data';
import { useSession } from '@/lib/session';
import { findCity, searchCities } from '@/lib/cities';
import { clockLine } from '@/lib/time';
import { colors, fonts, radius, shadow } from '@/lib/theme';

// Where dream pins sit on the little globe (in the 334×200 drawing)
const SLOTS = [
  { x: 290, y: 96, lx: 'right' as const },
  { x: 248, y: 58, lx: 'left' as const },
  { x: 120, y: 62, lx: 'left' as const },
];

export default function Dreams() {
  const { profile, refresh } = useSession();
  const home = profile?.home_city ?? 'Home';
  const myTz = profile?.tz ?? 'America/New_York';
  const [dreams, setDreams] = useState<string[]>(profile?.dream_places ?? []);
  const [mutual, setMutual] = useState(profile?.mutual_dreams ?? true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const results = dreams.length < 3 ? searchCities(query, [home, ...dreams]) : [];

  const next = async () => {
    setBusy(true);
    try {
      await saveProfile({ dream_places: dreams, mutual_dreams: mutual, onboarded: true });
      await refresh();
      router.replace('/matching');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll gap={18} style={{ paddingHorizontal: 28 }}>
      <StepHeader step={4} onBack={() => router.back()} />
      <View style={{ gap: 8 }}>
        <T variant="title">Where do you dream of going?</T>
        <T variant="muted">Pick up to 3. We&apos;ll match you with one person who lives in one of them.</T>
      </View>

      {/* little globe with flight paths from home to each dream */}
      <View style={[{ height: 200, borderRadius: radius.lg, backgroundColor: colors.night, overflow: 'hidden' }, shadow.soft]}>
        <Svg viewBox="0 0 334 200" width="100%" height="100%">
          <Circle cx={167} cy={210} r={190} fill="#2E2A36" />
          <G fill="none" stroke="rgba(217,206,184,0.16)" strokeWidth={1}>
            <Ellipse cx={167} cy={210} rx={190} ry={60} />
            <Ellipse cx={167} cy={210} rx={190} ry={120} />
            <Ellipse cx={167} cy={210} rx={60} ry={190} />
            <Ellipse cx={167} cy={210} rx={130} ry={190} />
          </G>
          {dreams.map((d, i) => (
            <Path
              key={d}
              d={`M40 120 Q${(40 + SLOTS[i].x) / 2} ${Math.min(SLOTS[i].y, 120) - 70} ${SLOTS[i].x} ${SLOTS[i].y}`}
              fill="none" stroke={colors.nightSoft} strokeWidth={i === 0 ? 1.8 : 1.3} strokeDasharray="3 4" opacity={i === 0 ? 0.95 : 0.55}
            />
          ))}
          <Circle cx={40} cy={120} r={6} fill={colors.postcard} />
          {dreams.map((d, i) => (
            <Circle key={d} cx={SLOTS[i].x} cy={SLOTS[i].y} r={i === 0 ? 6 : 5} fill={colors.terracotta} stroke={colors.postcard} strokeWidth={1.5} />
          ))}
        </Svg>
        <Text style={{ position: 'absolute', left: 14, top: 132, fontFamily: fonts.semibold, fontSize: 12, color: colors.nightSoft }}>You · {home}</Text>
        {dreams.map((d, i) => (
          <Text
            key={d}
            style={[
              { position: 'absolute', top: SLOTS[i].y - 22, fontFamily: fonts.semibold, fontSize: 12, color: colors.amber },
              SLOTS[i].lx === 'right' ? { right: 10 } : { left: SLOTS[i].x - 24 },
            ]}
          >
            {d}
          </Text>
        ))}
        {!dreams.length ? (
          <Text style={{ position: 'absolute', right: 16, top: 70, width: 150, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 13, color: colors.nightSoft }}>
            Your dream cities will light up here
          </Text>
        ) : null}
      </View>

      {dreams.length < 3 ? (
        <View style={{ gap: 8 }}>
          <Field value={query} onChangeText={setQuery} placeholder="Search a city" left={<SearchIcon />} autoCorrect={false} inputStyle={{ height: 50 }} />
          {results.map((c) => (
            <Pressable
              key={c.name}
              onPress={() => {
                setDreams((d) => [...d, c.name]);
                setQuery('');
              }}
              style={({ pressed }) => [{ paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: colors.line }, pressed && { opacity: 0.6 }]}
            >
              <T style={{ fontFamily: fonts.semibold }}>+ {c.name}, {c.country}</T>
              <T variant="small">{clockLine(myTz, c.tz)}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View>
        {dreams.map((d, i) => {
          const c = findCity(d);
          return (
            <Animated.View
              key={d}
              entering={FadeInDown.springify()}
              layout={LinearTransition}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }}
            >
              <Text style={{ width: 18, fontFamily: fonts.displayItalic, fontSize: 19, color: colors.terracotta }}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: fonts.semibold }}>{d}{c ? `, ${c.country}` : ''}</T>
                {c ? <T variant="small">{clockLine(myTz, c.tz)}</T> : null}
              </View>
              <Pressable accessibilityLabel={`Remove ${d}`} hitSlop={10} onPress={() => setDreams((x) => x.filter((y) => y !== d))}>
                <CloseIcon size={14} color={colors.muted} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: mutual }}
        onPress={() => setMutual((m) => !m)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}
      >
        <View style={{ width: 22, height: 22, borderRadius: radius.tag, alignItems: 'center', justifyContent: 'center', backgroundColor: mutual ? colors.oldPaper : 'transparent', borderWidth: 1, borderColor: mutual ? colors.walnut : colors.dash }}>
          {mutual ? <CheckIcon color={colors.duskDeep} size={12} /> : null}
        </View>
        <T style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
          <T style={{ fontFamily: fonts.bold, fontSize: 14 }}>Mutual dreams:</T> prefer people who dream of visiting {home}.
        </T>
      </Pressable>

      <Spacer />
      <Button title="Find my window" onPress={next} loading={busy} disabled={!dreams.length} />
    </Screen>
  );
}
