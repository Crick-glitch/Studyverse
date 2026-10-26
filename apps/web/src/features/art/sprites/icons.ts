import { Canvas } from '../draw/canvas';
import type { PixelGrid } from '../grid';
import { cog } from './enemy-kit';

export const ICON_SIZE = 16;
export const NAV_ICON_IDS = [
  'dashboard',
  'quests',
  'sessions',
  'lab',
  'camp',
  'dungeons',
  'stats',
  'leaderboard',
  'settings',
] as const;
export type NavIconId = (typeof NAV_ICON_IDS)[number];
export const FLAME_LEVELS = [0, 1, 2, 3, 4] as const;
export type FlameLevel = (typeof FLAME_LEVELS)[number];
export const CREST_SIZE = 24;
export const ENERGY_SIZE = 14;

const mk = (n = ICON_SIZE): Canvas => new Canvas(n, n);

function nav(id: NavIconId): Canvas {
  const c = mk();
  switch (id) {
    case 'dashboard':
      c.rect(3, 7, 10, 7, 'iron');
      for (const x of [3, 7, 11]) c.rect(x, 4, 2, 3, 'iron');
      c.rect(7, 10, 2, 4, 'ink'); c.px(8, 2, 'wood'); c.rect(9, 1, 3, 2, 'ember');
      break;
    case 'quests':
      c.rect(4, 3, 8, 10, 'parch');
      c.rect(3, 2, 10, 2, 'wood'); c.rect(3, 12, 10, 2, 'wood');
      c.rect(5, 6, 6, 1, 'fParch5'); c.rect(5, 8, 5, 1, 'fParch5'); c.rect(5, 10, 6, 1, 'fParch5');
      break;
    case 'sessions':
      c.rect(3, 1, 10, 2, 'wood'); c.rect(3, 13, 10, 2, 'wood');
      c.poly([[4, 3], [12, 3], [8, 8]], 'bone'); c.poly([[8, 8], [12, 13], [4, 13]], 'bone');
      c.poly([[6, 12], [10, 12], [8, 9]], 'gold'); c.px(8, 5, 'fGold');
      break;
    case 'lab':
      c.rect(6, 1, 4, 5, 'bone');
      c.poly([[6, 6], [10, 6], [14, 14], [2, 14]], 'bone');
      c.poly([[4, 10], [12, 10], [14, 14], [2, 14]], 'teal');
      c.px(6, 8, 'fTeal'); c.px(9, 12, 'fTeal');
      break;
    case 'camp':
      c.poly([[8, 2], [15, 14], [1, 14]], 'parch');
      c.poly([[8, 7], [11, 14], [5, 14]], 'forest');
      c.line(8, 2, 8, 0, 'wood', 1);
      break;
    case 'dungeons':
      c.rect(2, 3, 12, 12, 'iron');
      c.ellipse(8, 8, 3.5, 3, 'ink'); c.rect(5, 8, 6, 7, 'ink');
      for (const x of [6, 8, 10]) c.rect(x, 7, 1, 8, 'fCoal6');
      c.px(8, 3, 'gold');
      break;
    case 'stats':
      c.rect(2, 9, 3, 5, 'moss'); c.rect(6, 5, 3, 9, 'gold'); c.rect(10, 2, 3, 12, 'ember');
      c.rect(1, 14, 14, 1, 'parch');
      break;
    case 'leaderboard':
      c.poly([[4, 2], [12, 2], [11, 8], [8, 10], [5, 8]], 'gold');
      c.rect(2, 3, 2, 4, 'gold'); c.rect(12, 3, 2, 4, 'gold');
      c.rect(7, 10, 2, 3, 'gold'); c.rect(5, 13, 6, 2, 'wood'); c.px(7, 4, 'fGold');
      break;
    case 'settings':
      cog(c, 8, 8, 4, 'steel');
      break;
  }
  return c;
}

/** Teardrop flame: narrow tip, full belly, rounded base. `lean` bends the tip sideways. */
function teardrop(c: Canvas, cx: number, top: number, bottom: number, halfW: number, lean: number, m: 'ember' | 'gold' | 'fGold' | 'white'): void {
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    const hw = t < 0.72 ? halfW * Math.pow(t / 0.72, 1.35) : halfW * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.72) / 0.28, 2)));
    const half = Math.round(hw);
    const shift = Math.round(lean * (1 - t));
    c.rect(Math.round(cx) + shift - half, y, half * 2 + 1, 1, m);
  }
}

function flame(level: FlameLevel): Canvas {
  const c = mk();
  if (level === 0) {
    c.ellipse(8, 13, 5, 1.5, 'fCoal6');
    c.poly([[8, 3], [11, 8], [8, 13], [5, 8]], 'teal');
    c.px(7, 7, 'fTeal'); c.px(7, 9, 'fTeal');
    return c;
  }
  const top = [0, 8, 5, 3, 1][level] as number;
  const halfW = [0, 3, 4, 4.5, 5.5][level] as number;
  const lean = [0, 0, 1, 1, 2][level] as number;
  teardrop(c, 8, top, 14, halfW, lean, 'ember');
  if (level >= 3) { teardrop(c, 4, top + 4, 11, 1.4, -1, 'ember'); teardrop(c, 12, top + 5, 11, 1.4, 1, 'ember'); }
  teardrop(c, 8, top + 3, 14, halfW * 0.62, lean * 0.5, 'gold');
  teardrop(c, 8, top + 7 > 12 ? 12 : top + 7, 14, halfW * 0.3, 0, level === 4 ? 'white' : 'fGold');
  return c;
}

function crest(): Canvas {
  const c = mk(CREST_SIZE);
  c.poly([[3, 3], [21, 3], [21, 13], [12, 22], [3, 13]], 'gold');
  c.poly([[5, 5], [19, 5], [19, 12], [12, 19], [5, 12]], 'teal');
  c.stamp(
    ['....x....', '....x....', '...xxx...', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '..xx.xx..', '.xx...xx.'],
    8,
    6,
    { x: 'fGold' },
  );
  return c;
}

function energy(): Canvas {
  const c = mk(ENERGY_SIZE);
  c.poly([[8, 1], [3, 8], [6.5, 8], [5, 13], [11, 5.5], [7.5, 5.5]], 'gold');
  return c;
}

const cache = new Map<string, PixelGrid>();
const memo = (key: string, build: () => Canvas): PixelGrid => {
  const hit = cache.get(key);
  if (hit) return hit;
  const g = build().bake();
  cache.set(key, g);
  return g;
};

export const navIconGrid = (id: NavIconId): PixelGrid => memo(`nav:${id}`, () => nav(id));
export const flameGrid = (level: FlameLevel): PixelGrid => memo(`flame:${level}`, () => flame(level));
export const crestGrid = (): PixelGrid => memo('crest', crest);
export const energyGrid = (): PixelGrid => memo('energy', energy);
