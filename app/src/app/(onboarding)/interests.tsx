// Interests: gives the matcher something real to match on. Pick at least 3.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { AddOwn, Button, Chip, StepHeader, T } from '@/components/ui';
import { saveProfile } from '@/lib/data';
import { useSession } from '@/lib/session';
import { INTERESTS } from '@/lib/cities';

export default function Interests() {
  const { profile, refresh } = useSession();
  const [picked, setPicked] = useState<string[]>(profile?.interests ?? []);
  const [busy, setBusy] = useState(false);
  // If the profile arrives after this screen opened (slow network), fill in what's still empty
  const filled = useRef(!!profile);
  useEffect(() => {
    if (!profile || filled.current) return;
    filled.current = true;
    setPicked((p) => (p.length ? p : profile.interests ?? []));
  }, [profile]);
  const [other, setOther] = useState(false);
  // your own interests (typed under Other) show as tags next to the usual ones
  const own = picked.filter((p) => !INTERESTS.some((i) => i.toLowerCase() === p.toLowerCase()));
  const addOwn = (text: string) => setPicked((p) => (p.some((x) => x.toLowerCase() === text.toLowerCase()) ? p : [...p, text]));

  const toggle = (label: string) =>
    setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));

  const next = async () => {
    setBusy(true);
    try {
      await saveProfile({ interests: picked });
      await refresh();
      router.push('/dreams');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll gap={24} style={{ paddingHorizontal: 28 }}>
      <StepHeader step={3} onBack={() => router.back()} />
      <View style={{ gap: 8 }}>
        <T variant="title">What do you love?</T>
        <T variant="muted">Pick at least 3. Your window partner will share some of them.</T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {INTERESTS.map((label, i) => (
          <Animated.View key={label} entering={FadeInDown.delay(i * 35).springify()}>
            <Chip label={label} selected={picked.includes(label)} onPress={() => toggle(label)} />
          </Animated.View>
        ))}
        {own.map((label) => (
          <Chip key={label} label={label} selected onPress={() => toggle(label)} />
        ))}
        {!other ? <Chip dashed label="+ Other" onPress={() => setOther(true)} /> : null}
      </View>
      {other ? <AddOwn placeholder="Type your own" onAdd={addOwn} onClose={() => setOther(false)} /> : null}
      <Spacer />
      <View style={{ gap: 12 }}>
        <T variant="muted" style={{ textAlign: 'center', fontSize: 14 }}>
          {picked.length} picked{picked.length < 3 ? ` · ${3 - picked.length} more to go` : ''}
        </T>
        <Button title="Next" onPress={next} loading={busy} disabled={picked.length < 3} />
      </View>
    </Screen>
  );
}
