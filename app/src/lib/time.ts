// Time-zone helpers. Everything takes an IANA time zone like 'Asia/Tokyo'.

function parts(tz: string, date: Date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of f.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Minutes this time zone is ahead of UTC right now (e.g. Tokyo = +540). */
export function offsetMinutes(tz: string, date = new Date()): number {
  try {
    const p = parts(tz, date);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch {
    return -date.getTimezoneOffset();
  }
}

/** "12:42 PM" in that time zone. */
export function timeIn(tz: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

/** Hour of day (0–23) in that time zone. */
export function hourIn(tz: string, date = new Date()): number {
  try {
    return parts(tz, date).hour % 24;
  } catch {
    return date.getHours();
  }
}

/** 'YYYY-MM-DD' in that time zone. Used for "one window per day". */
export function localDate(tz: string, date = new Date()): string {
  try {
    const p = parts(tz, date);
    return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** "13 h ahead", "5 h behind", or "same time". */
export function aheadText(fromTz: string, toTz: string): string {
  const diff = (offsetMinutes(toTz) - offsetMinutes(fromTz)) / 60;
  if (diff === 0) return 'same time';
  const n = Number.isInteger(diff) ? Math.abs(diff) : Math.abs(diff).toFixed(1);
  return diff > 0 ? `${n} h ahead` : `${n} h behind`;
}

/** 'tomorrow' / 'yesterday' / '' comparing their calendar date to yours. */
export function dayWord(fromTz: string, toTz: string): string {
  const a = localDate(fromTz);
  const b = localDate(toTz);
  if (a === b) return '';
  return b > a ? 'tomorrow' : 'yesterday';
}

/** "12:42 PM tomorrow · 13 h ahead" */
export function clockLine(fromTz: string, toTz: string): string {
  const word = dayWord(fromTz, toTz);
  return `${timeIn(toTz)}${word ? ' ' + word : ''} · ${aheadText(fromTz, toTz)}`;
}

/** "Friday, Sep 25" */
export function longDate(tz: string, date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  } catch {
    return date.toDateString();
  }
}

/** "Sep 22 · 6:10 AM" in that time zone. */
export function stampLine(iso: string, tz: string): string {
  const d = new Date(iso);
  try {
    const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric' }).format(d);
    return `${day} · ${timeIn(tz, d)}`;
  } catch {
    return d.toLocaleString();
  }
}

/** "2 min ago", "3 h ago", "2 days ago" */
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Whole days since a date, counting the first day as Day 1. */
export function dayNumber(iso: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) + 1);
}

/** Straight-line distance between two cities in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Round to a friendly number: 11,247 → "11,000". */
export function roundKm(km: number): string {
  const r = km > 2000 ? Math.round(km / 1000) * 1000 : Math.round(km / 100) * 100;
  return r.toLocaleString('en-US');
}
