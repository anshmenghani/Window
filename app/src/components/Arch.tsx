// The arch window: the brand shape. Every photo sits in one, with a cross-shaped frame.
import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, shadow } from '@/lib/theme';

type ArchProps = {
  width: number;
  height: number;
  border?: number; // frame thickness
  frameColor?: string;
  bottomRadius?: number;
  bars?: boolean; // the cross in the middle
  barWidth?: number;
  barColor?: string;
  lifted?: boolean; // drop shadow
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /**
   * Set this to the color behind the arch when the child is a camera preview.
   * On Android the camera ignores rounded clipping, so we paint over the corners instead.
   */
  maskColor?: string;
};

export function Arch({
  width, height, border = 8, frameColor = colors.postcard, bottomRadius = 18, bars = false,
  barWidth = 6, barColor, lifted = true, style, children, maskColor,
}: ArchProps) {
  const r = width / 2;
  return (
    <View
      style={[
        { width, height, borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius },
        lifted && shadow.card,
        { backgroundColor: frameColor },
        style,
      ]}
    >
      <View
        style={{
          flex: 1, overflow: 'hidden', borderWidth: border, borderColor: frameColor,
          borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomLeftRadius: bottomRadius, borderBottomRightRadius: bottomRadius,
          backgroundColor: colors.line,
        }}
      >
        {children}
        {bars ? (
          <>
            <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: barWidth, marginLeft: -barWidth / 2, backgroundColor: barColor ?? frameColor }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '46%', height: barWidth, backgroundColor: barColor ?? frameColor }} />
          </>
        ) : null}
      </View>
      {maskColor ? <ArchMask width={width} height={height} border={border} frameColor={frameColor} bottomRadius={bottomRadius} maskColor={maskColor} /> : null}
    </View>
  );
}

function archPath(x: number, y: number, w: number, h: number, rb: number) {
  const r = w / 2;
  return `M${x} ${y + r} A${r} ${r} 0 0 1 ${x + w} ${y + r} L${x + w} ${y + h - rb} Q${x + w} ${y + h} ${x + w - rb} ${y + h} L${x + rb} ${y + h} Q${x} ${y + h} ${x} ${y + h - rb} Z`;
}

/** Paints the area outside the arch plus the frame, on top of a rectangular child. */
function ArchMask({
  width, height, border, frameColor, bottomRadius, maskColor,
}: { width: number; height: number; border: number; frameColor: string; bottomRadius: number; maskColor: string }) {
  const outer = archPath(0, 0, width, height, bottomRadius);
  const inset = archPath(border / 2, border / 2, width - border, height - border, Math.max(0, bottomRadius - border / 2));
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Path d={`M0 0 H${width} V${height} H0 Z ${outer}`} fill={maskColor} fillRule="evenodd" />
      <Path d={inset} fill="none" stroke={frameColor} strokeWidth={border} />
    </Svg>
  );
}
