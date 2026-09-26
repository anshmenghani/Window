// How close two pen pals have become. Worked out only from what they've actually done
// together, so it's honest: letters exchanged, daily prompts you both answered, voice notes.
// The server uses the same thresholds (server/ai.py BOND_LEVELS) to deepen the daily prompts.
import type { Bond, BondLevel } from './types';

export const BOND_LEVELS: { level: BondLevel; name: string; letters: number; together: number }[] = [
  { level: 1, name: 'New pen pals', letters: 0, together: 0 },
  { level: 2, name: 'Regular correspondents', letters: 4, together: 1 },
  { level: 3, name: 'Close pen pals', letters: 12, together: 3 },
  { level: 4, name: 'Old friends', letters: 30, together: 8 },
];

export function bondFrom(letters: number, together: number, voices: number, days: number): Bond {
  let i = 0;
  while (i + 1 < BOND_LEVELS.length && letters >= BOND_LEVELS[i + 1].letters && together >= BOND_LEVELS[i + 1].together) i++;
  const next = BOND_LEVELS[i + 1];
  const progress = next
    ? Math.min(1, (Math.min(1, letters / next.letters) + Math.min(1, together / next.together)) / 2)
    : 1;
  return { level: BOND_LEVELS[i].level, name: BOND_LEVELS[i].name, next: next?.name, progress, letters, together, voices, days };
}
