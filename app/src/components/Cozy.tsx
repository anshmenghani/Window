// Small pen-pal details that make the windowsill feel lived in. Each is switched on or off
// in COZY (lib/config.ts), so any of them can be removed without touching the screens.
import { useEffect, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeOut, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence,
  withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

// ---------------------------------------------------------------------------
// A pot on the sill that grows one leaf for every day you've been pen pals.
// ---------------------------------------------------------------------------
const MOSS = '#6F7B57';
const MOSS_LIGHT = '#8E9B6C';
const SPROUT = '#A7B57C';

export function SillPlant({ days, size = 44 }: { days: number; size?: number }) {
  const reduced = useReducedMotion();
  const leaves = Math.max(1, Math.min(12, days));
  const sway = useSharedValue(0);
  const grow = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    // the newest leaf unfurls a moment after the screen appears
    if (!reduced) grow.value = withDelay(700, withSpring(1, { damping: 9, stiffness: 120 }));
  }, [grow, reduced, leaves]);

  const plantStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sway.value}deg` }] }));
  const newLeaf = useAnimatedStyle(() => ({ transform: [{ scale: grow.value }], opacity: grow.value }));

  // 60 × 80 drawing: pot at the bottom, a stem with leaves alternating up it
  const H = 80;
  const potTop = 58;
  const step = Math.min(4.2, 40 / leaves);
  const stemTop = potTop - 6 - leaves * step;
  const leaf = (i: number) => {
    const y = potTop - 6 - (i + 0.6) * step;
    const left = i % 2 === 0;
    return { x: 30, y, left };
  };
  const leafPath = (left: boolean) => (left ? 'M0 0 C-4 -5 -11 -5 -14 -1 C-10 3 -4 3 0 0 Z' : 'M0 0 C4 -5 11 -5 14 -1 C10 3 4 3 0 0 Z');
  const last = leaf(leaves - 1);

  return (
    <Pressable
      accessibilityLabel={`A plant with ${leaves} leaves: one for each day you've been pen pals`}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync();
        sway.value = withSequence(withTiming(-7, { duration: 120 }), withTiming(5, { duration: 160 }), withSpring(0, { damping: 5, stiffness: 160 }));
      }}
      style={{ width: size * 0.75, height: size }}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size * 0.75, height: size, transformOrigin: '50% 75%' }, plantStyle]}>
        <Svg viewBox={`0 0 60 ${H}`} width="100%" height="100%">
          <Path d={`M30 ${potTop} C29 ${(potTop + stemTop) / 2} 31 ${(potTop + stemTop) / 2} 30 ${stemTop}`} stroke={MOSS} strokeWidth={1.6} fill="none" strokeLinecap="round" />
          {Array.from({ length: leaves - 1 }, (_, i) => {
            const l = leaf(i);
            return (
              <G key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.left ? 18 : -18})`}>
                <Path d={leafPath(l.left)} fill={i % 3 === 1 ? MOSS_LIGHT : MOSS} />
              </G>
            );
          })}
        </Svg>
        {/* the newest leaf, drawn on its own so it can unfurl */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size * 0.75, height: size, transformOrigin: `${(last.x / 60) * 100}% ${(last.y / H) * 100}%` }, newLeaf]}>
          <Svg viewBox={`0 0 60 ${H}`} width="100%" height="100%">
            <G transform={`translate(${last.x} ${last.y}) rotate(${last.left ? 18 : -18})`}>
              <Path d={leafPath(last.left)} fill={SPROUT} />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
      {/* the terracotta pot doesn't sway */}
      <Svg viewBox={`0 0 60 ${H}`} width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={`M16 ${potTop} H44 L41 ${H - 2} H19 Z`} fill="#B9583D" />
        <Path d={`M30 ${potTop} H44 L41 ${H - 2} H30 Z`} fill="#000" opacity={0.12} />
        <Rect x={13} y={potTop - 4} width={34} height={6} rx={1.5} fill="#C8694C" />
        <Rect x={13} y={potTop + 0.5} width={34} height={1.2} fill="#000" opacity={0.12} />
      </Svg>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Sprig wallpaper for the wall behind the windowsill. It fades out toward the top so
// the date and greeting sit on plain paper.
// ---------------------------------------------------------------------------
export function Wallpaper({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="sprig" width={34} height={40} patternUnits="userSpaceOnUse">
            <Rect width={34} height={40} fill="#EFE2CB" />
            {/* a faint pinstripe */}
            <Rect x={0} y={0} width={0.8} height={40} fill="#6E4429" opacity={0.06} />
            {/* sprig: a stem, three leaves and a berry */}
            <G opacity={0.22} transform="translate(17 12)">
              <Path d="M0 10 C0 6 1 3 0 0" stroke={MOSS} strokeWidth={0.9} fill="none" />
              <Path d="M0 6 C-3 4 -5 5 -5 6 C-3 7 -1 7 0 6 Z" fill={MOSS} />
              <Path d="M0 3 C3 1 5 2 5 3 C3 4 1 4 0 3 Z" fill={MOSS} />
              <Circle cx={0} cy={-1} r={1.4} fill="#B9583D" />
            </G>
            <Circle cx={0} cy={32} r={0.9} fill="#B9583D" opacity={0.14} />
            <Circle cx={34} cy={32} r={0.9} fill="#B9583D" opacity={0.14} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sprig)" />
      </Svg>
      <LinearGradient
        colors={[colors.mist, 'rgba(243,234,219,0)']}
        locations={[0.08, 0.42]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Gingham curtains inside a window. Drawn = mostly closed; open = tied back at the sides.
// Put them inside an <Arch> so the arch clips them.
// ---------------------------------------------------------------------------
function CurtainPanel({ side, width, height }: { side: 'left' | 'right'; width: number; height: number }) {
  const w = width;
  const tieY = height * 0.62;
  // full at the top, pinched at the tie-back, flaring a little to the sill
  const d = `M0 0 H${w} C${w * 0.9} ${tieY * 0.6} ${w * 0.45} ${tieY - 8} ${w * 0.42} ${tieY} C${w * 0.5} ${tieY + 20} ${w * 0.75} ${height - 10} ${w * 0.8} ${height} H0 Z`;
  const id = `gingham-${side}`;
  return (
    <Svg width={w} height={height} style={{ transform: [{ scaleX: side === 'right' ? -1 : 1 }] }}>
      <Defs>
        <Pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse">
          <Rect width={8} height={8} fill="#F6EEDF" />
          <Rect width={4} height={8} fill="#B9583D" opacity={0.2} />
          <Rect width={8} height={4} fill="#B9583D" opacity={0.2} />
        </Pattern>
      </Defs>
      <Path d={d} fill={`url(#${id})`} />
      {/* folds */}
      <Path d={`M${w * 0.3} 0 C${w * 0.28} ${tieY * 0.5} ${w * 0.3} ${tieY - 6} ${w * 0.36} ${tieY}`} stroke="#6E4429" strokeOpacity={0.14} strokeWidth={2} fill="none" />
      <Path d={`M${w * 0.62} 0 C${w * 0.58} ${tieY * 0.5} ${w * 0.45} ${tieY - 6} ${w * 0.42} ${tieY}`} stroke="#6E4429" strokeOpacity={0.12} strokeWidth={2} fill="none" />
      <Path d={d} fill="none" stroke="#6E4429" strokeOpacity={0.25} strokeWidth={1} />
      {/* the tie-back ribbon */}
      <Rect x={w * 0.36} y={tieY - 3} width={w * 0.2} height={6} rx={2} fill="#B9583D" opacity={0.9} />
    </Svg>
  );
}

export function Curtains({ open, width, height }: { open: boolean; width: number; height: number }) {
  const reduced = useReducedMotion();
  const panelW = Math.round(width * 0.2);
  const spread = useSharedValue(open ? 1 : 0); // 0 = drawn, 1 = tied back

  useEffect(() => {
    spread.value = reduced ? (open ? 1 : 0) : withDelay(open ? 300 : 0, withTiming(open ? 1 : 0, { duration: 900, easing: Easing.inOut(Easing.cubic) }));
  }, [open, reduced, spread]);

  // drawn curtains stretch toward the middle; tied back they're slim at the edges
  const left = useAnimatedStyle(() => ({ transform: [{ scaleX: 2.3 - spread.value * 1.3 }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ scaleX: 2.3 - spread.value * 1.3 }] }));

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, transformOrigin: 'left' }, left]}>
        <CurtainPanel side="left" width={panelW} height={height} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', right: 0, top: 0, transformOrigin: 'right' }, right]}>
        <CurtainPanel side="right" width={panelW} height={height} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// A circular postmark: city, date and the wavy cancellation lines.
// ---------------------------------------------------------------------------
export function Postmark({ city, date, size = 58, color = colors.walnut }: { city: string; date: string; size?: number; color?: string }) {
  return (
    <View pointerEvents="none" style={{ width: size * 1.7, height: size, transform: [{ rotate: '-8deg' }], opacity: 0.8 }}>
      <Svg width={size * 1.7} height={size} viewBox="0 0 102 60">
        <Circle cx={30} cy={30} r={27} stroke={color} strokeWidth={1.4} fill="none" />
        <Circle cx={30} cy={30} r={20} stroke={color} strokeWidth={0.8} fill="none" />
        <SvgText x={30} y={27} fontSize={8} fontWeight="700" fill={color} textAnchor="middle" letterSpacing={0.8}>
          {city.toUpperCase().slice(0, 10)}
        </SvgText>
        <SvgText x={30} y={38} fontSize={6.5} fill={color} textAnchor="middle" letterSpacing={0.5}>
          {date.toUpperCase()}
        </SvgText>
        {[18, 26, 34, 42].map((y) => (
          <Path key={y} d={`M58 ${y} q5 -3 10 0 t10 0 t10 0 t10 0`} stroke={color} strokeWidth={1.2} fill="none" />
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The envelope a new window arrives in. It sits over the window, the wax seal pops,
// the flap opens and the envelope slides away. Tap to skip.
// ---------------------------------------------------------------------------
const AIRMAIL = Array.from({ length: 40 }, (_, i) => i);

export function Envelope({
  width, height, initial, onOpened,
}: { width: number; height: number; initial: string; onOpened: () => void }) {
  const reduced = useReducedMotion();
  const [gone, setGone] = useState(false);
  const seal = useSharedValue(1);
  const flap = useSharedValue(0); // 0 closed → 1 open
  const away = useSharedValue(0); // 0 in place → 1 slid away

  const finish = () => {
    setGone(true);
    onOpened();
  };

  const open = (fast = false) => {
    const k = fast ? 0.35 : 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    seal.value = withTiming(0, { duration: 180 * k });
    flap.value = withDelay(150 * k, withTiming(1, { duration: 420 * k, easing: Easing.inOut(Easing.quad) }));
    away.value = withDelay(560 * k, withTiming(1, { duration: 420 * k, easing: Easing.in(Easing.quad) }, (done) => {
      if (done) runOnJS(finish)();
    }));
  };

  useEffect(() => {
    if (reduced) {
      finish();
      return;
    }
    const t = setTimeout(() => open(), 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flapH = height * 0.55;
  const sealStyle = useAnimatedStyle(() => ({ opacity: seal.value, transform: [{ scale: 0.6 + seal.value * 0.4 }] }));
  const flapStyle = useAnimatedStyle(() => ({
    opacity: flap.value > 0.5 ? 1 - (flap.value - 0.5) * 2 : 1,
    transform: [{ perspective: 700 }, { rotateX: `${flap.value * 180}deg` }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: 1 - away.value,
    transform: [{ translateY: away.value * height * 0.5 }],
  }));

  if (gone) return null;

  return (
    <Pressable accessibilityLabel="Open the envelope" onPress={() => open(true)} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View exiting={FadeOut} style={[{ width, height }, bodyStyle]}>
        <View style={{ flex: 1, backgroundColor: colors.postcard, borderRadius: 3, overflow: 'hidden', shadowColor: '#2A1A0E', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } }}>
          {/* airmail border */}
          {(['top', 'bottom'] as const).map((edge) => (
            <View key={edge} style={{ position: 'absolute', left: -10, right: -10, [edge]: 0, height: 7, flexDirection: 'row', overflow: 'hidden' }}>
              {AIRMAIL.map((i) => (
                <View key={i} style={{ width: 14, height: 7, marginRight: 4, backgroundColor: i % 2 ? colors.sky : colors.terracotta, transform: [{ skewX: '-35deg' }] }} />
              ))}
            </View>
          ))}
          {/* the pocket's folds */}
          <Svg width={width} height={height} style={{ position: 'absolute' }}>
            <Path d={`M0 ${height} L${width / 2} ${height * 0.5} L${width} ${height}`} stroke="#6E4429" strokeOpacity={0.18} strokeWidth={1} fill="none" />
          </Svg>
          <Text style={{ position: 'absolute', left: 18, bottom: 20, fontFamily: fonts.hand, fontSize: 22, color: colors.hand }}>par avion</Text>
        </View>
        {/* the flap, hinged at the top */}
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width, height: flapH, transformOrigin: 'top' }, flapStyle]}>
          <Svg width={width} height={flapH}>
            <Path d={`M0 0 H${width} L${width / 2} ${flapH} Z`} fill="#F1E5CD" stroke="#6E4429" strokeOpacity={0.25} strokeWidth={1} />
          </Svg>
        </Animated.View>
        {/* wax seal with their initial */}
        <Animated.View style={[{ position: 'absolute', left: width / 2 - 20, top: flapH - 22, width: 40, height: 40, borderRadius: 20, backgroundColor: '#A8452F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#8E3824' }, sealStyle]}>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 19, color: '#F6D9CC', marginTop: -2 }}>{initial}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
