// Small line icons drawn with react-native-svg (matching the design canvas).
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/lib/theme';

type P = { size?: number; color?: string; width?: number };

export function BackIcon({ size = 20, color = colors.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12.5 4 6.5 10l6 6" />
    </Svg>
  );
}

export function CloseIcon({ size = 18, color = colors.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Path d="m4 4 10 10M14 4 4 14" />
    </Svg>
  );
}

export function CheckIcon({ size = 14, color = colors.white, width = 2.4 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m2.5 7.5 3 3 6-7" />
    </Svg>
  );
}

export function WindowLogo({ size = 28, color = colors.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none" stroke={color} strokeWidth={2.2}>
      <Path d="M5 25V12a9 9 0 0 1 18 0v13z" />
      <Path d="M14 4v21M5 15h18" />
    </Svg>
  );
}

export function FlipIcon({ size = 20, color = colors.postcard }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 8a7 7 0 0 1 12.5-3.5L17 6M17 2v4h-4M17 12a7 7 0 0 1-12.5 3.5L3 14M3 18v-4h4" />
    </Svg>
  );
}

export function MicIcon({ size = 24, color = colors.postcard }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Rect x={8} y={3} width={8} height={12} rx={4} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Svg>
  );
}

export function CameraIcon({ size = 26, color = colors.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2.3l1.7-2.5h7l1.7 2.5h2.3A2.5 2.5 0 0 1 23 8.5v11A2.5 2.5 0 0 1 20.5 22h-15A2.5 2.5 0 0 1 3 19.5z" />
      <Circle cx={13} cy={14} r={4.5} />
    </Svg>
  );
}

export function SendIcon({ size = 24, color = colors.ink }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function PhotosIcon({ size = 22, color = colors.postcard }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={4} width={16} height={14} rx={3} />
      <Circle cx={8} cy={9} r={1.6} />
      <Path d="m4 16 5-5 4 4 2-2 4 4" />
    </Svg>
  );
}

export function PlayIcon({ size = 16, color = colors.white }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Path d="M4 2.5v11l9-5.5z" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 16, color = colors.white }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Rect x={3.5} y={2.5} width={3} height={11} rx={1} fill={color} />
      <Rect x={9.5} y={2.5} width={3} height={11} rx={1} fill={color} />
    </Svg>
  );
}

export function PinIcon({ size = 22, color = colors.dusk }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M11 20s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" />
      <Circle cx={11} cy={9} r={2.5} />
    </Svg>
  );
}

export function SearchIcon({ size = 20, color = colors.muted }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={9} cy={9} r={6} />
      <Path d="m14 14 4 4" />
    </Svg>
  );
}

export function SunIcon({ size = 16, color = colors.lightShadow }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={8} cy={8} r={3} />
      <Path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" />
    </Svg>
  );
}

export function BulbIcon({ size = 18, color = colors.honeyText }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Path d="M6.5 13.5h5M7.5 16h3M9 2a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9z" />
    </Svg>
  );
}

export function ShieldIcon({ size = 20, color = colors.dusk }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M10 2 3 5v5c0 4 3 7 7 8 4-1 7-4 7-8V5z" />
    </Svg>
  );
}

export function LockIcon({ size = 20, color = colors.dusk }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2}>
      <Rect x={4} y={9} width={12} height={9} rx={2} />
      <Path d="M7 9V6a3 3 0 0 1 6 0v3" />
    </Svg>
  );
}

export function LocationIcon({ size = 20, color = colors.dusk }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M10 18s6-5.4 6-10a6 6 0 0 0-12 0c0 4.6 6 10 6 10z" />
    </Svg>
  );
}

export function FlagIcon({ size = 20, color = colors.danger }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M4 18V3h10l-2 4 2 4H4" />
    </Svg>
  );
}

export function KnockIcon({ size = 22, color = colors.ink }: P) {
  // a fist knocking, with two motion lines
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 10V7.5a1.5 1.5 0 0 1 3 0V10M11 9.5V7a1.5 1.5 0 0 1 3 0v3M14 10V8a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6H10a5 5 0 0 1-5-5v-2a2 2 0 0 1 2-2h4" />
      <Path d="M3 5l2 1.5M2 9.5h2.5" />
    </Svg>
  );
}

// ----- tab bar icons -----
export function TodayTabIcon({ size = 22, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M4 20V10a7 7 0 0 1 14 0v10z" />
      <Path d="M11 3v17M4 13h14" />
    </Svg>
  );
}
export function WallTabIcon({ size = 22, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2}>
      <Path d="M2 5l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <Path d="M8 3v14M14 5v14" />
    </Svg>
  );
}
export function PassportTabIcon({ size = 22, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2}>
      <Rect x={4} y={2} width={14} height={18} rx={2} />
      <Circle cx={11} cy={10} r={3.5} />
      <Path d="M8 16h6" />
    </Svg>
  );
}
export function YouTabIcon({ size = 22, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={11} cy={7.5} r={4} />
      <Path d="M3 20a8 8 0 0 1 16 0" />
    </Svg>
  );
}
/** A pushpin, for the Wall. */
export function PushpinTabIcon({ size = 22, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M13.8 2.6l5.6 5.6" />
      <Path d="M16.2 5l-4.2 4.2-3.7-.4-1.7 1.7 6.3 6.3 1.7-1.7-.4-3.7 4.2-4.2" />
      <Path d="M10.1 14L3.4 20.7" />
    </Svg>
  );
}
/** A luggage name tag on a string, for You. */
export function NameTagTabIcon({ size = 22, color }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 9L8 2.5M11 9l3-6.5" />
      <Rect x={3.5} y={8} width={15} height={12} rx={2} />
      <Circle cx={11} cy={11} r={0.9} />
      <Path d="M7.5 15h7M8.5 17.5h5" />
    </Svg>
  );
}
