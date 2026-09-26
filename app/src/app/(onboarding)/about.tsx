// About you: first name, languages, home city. Only first name + city are shown to partners.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { PinIcon } from '@/components/Icons';
import { AddOwn, Button, Chip, Field, StepHeader, T } from '@/components/ui';
import { saveProfile, signOut } from '@/lib/data';
import { useSession } from '@/lib/session';
import { City, findCity, LANGUAGES, searchCities } from '@/lib/cities';
import { timeIn } from '@/lib/time';
import { colors, fonts } from '@/lib/theme';

const COMMON = ['en', 'hi', 'es', 'ja', 'ko', 'pt', 'fr', 'zh'];

export default function About() {
  const { profile, refresh } = useSession();
  const [name, setName] = useState(profile?.name ?? '');
  const [langs, setLangs] = useState<string[]>(profile?.languages ?? []);
  const [showAll, setShowAll] = useState(false);
  const [city, setCity] = useState<City | undefined>(findCity(profile?.home_city));
  const [query, setQuery] = useState(city ? `${city.name}, ${city.country}` : '');
  const [busy, setBusy] = useState(false);
  const [other, setOther] = useState(false);
  // languages you typed yourself are stored as their name ("Nepali")
  const own = langs.filter((code) => !LANGUAGES.some((l) => l.code === code));
  const addOwn = (text: string) => {
    const known = LANGUAGES.find((l) => l.name.toLowerCase() === text.toLowerCase());
    const code = known ? known.code : text;
    setLangs((l) => (l.includes(code) ? l : [...l, code]));
    if (known) setShowAll(true);
  };

  const shown = showAll ? LANGUAGES : LANGUAGES.filter((l) => COMMON.includes(l.code) || langs.includes(l.code));
  const results = city && query === `${city.name}, ${city.country}` ? [] : searchCities(query);
  const toggle = (code: string) => setLangs((l) => (l.includes(code) ? l.filter((x) => x !== code) : [...l, code]));

  const next = async () => {
    if (!city) return;
    setBusy(true);
    try {
      await saveProfile({
        name: name.trim(), languages: langs,
        home_city: city.name, country: city.country, tz: city.tz, lat: city.lat, lng: city.lng,
      });
      await refresh();
      router.push('/verify');
    } finally {
      setBusy(false);
    }
  };

  const back = async () => {
    // Leaving onboarding at step 1 logs you out and returns to Welcome
    await signOut();
    await refresh();
    router.replace('/welcome');
  };

  return (
    <Screen scroll gap={24} style={{ paddingHorizontal: 28 }}>
      <StepHeader step={1} onBack={back} />
      <View style={{ gap: 8 }}>
        <T variant="title">Hi! Tell us a little about you.</T>
        <T variant="muted">Only your first name and city are ever shown to your window partner.</T>
      </View>

      <Field
        label="First name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="given-name"
        placeholder="Your first name"
      />

      <View style={{ gap: 10 }}>
        <T variant="label">Languages you speak</T>
        <T variant="small" style={{ marginTop: -6 }}>Pick your main one first.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {shown.map((l) => (
            <Chip key={l.code} small label={l.name} selected={langs.includes(l.code)} onPress={() => toggle(l.code)} />
          ))}
          {own.map((code) => (
            <Chip key={code} small label={code} selected onPress={() => toggle(code)} />
          ))}
          {!showAll ? <Chip small dashed label="+ More" onPress={() => setShowAll(true)} /> : null}
          {!other ? <Chip small dashed label="+ Other" onPress={() => setOther(true)} /> : null}
        </View>
        {other ? <AddOwn placeholder="Type a language" onAdd={addOwn} onClose={() => setOther(false)} /> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Field
          label="Home city"
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setCity(undefined);
          }}
          placeholder="Search your city"
          left={<PinIcon />}
          autoCorrect={false}
        />
        {results.length ? (
          <Animated.View entering={FadeInDown.duration(200)} style={{ borderTopWidth: 1, borderColor: colors.line }}>
            {results.map((c) => (
              <Pressable
                key={c.name}
                onPress={() => {
                  setCity(c);
                  setQuery(`${c.name}, ${c.country}`);
                }}
                style={({ pressed }) => [{ paddingVertical: 11, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: colors.line }, pressed && { opacity: 0.6 }]}
              >
                <T style={{ fontFamily: fonts.semibold }}>{c.name}</T>
                <T variant="small">{c.country} · {timeIn(c.tz)}</T>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
        {city ? <T variant="small">Local time {timeIn(city.tz)}</T> : null}
      </View>

      <Spacer />
      <Button title="Next" onPress={next} loading={busy} disabled={!name.trim() || !langs.length || !city} />
    </Screen>
  );
}
