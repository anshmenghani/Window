// "Their sky right now": where the sun is for someone's city.
import { getTimes } from 'suncalc';
import { hourIn } from './time';

export type SkyPhase = 'night' | 'dawn' | 'day' | 'golden' | 'dusk';

export type Sky = {
  phase: SkyPhase;
  /** 0 at sunrise → 1 at sunset. Only meaningful during the day. */
  progress: number;
  label: string;
  /** Top and bottom colors for a sky gradient. */
  colors: [string, string];
  isDay: boolean;
};

const PALETTE: Record<SkyPhase, [string, string]> = {
  night: ['#1D2240', '#3A4378'],
  dawn: ['#F4C7A1', '#BFD3F2'],
  day: ['#BFD3F2', '#F6DCC0'],
  golden: ['#F6DCC0', '#F2B84B'],
  dusk: ['#5563B8', '#D9573F'],
};

function label(tz: string): string {
  const h = hourIn(tz);
  if (h >= 5 && h < 9) return 'Early morning';
  if (h >= 9 && h < 11) return 'Morning';
  if (h >= 11 && h < 14) return 'Midday, lunch break';
  if (h >= 14 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  if (h >= 21 && h < 24) return 'Night';
  return 'Night, probably asleep';
}

export function skyNow(lat: number, lng: number, tz: string, now = new Date()): Sky {
  const t = now.getTime();
  // suncalc gives times for one solar day, so check yesterday, today and tomorrow
  // and use whichever day "now" falls inside.
  for (const offset of [-1, 0, 1]) {
    const times = getTimes(new Date(t + offset * 86400000), lat, lng);
    const { dawn, sunrise, sunset, dusk, goldenHour } = times;
    if (!sunrise || !sunset) continue;
    const rise = sunrise.getTime();
    const set = sunset.getTime();
    if (t >= rise && t <= set) {
      const progress = (t - rise) / (set - rise);
      const phase: SkyPhase = goldenHour && t >= goldenHour.getTime() ? 'golden' : 'day';
      return { phase, progress, label: label(tz), colors: PALETTE[phase], isDay: true };
    }
    if (dawn && t >= dawn.getTime() && t < rise) {
      return { phase: 'dawn', progress: 0, label: 'Sunrise soon', colors: PALETTE.dawn, isDay: false };
    }
    if (dusk && t > set && t <= dusk.getTime()) {
      return { phase: 'dusk', progress: 1, label: 'Just after sunset', colors: PALETTE.dusk, isDay: false };
    }
  }
  return { phase: 'night', progress: 0, label: label(tz), colors: PALETTE.night, isDay: false };
}
