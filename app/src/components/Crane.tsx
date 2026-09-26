// The paper crane: Window's one mascot. It's folded from airmail paper (you can see the
// red-and-blue edge on its wing) and it's the thing that carries windows between cities.
//
// Moods tell you what's going on:
//   rest  = nothing new; head tucked, breathing slowly on the sill
//   alert = their window just arrived; head up, a hop and a flap
//   fly   = carrying something; wings keep beating
// Bump `pulse` to make it hop and flap once (a knock, a tap).
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '@/lib/theme';

export type CraneMood = 'rest' | 'alert' | 'fly';

const PAPER = '#FFF9ED';
const SHADE = '#EBDCC2';
const DEEP = '#D8C4A1';
const EDGE = 'rgba(74,45,27,0.55)';
const CREASE = 'rgba(110,68,41,0.32)';

// Everything is drawn in a 100 × 80 box, facing left.
const VB = '0 0 100 80';

function Layer({ children }: { children: React.ReactNode }) {
  return (
    <Svg viewBox={VB} width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
      {children}
    </Svg>
  );
}

export function Crane({
  size = 56, mood = 'rest', pulse = 0, perched = true, facing = 'left',
}: { size?: number; mood?: CraneMood; pulse?: number; perched?: boolean; facing?: 'left' | 'right' }) {
  const reduced = useReducedMotion();
  const flap = useSharedValue(0); // 0 = wings up, 1 = wings down
  const hop = useSharedValue(0);
  const tuck = useSharedValue(mood === 'rest' ? 1 : 0); // head tucked toward the body
  const breathe = useSharedValue(0);

  const flapOnce = (times: number) => {
    const beats = [];
    for (let i = 0; i < times; i++) {
      beats.push(withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }));
      beats.push(withTiming(0, { duration: 190, easing: Easing.inOut(Easing.quad) }));
    }
    return withSequence(...beats);
  };

  useEffect(() => {
    cancelAnimation(flap);
    cancelAnimation(breathe);
    if (reduced) {
      flap.value = 0;
      tuck.value = mood === 'rest' ? 1 : 0;
      return;
    }
    if (mood === 'fly') {
      tuck.value = withTiming(0, { duration: 200 });
      flap.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 170, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 230, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      );
      hop.value = withRepeat(withSequence(withTiming(-2.5, { duration: 200 }), withTiming(1.5, { duration: 200 })), -1, true);
      breathe.value = 0;
    } else if (mood === 'alert') {
      tuck.value = withSpring(0, { damping: 12, stiffness: 180 });
      hop.value = withSequence(withTiming(-9, { duration: 150 }), withSpring(0, { damping: 7, stiffness: 220 }));
      flap.value = withDelay(80, flapOnce(2));
      breathe.value = 0;
    } else {
      hop.value = withTiming(0, { duration: 200 });
      flap.value = withTiming(0, { duration: 250 });
      tuck.value = withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) });
      breathe.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, reduced]);

  useEffect(() => {
    if (!pulse || reduced) return;
    // a little startled hop, head up for a beat, three quick flaps
    hop.value = withSequence(withTiming(-11, { duration: 140 }), withSpring(0, { damping: 6, stiffness: 200 }));
    flap.value = flapOnce(3);
    if (mood === 'rest') {
      tuck.value = withSequence(withTiming(0, { duration: 120 }), withDelay(900, withTiming(1, { duration: 600 })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);

  const body = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { scaleY: 1 - breathe.value * 0.03 }],
  }));
  // Wings fold down past edge-on, which reads as a flap in 2D.
  const near = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - flap.value * 1.55 }] }));
  const far = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - flap.value * 1.3 }] }));
  const head = useAnimatedStyle(() => ({ transform: [{ rotate: `${-16 * tuck.value}deg` }] }));
  const shadow = useAnimatedStyle(() => ({
    opacity: 0.18 + hop.value * 0.012,
    transform: [{ scaleX: 1 + hop.value * 0.03 }],
  }));

  const w = size;
  const h = size * 0.8;

  return (
    <View style={{ width: w, height: h, transform: [{ scaleX: facing === 'right' ? -1 : 1 }] }} pointerEvents="none">
      {perched ? (
        <Animated.View
          style={[{ position: 'absolute', left: w * 0.3, width: w * 0.42, bottom: h * 0.2, height: h * 0.07, borderRadius: w, backgroundColor: '#2A1A0E' }, shadow]}
        />
      ) : null}
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '50% 75%' }, body]}>
        {/* far wing, behind everything */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '55% 60%' }, far]}>
          <Layer>
            <Path d="M46 49 L70 49 L66 1 Z" fill={DEEP} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
            <Line x1={58} y1={49} x2={66} y2={1} stroke={CREASE} strokeWidth={0.7} />
          </Layer>
        </Animated.View>

        {/* tail and body */}
        <Layer>
          <Path d="M58 50 L67 52 L92 21 L88 20 Z" fill={SHADE} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
          <Path d="M37 52 L52 43 L67 52 L52 60 Z" fill={PAPER} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
          <Path d="M37 52 L67 52 L52 60 Z" fill={SHADE} />
          <Line x1={37} y1={52} x2={67} y2={52} stroke={CREASE} strokeWidth={0.7} />
        </Layer>

        {/* neck and head, pivoting where the neck meets the body */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '42% 64%' }, head]}>
          <Layer>
            <Path d="M38 53 L46 50 L18 21 Z" fill={PAPER} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
            <Path d="M18 21 L10 28 L21 24 Z" fill={SHADE} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
            <Circle cx={17.5} cy={23.6} r={1.05} fill={colors.ink} />
            <Circle cx={20.4} cy={26.2} r={1.9} fill={colors.terracotta} opacity={0.28} />
          </Layer>
        </Animated.View>

        {/* near wing, folded from the airmail edge of the paper */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, transformOrigin: '52% 63%' }, near]}>
          <Layer>
            <Path d="M37 51 L65 51 L47 0 Z" fill={PAPER} stroke={EDGE} strokeWidth={0.8} strokeLinejoin="round" />
            <Path d="M51 51 L65 51 L47 0 Z" fill={SHADE} opacity={0.7} />
            <Line x1={40.4} y1={47} x2={47.6} y2={8} stroke={colors.terracotta} strokeWidth={2.2} strokeDasharray="3.4 3.4" />
            <Line x1={40.4} y1={47} x2={47.6} y2={8} stroke={colors.sky} strokeWidth={2.2} strokeDasharray="3.4 3.4" strokeDashoffset={3.4} />
          </Layer>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
