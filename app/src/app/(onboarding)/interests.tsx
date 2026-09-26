// Interests: gives the matcher something real to match on. Pick at least 3.
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Screen, Spacer } from '@/components/Screen';
import { Button, Chip, StepHeader, T } from '@/components/ui';
import { saveProfile } from '@/lib/data';
import { useSession } from '@/lib/session';
import { INTERESTS } from '@/lib/cities';

export default function Interests() {
  const { profile, refresh } = useSession();
  const [picked, setPicked] = useState<string[]>(profile?.interests ?? []);
  const [busy, setBusy] = useState(false);

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
      </View>
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
