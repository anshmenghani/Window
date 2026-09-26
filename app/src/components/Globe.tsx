// A small 2.5D atlas globe for the Sending screen.
// The map turns inside a fixed circle from the sender's city toward the pen pal's, a stitched
// route draws itself, and a tiny postcard flies along it. Pure react-native-svg + Reanimated.
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { colors } from '@/lib/theme';
import { COZY } from '@/lib/config';
import { Crane } from './Crane';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

type Place = { lat: number; lng: number };

// Coarse, hand-simplified continent outlines [lng, lat]. It's an atlas sketch, not a GIS map.
const LAND: number[][][] = [
  [[-168, 65], [-140, 70], [-110, 72], [-85, 72], [-65, 60], [-55, 50], [-70, 43], [-76, 35], [-81, 25], [-90, 29], [-97, 26], [-105, 20], [-95, 16], [-85, 12], [-80, 8], [-88, 15], [-105, 22], [-115, 30], [-124, 40], [-125, 49], [-135, 58], [-150, 60], [-165, 62]],
  [[-80, 10], [-60, 10], [-50, 0], [-35, -7], [-40, -22], [-48, -28], [-58, -38], [-65, -55], [-72, -50], [-73, -40], [-71, -18], [-80, -5]],
  [[-50, 60], [-44, 60], [-20, 70], [-20, 80], [-50, 82], [-60, 76], [-55, 68]],
  [[-10, 36], [-9, 43], [-2, 48], [-5, 58], [5, 62], [10, 70], [30, 70], [40, 65], [40, 45], [28, 41], [20, 40], [12, 44], [5, 43], [0, 38]],
  [[-6, 50], [-3, 51], [1, 51], [0, 53], [-2, 56], [-5, 58], [-6, 55], [-3, 54]],
  [[-17, 15], [-17, 21], [-10, 30], [-5, 36], [10, 37], [32, 31], [35, 28], [43, 12], [51, 11], [40, -3], [40, -15], [33, -26], [20, -35], [15, -28], [12, -5], [8, 4], [-8, 4], [-15, 10]],
  [[40, 45], [40, 65], [60, 70], [80, 73], [110, 75], [140, 72], [170, 68], [160, 60], [142, 52], [135, 43], [128, 38], [122, 31], [120, 22], [108, 20], [106, 10], [100, 13], [98, 8], [93, 20], [88, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 26], [50, 30], [48, 38]],
  [[130, 31], [132, 34], [135, 34], [139, 35], [141, 38], [142, 42], [140, 41], [137, 37], [134, 35], [130, 33]],
  [[114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19], [153, -25], [151, -33], [146, -39], [138, -35], [131, -31], [118, -35], [115, -33]],
];

const D = Math.PI / 180;

/** Orthographic projection. Returns screen x/y and v (>0 means on the visible side). */
function project(lat: number, lng: number, lat0: number, lng0: number, r: number, c: number, lift = 0) {
  'worklet';
  const p = lat * D;
  const dl = (lng - lng0) * D;
  const p0 = lat0 * D;
  const x = Math.cos(p) * Math.sin(dl);
  const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(dl);
  const v = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(dl);
  const k = r * (1 + lift);
  return { x: c + k * x, y: c - k * y, v };
}

/** Shortest signed longitude difference b - a in degrees (-180..180]. */
function lngDelta(a: number, b: number) {
  'worklet';
  let d = b - a;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/** Point along the great circle from a to b at s (0..1), as lat/lng. */
function greatCircle(a: Place, b: Place, s: number) {
  'worklet';
  const la = a.lat * D; const lo = a.lng * D; const lb = b.lat * D; const lob = b.lng * D;
  const ax = Math.cos(la) * Math.cos(lo); const ay = Math.cos(la) * Math.sin(lo); const az = Math.sin(la);
  const bx = Math.cos(lb) * Math.cos(lob); const by = Math.cos(lb) * Math.sin(lob); const bz = Math.sin(lb);
  const dot = Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz));
  const w = Math.acos(dot);
  if (w < 1e-6) return { lat: a.lat, lng: a.lng };
  const s1 = Math.sin((1 - s) * w) / Math.sin(w);
  const s2 = Math.sin(s * w) / Math.sin(w);
  const x = s1 * ax + s2 * bx; const y = s1 * ay + s2 * by; const z = s1 * az + s2 * bz;
  return { lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / D, lng: Math.atan2(y, x) / D };
}

function ease(t: number) {
  'worklet';
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Phases of the 0..1 timeline. */
function phases(t: number) {
  'worklet';
  const turn = ease(Math.min(1, t / 0.45)); // the world turns
  const fly = ease(Math.min(1, Math.max(0, (t - 0.28) / 0.6))); // postcard travels
  const land = Math.min(1, Math.max(0, (t - 0.86) / 0.14)); // arrival glow
  return { turn, fly, land };
}

export function Globe({
  from, to, size, onArrive,
}: { from: Place; to: Place; size: number; onArrive?: () => void }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const R = size / 2 - 6;
  const C = size / 2;

  // Where the camera ends: halfway between the two cities, so both are on the visible side.
  const dLng = lngDelta(from.lng, to.lng);
  const endLng = from.lng + dLng / 2;
  const endLat = (from.lat + to.lat) / 2 * 0.6;

  useEffect(() => {
    t.value = withTiming(1, { duration: reduced ? 700 : 2100, easing: Easing.linear });
  }, [t, reduced]);

  // One travel haptic at departure, one warm haptic on arrival.
  const depart = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  const arrive = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onArrive?.();
  };
  useAnimatedReaction(
    () => t.value,
    (now, prev) => {
      if (prev === null) return;
      if (prev < 0.3 && now >= 0.3) runOnJS(depart)();
      if (prev < 0.999 && now >= 0.999) runOnJS(arrive)();
    },
  );

  const camera = (tt: number) => {
    'worklet';
    const { turn } = phases(tt);
    const k = reduced ? 1 : turn;
    return { lng0: from.lng + (endLng - from.lng) * k, lat0: from.lat * 0.6 + (endLat - from.lat * 0.6) * k };
  };

  const graticule = useAnimatedProps(() => {
    const { lng0, lat0 } = camera(t.value);
    let d = '';
    for (let m = -180; m < 180; m += 30) {
      let pen = false;
      for (let la = -80; la <= 80; la += 8) {
        const p = project(la, m, lat0, lng0, R, C);
        if (p.v > 0) { d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `; pen = true; } else pen = false;
      }
    }
    for (let la = -60; la <= 60; la += 30) {
      let pen = false;
      for (let m = -180; m <= 180; m += 8) {
        const p = project(la, m, lat0, lng0, R, C);
        if (p.v > 0) { d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `; pen = true; } else pen = false;
      }
    }
    return { d };
  });

  const land = useAnimatedProps(() => {
    const { lng0, lat0 } = camera(t.value);
    let d = '';
    for (const poly of LAND) {
      let visible = 0;
      let seg = '';
      for (let i = 0; i < poly.length; i++) {
        const p = project(poly[i][1], poly[i][0], lat0, lng0, R, C);
        let x = p.x; let y = p.y;
        if (p.v <= 0) {
          // behind the globe: pin the point to the horizon so shapes wrap the edge
          const dx = x - C; const dy = y - C; const len = Math.sqrt(dx * dx + dy * dy) || 1;
          x = C + (dx / len) * R; y = C + (dy / len) * R;
        } else visible++;
        seg += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
      }
      if (visible > 0) d += `${seg}Z `;
    }
    return { d };
  });

  const route = useAnimatedProps(() => {
    const { lng0, lat0 } = camera(t.value);
    const { fly } = phases(t.value);
    const steps = 40;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const s = (i / steps) * fly;
      const g = greatCircle(from, to, s);
      const p = project(g.lat, g.lng, lat0, lng0, R, C, Math.sin(Math.PI * s) * 0.14);
      d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    }
    return { d, opacity: fly > 0.01 ? 1 : 0 };
  });

  const fromPin = useAnimatedProps(() => {
    const { lng0, lat0 } = camera(t.value);
    const p = project(from.lat, from.lng, lat0, lng0, R, C);
    return { cx: p.x, cy: p.y, opacity: p.v > 0 ? 1 : 0 };
  });
  const toPin = useAnimatedProps(() => {
    const { lng0, lat0 } = camera(t.value);
    const p = project(to.lat, to.lng, lat0, lng0, R, C);
    return { cx: p.x, cy: p.y, opacity: p.v > 0.05 ? 1 : 0 };
  });
  const toGlow = useAnimatedProps(() => {
    const { lng0, lat0 } = camera(t.value);
    const { land: l } = phases(t.value);
    const p = project(to.lat, to.lng, lat0, lng0, R, C);
    return { cx: p.x, cy: p.y, r: 6 + l * 12, opacity: p.v > 0 ? l * 0.45 : 0 };
  });

  // The postcard rides the route, tilting with its heading; its shadow drops as it lifts.
  const cardStyle = useAnimatedStyle(() => {
    const { lng0, lat0 } = camera(t.value);
    const { fly } = phases(t.value);
    const lift = Math.sin(Math.PI * fly) * 0.14;
    const g = greatCircle(from, to, fly);
    const g2 = greatCircle(from, to, Math.min(1, fly + 0.02));
    const p = project(g.lat, g.lng, lat0, lng0, R, C, lift);
    const q = project(g2.lat, g2.lng, lat0, lng0, R, C, lift);
    const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    if (COZY.crane) {
      // the crane flies nose-first along the route with your postcard hanging beneath it
      const east = q.x >= p.x;
      const heading = east ? angle : angle > 0 ? angle - 180 : angle + 180;
      return {
        opacity: fly > 0.01 && fly < 1 ? 1 : 0,
        transform: [{ translateX: p.x - 19 }, { translateY: p.y - 24 }, { rotate: `${heading * 0.3}deg` }, { scaleX: east ? -1 : 1 }, { scale: 1 + lift * 1.2 }],
      };
    }
    return {
      opacity: fly > 0.01 && fly < 1 ? 1 : fly >= 1 ? 0 : 0,
      transform: [{ translateX: p.x - 11 }, { translateY: p.y - 8 }, { rotate: `${angle * 0.35}deg` }, { scale: 1 + lift * 1.6 }],
      shadowOffset: { width: 0, height: 2 + lift * 40 },
    };
  });

  // A soft shadow that slides across the sphere as it turns, selling the depth.
  const shade = useAnimatedProps(() => {
    const { turn } = phases(t.value);
    return { cx: C + R * 0.35 - turn * R * 0.25 };
  });

  return (
    <Pressable
      accessibilityLabel="Your postcard is flying. Tap to skip."
      onPress={() => {
        t.value = withTiming(1, { duration: 120 });
      }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id="globeClip">
            <Circle cx={C} cy={C} r={R} />
          </ClipPath>
          <RadialGradient id="globeShade" cx="50%" cy="50%" r="50%">
            <Stop offset="0.62" stopColor="#2A1A0E" stopOpacity="0" />
            <Stop offset="1" stopColor="#2A1A0E" stopOpacity="0.38" />
          </RadialGradient>
          <RadialGradient id="globeLight" cx="35%" cy="30%" r="60%">
            <Stop offset="0" stopColor="#FFF9ED" stopOpacity="0.45" />
            <Stop offset="1" stopColor="#FFF9ED" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {/* soft cast shadow on the desk */}
        <Circle cx={C + 2} cy={C + 5} r={R + 1} fill="#2A1A0E" opacity={0.08} />
        {/* ocean paper */}
        <Circle cx={C} cy={C} r={R} fill="#C7D3CF" />
        <AnimatedPath animatedProps={graticule} fill="none" stroke="rgba(110,68,41,0.22)" strokeWidth={0.8} />
        <AnimatedPath animatedProps={land} fill="#E8D8B2" stroke="rgba(110,68,41,0.55)" strokeWidth={0.9} strokeLinejoin="round" />
        <G clipPath="url(#globeClip)">
          <AnimatedCircle animatedProps={shade} cy={C} r={R * 1.05} fill="#2A1A0E" opacity={0.06} />
        </G>
        <Circle cx={C} cy={C} r={R} fill="url(#globeLight)" />
        <Circle cx={C} cy={C} r={R} fill="url(#globeShade)" />
        <Circle cx={C} cy={C} r={R} fill="none" stroke={colors.walnut} strokeWidth={1.5} opacity={0.6} />
        {/* stitched route */}
        <AnimatedG>
          <AnimatedPath animatedProps={route} fill="none" stroke={colors.terracotta} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
        </AnimatedG>
        <AnimatedCircle animatedProps={toGlow} fill={colors.light} />
        <AnimatedCircle animatedProps={fromPin} r={5} fill={colors.terracotta} stroke="#FFF9ED" strokeWidth={1.5} />
        <AnimatedCircle animatedProps={toPin} r={5} fill={colors.walnut} stroke="#FFF9ED" strokeWidth={1.5} />
      </Svg>
      {COZY.crane ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: 38, height: 40 }, cardStyle]}>
          <Crane size={38} mood="fly" perched={false} />
          {/* your postcard, held in its beak and hanging below */}
          <View style={{ position: 'absolute', left: 9, top: 26, width: 13, height: 9, padding: 1.5, borderRadius: 1, backgroundColor: '#FFF9ED', transform: [{ rotate: '8deg' }], shadowColor: '#2A1A0E', shadowOpacity: 0.3, shadowRadius: 2, shadowOffset: { width: 0, height: 2 } }}>
            <View style={{ flex: 1, backgroundColor: colors.terracotta, opacity: 0.85 }} />
          </View>
        </Animated.View>
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, top: 0, width: 22, height: 16, padding: 2, borderRadius: 2, backgroundColor: '#FFF9ED', shadowColor: '#2A1A0E', shadowOpacity: 0.3, shadowRadius: 3, elevation: 4 },
            cardStyle,
          ]}
        >
          <View style={{ flex: 1, backgroundColor: colors.terracotta, opacity: 0.85 }} />
        </Animated.View>
      )}
    </Pressable>
  );
}
