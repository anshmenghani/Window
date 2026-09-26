// The little illustrated street scene from the design canvas, in a few color moods.
// Used on Welcome and as a placeholder before real photos load.
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export type Mood = 'morning' | 'sunset' | 'night';

const MOODS: Record<Mood, { sky: [string, string, string]; sun: string; hills: string; far: string; wall: string; shop: string; road: string }> = {
  morning: { sky: ['#BFD3F2', '#F6DCC0', '#F9E7CF'], sun: '#FFF3D6', hills: '#A9B7D8', far: '#2F3356', wall: '#4A4F78', shop: '#EDEFF6', road: '#6A6F95' },
  sunset: { sky: ['#F4C7A1', '#F2B84B', '#D9573F'], sun: '#FFF3D6', hills: '#C98F7A', far: '#5A2F3A', wall: '#6E3F4F', shop: '#F6DCC0', road: '#7A4A58' },
  night: { sky: ['#14183A', '#2A3160', '#434C86'], sun: '#F6F1DC', hills: '#3A4378', far: '#14183A', wall: '#262C58', shop: '#3A4278', road: '#1D2240' },
};

export function CityScene({ mood = 'morning', bike = true, id = 'scene' }: { mood?: Mood; bike?: boolean; id?: string }) {
  const m = MOODS[mood];
  const gid = `sky-${id}-${mood}`;
  return (
    <Svg viewBox="0 0 300 380" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={m.sky[0]} />
          <Stop offset="0.55" stopColor={m.sky[1]} />
          <Stop offset="1" stopColor={m.sky[2]} />
        </LinearGradient>
      </Defs>
      <Rect width="300" height="380" fill={`url(#${gid})`} />
      <Circle cx="222" cy="118" r={mood === 'night' ? 18 : 26} fill={m.sun} />
      <Path d="M0 212 L60 172 L110 196 L170 150 L232 192 L300 166 L300 262 L0 262 Z" fill={m.hills} />
      <Path d="M-10 252 L60 228 L132 252 Z" fill={m.far} />
      <Rect x="0" y="252" width="122" height="128" fill={m.wall} />
      <Rect x="44" y="290" width="32" height="38" fill="#F7D48A" />
      <Rect x="18" y="264" width="14" height="22" rx="7" fill="#D9573F" />
      <Rect x="88" y="264" width="14" height="22" rx="7" fill="#D9573F" />
      <Rect x="150" y="240" width="160" height="12" fill={m.far} />
      <Rect x="150" y="252" width="160" height="128" fill={m.shop} />
      <Rect x="150" y="258" width="160" height="14" fill="#5563B8" />
      <Rect x="160" y="282" width="60" height="68" rx="3" fill="#F2B84B" />
      <Rect x="230" y="282" width="60" height="68" rx="3" fill="#F2B84B" />
      <Rect y="352" width="300" height="28" fill={m.road} />
      {bike ? (
        <G fill="none" stroke="#1D2240" strokeWidth={3}>
          <Circle cx="118" cy="352" r="14" />
          <Circle cx="160" cy="352" r="14" />
          <Path d="M118 352 L135 330 L160 352 M135 330 L152 330 M128 328 L142 328" />
        </G>
      ) : null}
    </Svg>
  );
}
