// The arch window: the brand shape. A slim walnut frame with a bevelled inner edge,
// the photo set inside it, optional cross bars (muntins), casting a soft shadow downward.
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors, shadow } from '@/lib/theme';
import { Wood } from './materials';

type ArchProps = {
  width: number;
  height: number;
  border?: number; // frame thickness
  bottomRadius?: number;
  bars?: boolean; // cross-shaped window bars
  barWidth?: number;
  lifted?: boolean; // cast shadow
  dark?: boolean; // deeper walnut for night scenes
  glass?: boolean; // faint reflection across the glass
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /**
   * Set to the color behind the arch when the child is a camera preview.
   * On Android the camera ignores rounded clipping, so the corners are painted over instead.
   */
  maskColor?: string;
};

export function Arch({
  width, height, border = 9, bottomRadius = 10, bars = false, barWidth = 6,
  lifted = true, dark = false, glass = false, style, children, maskColor,
}: ArchProps) {
  const r = width / 2;
  const innerR = r - border;
  const innerBottom = Math.max(2, bottomRadius - border / 2);
  return (
    <View
      style={[
        { width, height, borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius, backgroundColor: colors.walnut },
        lifted && shadow.frame,
        style,
      ]}
    >
      {/* the wooden frame */}
      <View style={{ flex: 1, overflow: 'hidden', borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius }}>
        <Wood shade={dark ? 0.35 : 0} />
        {/* outer edge highlight */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderColor: 'rgba(255,225,190,0.22)', borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius }} />
        {/* the opening */}
        <View
          style={{
            position: 'absolute', top: border, left: border, right: border, bottom: border, overflow: 'hidden',
            borderTopLeftRadius: innerR, borderTopRightRadius: innerR, borderBottomLeftRadius: innerBottom, borderBottomRightRadius: innerBottom,
            backgroundColor: colors.oldPaper,
          }}
        >
          {children}
          {glass ? (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
              locations={[0.25, 0.42, 0.6]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
          ) : null}
          {bars ? (
            <>
              <View pointerEvents="none" style={[{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: barWidth, marginLeft: -barWidth / 2, overflow: 'hidden' }, shadow.soft]}>
                <Wood shade={dark ? 0.35 : 0.05} />
              </View>
              <View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: '46%', height: barWidth, overflow: 'hidden' }, shadow.soft]}>
                <Wood shade={dark ? 0.35 : 0.05} />
              </View>
            </>
          ) : null}
          {/* bevel: the frame's inner edge throws a thin shadow onto the glass */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1.5, borderColor: 'rgba(30,16,6,0.45)',
              borderTopLeftRadius: innerR, borderTopRightRadius: innerR, borderBottomLeftRadius: innerBottom, borderBottomRightRadius: innerBottom,
            }}
          />
        </View>
      </View>
      {maskColor ? <ArchMask width={width} height={height} border={border} bottomRadius={bottomRadius} maskColor={maskColor} /> : null}
    </View>
  );
}

function archPath(x: number, y: number, w: number, h: number, rb: number) {
  const r = w / 2;
  return `M${x} ${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} L${x + w} ${y + h - rb} Q${x + w} ${y + h} ${x + w - rb} ${y + h} L${x + rb} ${y + h} Q${x} ${y + h} ${x} ${y + h - rb} Z`;
}

/** Android camera fallback: paints outside the arch (maskColor) and the frame ring (walnut). */
function ArchMask({ width, height, border, bottomRadius, maskColor }: { width: number; height: number; border: number; bottomRadius: number; maskColor: string }) {
  const outer = archPath(0, 0, width, height, bottomRadius);
  const inner = archPath(border, border, width - border * 2, height - border * 2, Math.max(2, bottomRadius - border / 2));
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Path d={`M0 0 H${width} V${height} H0 Z ${outer}`} fill={maskColor} fillRule="evenodd" />
      <Path d={`${outer} ${inner}`} fill={colors.walnutDark} fillRule="evenodd" opacity={0} />
    </Svg>
  );
}
