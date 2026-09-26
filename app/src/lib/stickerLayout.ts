// Where each word label goes on a photo, so labels never overlap each other or cover another object.
import type { Sticker } from '@/lib/types';

const LEADER = 22; // gap between the object and its tag
const TAG_H = 46;
const PAD = 8; // keep tags this far inside the photo
const GAP = 10; // minimum space between two tags

export type StickerPlace = { dotX: number; dotY: number; left: number; top: number; w: number; h: number };
type Rect = { left: number; top: number; w: number; h: number };

export const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const overlaps = (a: Rect, b: Rect) =>
  a.left < b.left + b.w + GAP && b.left < a.left + a.w + GAP && a.top < b.top + b.h + GAP && b.top < a.top + a.h + GAP;

// Rough text width (no measuring before layout): wide characters for CJK scripts, narrower for Latin.
function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.56;
  return w;
}

/**
 * Places every tag at once so none overlap each other or cover another sticker's dot.
 * Each tag tries above its object, then below, right and left, then slides up or down.
 */
export function layoutStickers(stickers: Sticker[], boxW: number, boxH: number): StickerPlace[] {
  const placed: StickerPlace[] = [];
  const dots = stickers.map((s) => ({ x: clamp(s.x * boxW, 20, boxW - 20), y: clamp(s.y * boxH, 20, boxH - 20) }));
  const blockers: Rect[] = dots.map((d) => ({ left: d.x - 6, top: d.y - 6, w: 12, h: 12 }));
  stickers.forEach((s, i) => {
    const { x: dotX, y: dotY } = dots[i];
    const w = clamp(Math.max(textWidth(s.word, 15), textWidth(`${s.reading} · ${s.meaning}`, 11.5)) + 26, 72, boxW * 0.62);
    const h = TAG_H;
    const centered = clamp(dotX - w / 2, PAD, boxW - w - PAD);
    const bases: Rect[] = [
      { left: centered, top: dotY - LEADER - h, w, h }, // above
      { left: centered, top: dotY + LEADER, w, h }, // below
      { left: clamp(dotX + LEADER, PAD, boxW - w - PAD), top: dotY - h / 2, w, h }, // right
      { left: clamp(dotX - LEADER - w, PAD, boxW - w - PAD), top: dotY - h / 2, w, h }, // left
    ];
    const free = (r: Rect) =>
      r.top >= PAD && r.top + r.h <= boxH - PAD &&
      !placed.some((p) => overlaps(p, r)) &&
      !blockers.some((b, j) => j !== i && overlaps(b, r));
    let spot = bases.find(free);
    // still crowded: slide the tag up or down near its object until it fits
    for (let step = 1; !spot && step < 20; step++) {
      for (const dir of [-1, 1]) {
        const r = { ...bases[0], top: bases[0].top + dir * step * (h / 2) };
        if (free(r)) { spot = r; break; }
      }
    }
    const r = spot ?? { ...bases[0], top: clamp(bases[0].top, PAD, boxH - h - PAD) };
    placed.push({ dotX, dotY, left: r.left, top: r.top, w, h });
  });
  return placed;
}

