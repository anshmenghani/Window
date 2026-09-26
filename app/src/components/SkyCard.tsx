// "Isha's sky right now": a narrow paper strip with a hand-drawn sun path across their day.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, fonts, radius } from '@/lib/theme';
import { skyNow } from '@/lib/sky';
import { timeIn } from '@/lib/time';
import type { Profile } from '@/lib/types';

const W = 318;

// Point on the curve M10 44 Q159 -16 308 44 at t (0..1)
function point(t: number) {
  const x = (1 - t) ** 2 * 10 + 2 * (1 - t) * t * 159 + t ** 2 * 308;
  const y = (1 - t) ** 2 * 44 + 2 * (1 - t) * t * -16 + t ** 2 * 44;
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
  const night = !sky.isDay;

  return (
    <View style={{ borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 14, gap: 4, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.walnut }}>
          {person.name}&apos;s sky right now
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>{timeIn(person.tz, now)} · {person.home_city}</Text>
      </View>
      <Svg viewBox={`0 0 ${W} 52`} width="100%" height={52}>
        {/* the day's path, drawn like a pen line */}
        <Path d="M10 44 Q159 -16 308 44" fill="none" stroke={colors.dash} strokeWidth={1.4} strokeDasharray="2 5" strokeLinecap="round" />
        <Line x1={0} y1={44} x2={W} y2={44} stroke={colors.line} strokeWidth={1.2} />
        {night ? (
          <>
            <Circle cx={159} cy={30} r={8} fill={colors.hand} />
            <Circle cx={163} cy={27} r={7} fill={colors.postcard} />
          </>
        ) : (
          <>
            <Circle cx={p.x} cy={p.y} r={11} fill={colors.light} opacity={0.22} />
            <Circle cx={p.x} cy={p.y} r={6.5} fill={colors.light} />
          </>
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>sunrise</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.ink }}>{sky.label}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>sunset</Text>
      </View>
    </View>
  );
}
