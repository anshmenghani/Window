// The knock rail: a strip of walnut with a brass knocker. Tap a rhythm; after a pause it's sent,
// and their window (or phone) knocks the same rhythm back. Taps show as ink marks on the rail.
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { sendKnock } from '@/lib/data';
import { colors, fonts, motion, radius, shadow } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { KnockIcon } from './Icons';
import { Brass, Wood } from './materials';

const PAUSE_MS = 1200; // silence that ends a knock pattern
const MAX_KNOCKS = 10;
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

export function KnockPad({ partner }: { partner: Profile }) {
  const taps = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<'idle' | 'tapping' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');
  const [pattern, setPattern] = useState<number[]>([]);
  const inset = useSharedValue(0);
  const railStyle = useAnimatedStyle(() => ({ transform: [{ translateY: inset.value }, { scale: 1 - inset.value * 0.004 }] }));

  const send = () => {
    const first = taps.current[0];
    const p = taps.current.map((t) => t - first);
    taps.current = [];
    setState('sent');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sendKnock(partner.id, p)
      .then(() => setTimeout(() => { setState('idle'); setPattern([]); }, 2400))
      .catch((e) => {
        // e.g. the window is paused: say so instead of silently resetting
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorText(e instanceof Error ? e.message : 'Your knock didn\'t go through. Try again.');
        setState('error');
        setTimeout(() => { setState('idle'); setPattern([]); }, 3500);
      });
  };

  const onTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    inset.value = withSequence(withTiming(2, { duration: 60 }), withTiming(0, { duration: motion.press }));
    const now = Date.now();
    taps.current.push(now);
    const first = taps.current[0];
    setPattern(taps.current.map((t) => t - first));
    setState('tapping');
    if (timer.current) clearTimeout(timer.current);
    if (taps.current.length >= MAX_KNOCKS) send();
    else timer.current = setTimeout(send, PAUSE_MS);
  };

  const hint =
    state === 'tapping' ? 'keep knocking, or pause to send'
      : state === 'sent' ? `sent · ${partner.name}'s window is knocking`
        : state === 'error' ? errorText
          : `knock on ${partner.name}'s window`;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Knock on ${partner.name}'s window`} onPress={onTap}>
      <Animated.View style={[{ height: 62, borderRadius: radius.md, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10 }, shadow.card, railStyle]}>
        <Wood />
        {/* a groove along the rail */}
        <View style={{ position: 'absolute', left: 64, right: 12, bottom: 7, height: 2, backgroundColor: 'rgba(20,10,4,0.35)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,225,190,0.15)' }} />
        <Brass size={42}>
          <KnockIcon color="#5A3E14" size={20} />
        </Brass>
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14, color: state === 'error' ? '#FFD2C2' : colors.postcard }}>{hint}</Text>
          {pattern.length ? <RhythmMarks pattern={pattern} color={state === 'sent' ? colors.amber : colors.postcard} /> : (
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,249,237,0.7)' }}>tap a rhythm · they&apos;ll hear it</Text>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}
