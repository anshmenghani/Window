// Physical materials: paper grain, walnut wood, washi tape, thumbtacks, brass.
// Used sparingly: grain goes only on paper that is meant to be touched (postcards, the passport,
// a received note), never as a wash over whole screens or buttons.
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, textures } from '@/lib/theme';

/** Faint paper fibers over whatever is behind (tileable). */
export function PaperGrain({ opacity = 0.5, style }: { opacity?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Image source={textures.paper} resizeMode="repeat" style={[{ width: '100%', height: '100%', opacity }, style]} />
    </View>
  );
}

/** Walnut grain filling its parent. `shade` darkens it for night scenes. */
export function Wood({ shade = 0, style }: { shade?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, style]}>
      <Image source={textures.walnut} resizeMode="repeat" style={{ width: '100%', height: '100%' }} />
      {/* a soft top light and bottom falloff so it reads as a rounded, oiled piece of wood */}
      <LinearGradient
        colors={['rgba(255,226,190,0.18)', 'rgba(255,226,190,0)', `rgba(20,10,4,${0.22 + shade})`]}
        locations={[0, 0.35, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </View>
  );
}

/** A strip of translucent tape, e.g. holding a label to a frame. */
export function Tape({ width = 54, rotate = -8, style }: { width?: number; rotate?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[
        { width, height: 18, backgroundColor: 'rgba(239,224,194,0.72)', transform: [{ rotate: `${rotate}deg` }] },
        { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(110,68,41,0.08)' },
        style,
      ]}
    />
  );
}

/** A round thumbtack head with a little highlight. */
export function Thumbtack({ color = colors.terracotta, size = 14, style }: { color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          width: size, height: size, borderRadius: size / 2, backgroundColor: color,
          shadowColor: '#2A1A0E', shadowOpacity: 0.35, shadowRadius: 2, shadowOffset: { width: 1, height: 2 }, elevation: 3,
        },
        style,
      ]}
    >
      <View style={{ position: 'absolute', left: size * 0.22, top: size * 0.18, width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.45)' }} />
    </View>
  );
}

/** Brushed brass disc (the knocker). */
export function Brass({ size = 44, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient
        colors={['#E6C97F', '#B98F43', '#8A6528']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: size, borderWidth: 1, borderColor: 'rgba(90,60,20,0.35)' }} />
      {children}
    </View>
  );
}
