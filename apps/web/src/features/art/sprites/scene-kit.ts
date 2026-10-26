import { Canvas, type Pt } from '../draw/canvas';
import type { PixelGrid } from '../grid';
import type { MaterialKey } from '../palette';

export const SCENE_W = 320;
export const SCENE_H = 180;
/** Row where combatants stand; the centre of every battle scene stays clear around it. */
export const FLOOR_Y = 128;
export const SCENE_LAYERS = ['far', 'mid', 'near'] as const;
export type SceneLayer = (typeof SCENE_LAYERS)[number];
export type SceneLayers = Record<SceneLayer, Canvas>;

export const newScene = (): SceneLayers => ({
  far: new Canvas(SCENE_W, SCENE_H),
  mid: new Canvas(SCENE_W, SCENE_H),
  near: new Canvas(SCENE_W, SCENE_H),
});

/** Backgrounds are flat colour bands: no outline, no edge shading. */
export const bakeScene = (s: SceneLayers): Record<SceneLayer, PixelGrid> => ({
  far: s.far.bake({ outline: false, shade: false }),
  mid: s.mid.bake({ outline: false, shade: false }),
  near: s.near.bake({ outline: false, shade: false }),
});

/** Small deterministic random generator so scenes never change between builds. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Horizontal colour bands from y0 down to y1. */
export function bands(c: Canvas, y0: number, y1: number, colors: readonly MaterialKey[], x0 = 0, x1 = SCENE_W): void {
  const h = (y1 - y0) / colors.length;
  colors.forEach((m, i) => c.rect(x0, Math.round(y0 + i * h), x1 - x0, Math.ceil(h) + 1, m));
}

/** A bookshelf: frame, rows of books in random colours, a few gaps. */
export function shelf(
  c: Canvas,
  x: number,
  y: number,
  w: number,
  h: number,
  rand: () => number,
  covers: readonly MaterialKey[],
  frame: MaterialKey = 'fWood5',
  back: MaterialKey = 'fForest',
  rowH = 14,
): void {
  c.rect(x, y, w, h, frame);
  c.rect(x + 2, y + 2, w - 4, h - 4, back);
  for (let ry = y + 2; ry + rowH <= y + h - 2; ry += rowH) {
    c.rect(x + 2, ry + rowH - 2, w - 4, 2, frame);
    let bx = x + 3;
    while (bx < x + w - 6) {
      if (rand() < 0.1) { bx += 2 + Math.floor(rand() * 3); continue; }
      const bw = 2 + Math.floor(rand() * 3);
      const bh = rowH - 5 - Math.floor(rand() * 4);
      const m = covers[Math.floor(rand() * covers.length)] as MaterialKey;
      c.rect(bx, ry + rowH - 2 - bh, bw, bh, m);
      if (bh > 6 && rand() < 0.4) c.rect(bx, ry + rowH - 2 - bh + 2, bw, 1, 'fGold5');
      bx += bw;
    }
  }
}

export function column(c: Canvas, x: number, y0: number, y1: number, w: number, m: MaterialKey, cap: MaterialKey): void {
  c.rect(x, y0, w, y1 - y0, m);
  c.rect(x - 2, y0, w + 4, 4, cap);
  c.rect(x - 2, y1 - 4, w + 4, 4, cap);
  c.rect(x + 1, y0 + 4, 1, y1 - y0 - 8, cap);
}

export function arch(c: Canvas, cx: number, baseY: number, w: number, h: number, m: MaterialKey): void {
  c.rect(cx - w / 2, baseY - h + w / 2, w, h - w / 2, m);
  c.ellipse(cx - 0.5, baseY - h + w / 2, w / 2, w / 2, m);
}

export function floorPlanks(c: Canvas, y0: number, base: MaterialKey, line: MaterialKey, plankH = 8): void {
  c.rect(0, y0, SCENE_W, SCENE_H - y0, base);
  c.rect(0, y0, SCENE_W, 1, line);
  for (let y = y0 + plankH, row = 0; y < SCENE_H; y += plankH, row++) {
    c.rect(0, y, SCENE_W, 1, line);
    for (let x = (row % 2) * 24; x < SCENE_W; x += 48) c.rect(x, y - plankH, 1, plankH, line);
  }
}

/** A toothed gear with `teeth` blocky teeth, any size. */
export function bigCog(c: Canvas, cx: number, cy: number, r: number, teeth: number, m: MaterialKey, hole: MaterialKey): void {
  const tw = Math.max(2, Math.round((r * Math.PI) / teeth / 1.5));
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    const px = -uy, py = ux;
    const r0 = r - 2, r1 = r + Math.max(3, Math.round(r * 0.18));
    const quad: Pt[] = [
      [cx + ux * r0 + px * tw, cy + uy * r0 + py * tw],
      [cx + ux * r1 + px * (tw - 1), cy + uy * r1 + py * (tw - 1)],
      [cx + ux * r1 - px * (tw - 1), cy + uy * r1 - py * (tw - 1)],
      [cx + ux * r0 - px * tw, cy + uy * r0 - py * tw],
    ];
    c.poly(quad, m);
  }
  c.disc(cx, cy, r, m);
  c.disc(cx, cy, r * 0.62, hole);
  c.disc(cx, cy, r * 0.3, m);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    c.line(cx, cy, cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, m, Math.max(2, Math.round(r / 10)));
  }
}

export function pine(c: Canvas, cx: number, baseY: number, h: number, m: MaterialKey): void {
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const ty = baseY - h + (i * h) / (tiers + 0.5);
    const hw = (h / 4) * ((i + 1) / tiers) + 3;
    c.poly([[cx, ty - 2], [cx + hw, ty + h / tiers + 4], [cx - hw, ty + h / tiers + 4]], m);
  }
  c.rect(cx - 2, baseY - 5, 4, 5, 'fWood7');
}
