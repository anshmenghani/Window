// "Aiko's sky right now": the sun's path across their day, with a dot for where it is now.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '@/lib/theme';
import { skyNow } from '@/lib/sky';
import { timeIn } from '@/lib/time';
import type { Profile } from '@/lib/types';
import { Card, T } from './ui';

const W = 318;

// Point on the curve M8 62 Q159 -30 310 62 at t (0..1)
function point(t: number) {
  const x = (1 - t) ** 2 * 8 + 2 * (1 - t) * t * 159 + t ** 2 * 310;
  const y = (1 - t) ** 2 * 62 + 2 * (1 - t) * t * -30 + t ** 2 * 62;
  return { x, y };
}

export function SkyCard({ person }: { person: Profile }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const sky = skyNow(person.lat, person.lng, person.tz, now);
  const t = Math.min(1, Math.max(0, sky.progress));
  const p = point(t);
  // the "travelled so far" part of the arc: split the quadratic curve at t
  const cx = (1 - t) * 8 + t * 159;
  const cy = (1 - t) * 62 + t * -30;

  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="label">{person.name}&apos;s sky right now</T>
        <T variant="small">{timeIn(person.tz, now)} {person.home_city}</T>
      </View>
      <Svg viewBox={`0 0 ${W} 70`} width="100%" height={70}>
        <Path d="M8 62 Q159 -30 310 62" fill="none" stroke={colors.line} strokeWidth={2} strokeDasharray="3 5" />
        {sky.isDay ? (
          <>
            <Path d={`M8 62 Q${cx} ${cy} ${p.x} ${p.y}`} fill="none" stroke={colors.light} strokeWidth={3} strokeLinecap="round" />
            <Circle cx={p.x} cy={p.y} r={9} fill={colors.light} />
          </>
        ) : (
          // moon sitting low when it's night there
          <>
            <Circle cx={sky.phase === 'dawn' ? 22 : sky.phase === 'dusk' ? 296 : 159} cy={48} r={9} fill={sky.phase === 'night' ? colors.hand : colors.lantern} />
            {sky.phase === 'night' ? <Circle cx={163} cy={45} r={7} fill={colors.white} /> : null}
          </>
        )}
        <Line x1={0} y1={62} x2={W} y2={62} stroke="#E3E6EF" strokeWidth={2} />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T variant="small" style={{ fontSize: 12 }}>Sunrise</T>
        <T variant="small" style={{ fontSize: 12, color: colors.ink }}>{sky.label}</T>
        <T variant="small" style={{ fontSize: 12 }}>Sunset</T>
      </View>
    </Card>
  );
}
