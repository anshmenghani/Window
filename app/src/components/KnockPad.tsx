// Knock rhythms drawn as ink marks: a dot per knock, a dash for a long pause.
// Knocks are sent only from the physical windows; the app shows them in the knock banner.
// (The old on-screen knock rail was removed from Today; it's in Git history.)
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, motion } from '@/lib/theme';

const LONG_GAP = 380; // gaps longer than this show as a dash

/** Turn tap times into marks: a dot per knock, a dash for a long pause between knocks. */
export function rhythmMarks(pattern: number[]): ('dot' | 'gap')[] {
  const marks: ('dot' | 'gap')[] = [];
  pattern.forEach((t, i) => {
    if (i > 0 && t - pattern[i - 1] > LONG_GAP) marks.push('gap');
    marks.push('dot');
  });
  return marks;
}

export function RhythmMarks({ pattern, color = colors.postcard }: { pattern: number[]; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      {rhythmMarks(pattern).map((m, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.duration(motion.press)}
          style={m === 'dot' ? { width: 7, height: 7, borderRadius: 4, backgroundColor: color } : { width: 14, height: 2, borderRadius: 1, backgroundColor: color, opacity: 0.6 }}
        />
      ))}
    </View>
  );
}
