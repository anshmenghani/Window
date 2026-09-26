// The little illustrated street scene from the design canvas, in a few color moods.
// Used on Welcome and as a placeholder before real photos load.
//
// Pass `where` and the scene shows that city's real sky right now: the sun sits where it
// actually is in their day (rising from behind the hills, gone at night), and after dark
// the moon is drawn in tonight's real phase.
import Svg, { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { getMoonIllumination } from 'suncalc';
import { skyNow } from '@/lib/sky';

export type Mood = 'morning' | 'sunset' | 'night';

const MOODS: Record<Mood, { sky: [string, string, string]; sun: string; hills: string; far: string; wall: string; shop: string; road: string }> = {
  morning: { sky: ['#C9D6DE', '#EFD9BC', '#F3E3C8'], sun: '#FFF4DA', hills: '#B8B49B', far: '#5A3E2E', wall: '#7A5A45', shop: '#EFE3CC', road: '#8C7B66' },
  sunset: { sky: ['#E9B98F', '#D59B42', '#B9583D'], sun: '#FFF1D6', hills: '#9E6A4E', far: '#4A2D1B', wall: '#6E4429', shop: '#EAD2B0', road: '#6B4A38' },
  night: { sky: ['#1E1C22', '#2E2A36', '#453C4A'], sun: '#F3E9D2', hills: '#3A3440', far: '#1E1C22', wall: '#2B2830', shop: '#3A3440', road: '#26232B' },
};

type Where = { lat: number; lng: number; tz: string };

export function CityScene({
  mood: moodProp = 'morning', bike = true, id = 'scene', where, now = new Date(),
}: { mood?: Mood; bike?: boolean; id?: string; where?: Where; now?: Date }) {
  const sky = where ? skyNow(where.lat, where.lng, where.tz, now) : null;
  const mood: Mood = !sky ? moodProp
    : sky.phase === 'night' ? 'night'
      : sky.phase === 'golden' || sky.phase === 'dusk' ? 'sunset'
        : 'morning';
  const m = MOODS[mood];
  const gid = `sky-${id}-${mood}`;

  // Sun: along an arc from behind the left hills (sunrise) to behind the right ones (sunset).
  // Without a real place, no sun is drawn at all; a disc that means nothing is just decoration.
  let sun: { x: number; y: number } | null = null;
  if (sky?.isDay) {
    const t = Math.min(1, Math.max(0, sky.progress));
    sun = { x: 34 + t * 232, y: 206 - Math.sin(Math.PI * t) * 140 };
  }

  // Moon (night only): tonight's phase. The shadow disc slides off as the moon fills.
  const moon = sky?.phase === 'night' ? getMoonIllumination(now) : null;
  const R = 13;
  const shadowDx = moon ? (moon.phase < 0.5 ? -1 : 1) * 2 * R * moon.fraction : 0;

  return (
    <Svg viewBox="0 0 300 380" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={m.sky[0]} />
          <Stop offset="0.55" stopColor={m.sky[1]} />
          <Stop offset="1" stopColor={m.sky[2]} />
        </LinearGradient>
        {moon ? (
          <Mask id={`moon-${id}`}>
            <Circle cx={196} cy={88} r={R} fill="#fff" />
            <Circle cx={196 + shadowDx} cy={88} r={R} fill="#000" />
          </Mask>
        ) : null}
      </Defs>
      <Rect width="300" height="380" fill={`url(#${gid})`} />
      {sun ? <Circle cx={sun.x} cy={sun.y} r={22} fill={m.sun} /> : null}
      {moon && moon.fraction > 0.04 ? (
        <>
          {/* the unlit part, barely there, so a thin crescent still reads as the moon */}
          <Circle cx={196} cy={88} r={R} fill="#F3E9D2" opacity={0.07} />
          <Circle cx={196} cy={88} r={R} fill={m.sun} mask={`url(#moon-${id})`} />
        </>
      ) : null}
      <Path d="M0 212 L60 172 L110 196 L170 150 L232 192 L300 166 L300 262 L0 262 Z" fill={m.hills} />
      <Path d="M-10 252 L60 228 L132 252 Z" fill={m.far} />
      <Rect x="0" y="252" width="122" height="128" fill={m.wall} />
      <Rect x="44" y="290" width="32" height="38" fill="#E8B764" />
      <Rect x="18" y="264" width="14" height="22" rx="7" fill="#B9583D" />
      <Rect x="88" y="264" width="14" height="22" rx="7" fill="#B9583D" />
      <Rect x="150" y="240" width="160" height="12" fill={m.far} />
      <Rect x="150" y="252" width="160" height="128" fill={m.shop} />
      <Rect x="150" y="258" width="160" height="14" fill="#6F7B57" />
      <Rect x="160" y="282" width="60" height="68" rx="3" fill="#D59B42" />
      <Rect x="230" y="282" width="60" height="68" rx="3" fill="#D59B42" />
      <Rect y="352" width="300" height="28" fill={m.road} />
      {bike ? (
        <G fill="none" stroke="#2E2A26" strokeWidth={3}>
          <Circle cx="118" cy="352" r="14" />
          <Circle cx="160" cy="352" r="14" />
          <Path d="M118 352 L135 330 L160 352 M135 330 L152 330 M128 328 L142 328" />
        </G>
      ) : null}
    </Svg>
  );
}
