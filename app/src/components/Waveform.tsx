// Live voice-note waveform: filled bars for what's recorded, faint dots for the time left.
import { View } from 'react-native';
import { colors } from '@/lib/theme';

export const BARS = 24;

/** levels: 0..1 for each recorded slice (newest last). progress: 0..1 of the 15 s limit. */
export function Waveform({ levels, progress }: { levels: number[]; progress: number }) {
  const filled = Math.round(progress * BARS);
  const recent = levels.slice(-filled);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 }}>
      {Array.from({ length: BARS }, (_, i) => {
        const on = i < filled;
        const level = on ? recent[i] ?? 0.3 : 0;
        const h = on ? 6 + level * 22 : 4;
        return <View key={i} style={{ width: 4, height: h, borderRadius: 2, backgroundColor: on ? colors.amber : colors.nightLine }} />;
      })}
    </View>
  );
}
