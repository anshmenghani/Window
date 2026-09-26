// "Knock on Aiko's window": tap a rhythm, and after a short pause it's sent.
// Their physical window (or phone) plays the same rhythm back.
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { sendKnock } from '@/lib/data';
import { colors, fonts, radius } from '@/lib/theme';
import type { Profile } from '@/lib/types';
import { KnockIcon } from './Icons';

const PAUSE_MS = 1200; // silence that ends a knock pattern
const MAX_KNOCKS = 10;

export function KnockPad({ partner }: { partner: Profile }) {
  const taps = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<'idle' | 'tapping' | 'sent' | 'error'>('idle');
  const [errorText, setErrorText] = useState('');
  const [count, setCount] = useState(0);
  const shake = useSharedValue(0);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value}deg` }] }));

  const send = () => {
    const first = taps.current[0];
    const pattern = taps.current.map((t) => t - first);
    taps.current = [];
    setCount(0);
    setState('sent');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sendKnock(partner.id, pattern)
      .then(() => setTimeout(() => setState('idle'), 2200))
      .catch((e) => {
        // e.g. the window is paused: say so instead of silently resetting
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorText(e instanceof Error ? e.message : 'Your knock didn\'t go through. Try again.');
        setState('error');
        setTimeout(() => setState('idle'), 3500);
      });
  };

  const onTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    shake.value = withSequence(withTiming(-14, { duration: 60 }), withTiming(0, { duration: 90 }));
    taps.current.push(Date.now());
    setCount(taps.current.length);
    setState('tapping');
    if (timer.current) clearTimeout(timer.current);
    if (taps.current.length >= MAX_KNOCKS) send();
    else timer.current = setTimeout(send, PAUSE_MS);
  };

  const hint =
    state === 'tapping' ? `${'• '.repeat(count).trim()}  keep going, or pause to send`
      : state === 'sent' ? `Sent! ${partner.name}'s window is knocking`
        : state === 'error' ? errorText
          : `Tap a rhythm. ${partner.name}'s window knocks it back.`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Knock on ${partner.name}'s window`}
      onPress={onTap}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: state === 'sent' ? colors.okBg : state === 'error' ? '#FBE4E2' : colors.honey },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <Animated.View style={[{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.light, alignItems: 'center', justifyContent: 'center' }, iconStyle]}>
        <KnockIcon />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>Knock on {partner.name}&apos;s window</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: state === 'sent' ? colors.ok : state === 'error' ? colors.danger : colors.honeyText }}>{hint}</Text>
      </View>
    </Pressable>
  );
}
