import { Canvas, type Pt } from '../draw/canvas';
import type { PixelGrid } from '../grid';
import type { MaterialKey } from '../palette';

export const EFFECT_SIZE = 32;
export const EFFECT_IDS = [
  'slash',
  'impact',
  'spark',
  'heal',
  'shield',
  'guard-shatter',
  'victory',
  'level-up',
] as const;
export type EffectId = (typeof EFFECT_IDS)[number];
export const EFFECT_FRAME_COUNT: Record<EffectId, number> = {
  slash: 4,
  impact: 4,
  spark: 4,
  heal: 5,
  shield: 4,
  'guard-shatter': 5,
  victory: 5,
  'level-up': 6,
};

const mk = (): Canvas => new Canvas(EFFECT_SIZE, EFFECT_SIZE);
const flatBake = (c: Canvas): PixelGrid => c.bake({ outline: false, shade: false });
const C = 15.5;

const ray = (c: Canvas, ang: number, r0: number, r1: number, m: MaterialKey, th = 1): void =>
  void c.line(C + Math.cos(ang) * r0, C + Math.sin(ang) * r0, C + Math.cos(ang) * r1, C + Math.sin(ang) * r1, m, th);

const plus = (c: Canvas, x: number, y: number, r: number, m: MaterialKey): void => {
  c.line(x - r, y, x + r, y, m, 1);
  c.line(x, y - r, x, y + r, m, 1);
};

/** A tapered crescent: three bands (dark gold edge, light gold body, white core) swept along an arc. */
function slash(i: number): Canvas {
  const c = mk();
  const [t0, t1, w] = ([[0, 0.4, 6], [0, 0.88, 10], [0.12, 1, 10], [0.55, 1, 5]] as const)[i] as readonly [number, number, number];
  const N = 28;
  const RX = 14.5;
  const RY = 19;
  const at = (u: number, f: number): Pt => {
    const t = t0 + (t1 - t0) * u;
    const a = (-168 + 156 * t) * (Math.PI / 180);
    const thick = w * Math.sin(Math.PI * u) ** 0.7;
    return [C + Math.cos(a) * (RX - f * thick * 0.8), 22.5 + Math.sin(a) * (RY - f * thick)];
  };
  // a band between fractions f0 and f1 of the local thickness, measured inward from the outer edge
  const band = (f0: number, f1: number, m: MaterialKey) => {
    const edge: Pt[] = [];
    const back: Pt[] = [];
    for (let k = 0; k <= N; k++) {
      edge.push(at(k / N, f0));
      back.push(at(k / N, f1));
    }
    c.poly([...edge, ...back.reverse()], m);
  };
  band(0, 1, 'fGold5');
  band(0.1, 0.82, 'fGold');
  band(0.3, 0.6, 'white');
  return c;
}

/** Solid spikes with a gold edge around a bright core, instead of 1-2 px rays. */
function impact(i: number): Canvas {
  const c = mk();
  const r = [7, 12, 15, 11][i] as number;
  const n = 8;
  const spike = (ang: number, len: number, half: number, m: MaterialKey) => {
    const base = r * 0.3;
    c.poly(
      [
        [C + Math.cos(ang) * len, C + Math.sin(ang) * len],
        [C + Math.cos(ang - half) * base, C + Math.sin(ang - half) * base],
        [C + Math.cos(ang + half) * base, C + Math.sin(ang + half) * base],
      ],
      m,
    );
  };
  const thin = i === 3 ? 0.55 : 1;
  for (let k = 0; k < n; k++) {
    const ang = (k / n) * Math.PI * 2 + 0.2;
    const long = k % 2 === 0;
    const len = (long ? r : r * 0.62) * thin;
    const half = (long ? 0.46 : 0.34) * thin;
    spike(ang, len + 1, half + 0.1, 'fGold');
    spike(ang, len, half, long ? 'white' : 'fGold');
  }
  const core = [5.5, 6, 4.5, 0][i] as number;
  if (core) {
    c.disc(C, C, core, 'fGold');
    c.disc(C, C, core - 1.8, 'white');
  }
  if (i === 3) for (let k = 0; k < n; k++) c.rect(Math.round(C + Math.cos(k + 0.7) * 14), Math.round(C + Math.sin(k + 0.7) * 14), 2, 2, 'fGold');
  return c;
}

function spark(i: number): Canvas {
  const c = mk();
  const spots: [number, number, number][] = [[16, 16, 5], [8, 9, 3], [24, 10, 3], [10, 24, 3], [23, 23, 4]];
  spots.forEach(([x, y, r], k) => {
    const phase = (i + k) % 4;
    const rr = [1, 2, r, 2][phase] as number;
    plus(c, x, y, rr, phase === 2 ? 'white' : 'fTeal');
    if (phase === 2) c.px(x, y, 'fTeal');
  });
  return c;
}

function heal(i: number): Canvas {
  const c = mk();
  const xs = [8, 16, 24, 12, 21];
  xs.forEach((x, k) => {
    const y = 28 - ((i * 5 + k * 4) % 26);
    plus(c, x, y, k % 2 ? 2 : 3, 'fMoss');
    c.px(x, y, 'white');
  });
  c.disc(C, 18, [3, 5, 6, 5, 3][i] as number, 'fMoss5');
  return c;
}

function shield(i: number): Canvas {
  const c = mk();
  const r = [6, 10, 13, 14][i] as number;
  c.ellipse(C, C, r, r, 'fTeal');
  c.ellipse(C, C, r - 2, r - 2, null);
  if (i >= 1) c.ellipse(C, C, Math.max(1, r - 5), Math.max(1, r - 5), i === 3 ? null : 'fTeal5');
  for (const [dx, dy] of [[-6, -6], [6, -4], [0, 7]] as const) if (i >= 1 && i < 3) c.px(C + dx, C + dy, 'white');
  if (i === 3) for (let k = 0; k < 8; k++) c.px(C + Math.cos(k * 0.8) * 15, C + Math.sin(k * 0.8) * 15, 'fTeal');
  return c;
}

function guardShatter(i: number): Canvas {
  const c = mk();
  const pieces: Pt[][] = [
    [[-9, -9], [0, -11], [-1, -2]],
    [[0, -11], [9, -9], [2, -2]],
    [[-10, 0], [-1, -2], [-3, 8]],
    [[10, 0], [2, -2], [4, 8]],
    [[-3, 8], [4, 8], [0, 12]],
  ];
  const spread = [0, 1.5, 4, 7, 10][i] as number;
  pieces.forEach((tri, k) => {
    const cx = tri.reduce((s, p) => s + p[0], 0) / 3;
    const cy = tri.reduce((s, p) => s + p[1], 0) / 3;
    const len = Math.hypot(cx, cy) || 1;
    const ox = (cx / len) * spread;
    const oy = (cy / len) * spread;
    if (i === 4 && k % 2) return;
    c.poly(tri.map(([x, y]) => [C + x + ox, C + y + oy] as Pt), k % 2 ? 'fGold5' : 'fCoal6');
  });
  if (i >= 1 && i <= 3) { c.line(C - 2, C - 6, C + 1, C, 'white', 1); c.line(C + 1, C, C - 1, C + 6, 'white', 1); }
  return c;
}

function victory(i: number): Canvas {
  const c = mk();
  const r = [5, 9, 13, 15, 15][i] as number;
  for (let k = 0; k < 12; k++) ray(c, (k / 12) * Math.PI * 2, r * 0.3, r * (k % 2 ? 0.75 : 1), k % 2 ? 'fGold5' : 'fGold', 1);
  c.disc(C, C, [2, 3, 3, 2, 1][i] as number, 'white');
  const dots: [number, number][] = [[6, 6], [26, 8], [5, 24], [27, 25], [16, 3], [16, 29]];
  dots.forEach(([x, y], k) => { if (i >= 2 && (k + i) % 2 === 0) plus(c, x, y, 1, 'fGold'); });
  return c;
}

function levelUp(i: number): Canvas {
  const c = mk();
  const y = 26 - i * 4;
  const rx = 11 - Math.abs(i - 2) * 0.8;
  const thick = i < 4 ? 2 : 1;
  for (let k = 0; k < thick; k++) {
    c.ellipse(C, y + k, rx, 4, 'fGold');
    c.ellipse(C, y + k, rx - 2, 2, null);
  }
  if (i > 0) { c.ellipse(C, y + 7, rx - 1, 3, 'fGold5'); c.ellipse(C, y + 7, rx - 3, 1, null); }
  plus(c, 7, y - 5, 2, 'white'); plus(c, 25, y - 3, 2, 'fGold'); plus(c, 16, y - 8, 1, 'fGold');
  return c;
}

const BUILDERS: Record<EffectId, (i: number) => Canvas> = {
  slash,
  impact,
  spark,
  heal,
  shield,
  'guard-shatter': guardShatter,
  victory,
  'level-up': levelUp,
};

const cache = new Map<string, PixelGrid>();
/** One frame of an effect. Effects are flat, outline-free and meant to be drawn over a sprite. */
export function effectFrame(id: EffectId, frame: number): PixelGrid {
  const n = EFFECT_FRAME_COUNT[id];
  const idx = ((frame % n) + n) % n;
  const key = `${id}:${idx}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const grid = flatBake(BUILDERS[id](idx));
  cache.set(key, grid);
  return grid;
}
export const effectFrames = (id: EffectId): PixelGrid[] =>
  Array.from({ length: EFFECT_FRAME_COUNT[id] }, (_, i) => effectFrame(id, i));
