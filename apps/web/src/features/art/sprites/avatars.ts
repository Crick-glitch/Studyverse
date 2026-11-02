import { Canvas } from '../draw/canvas';
import { overlay, type PixelGrid } from '../grid';
import { HERO_CLASSES, heroLayerGrid, type HeroClass } from './hero';

export const AVATAR_IDS = ['student', 'wizard', 'elf', 'scientist', 'teacher', 'knight'] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
/** Maps the old emoji presets to avatar ids so imported profiles keep their look (see 03-core-modules.md). */
export const LEGACY_AVATAR_EMOJI: Record<string, AvatarId> = {
  '\u{1F9D1}\u200D\u{1F393}': 'student',
  '\u{1F9D9}': 'wizard',
  '\u{1F9DD}\u200D\u2640\uFE0F': 'elf',
  '\u{1F469}\u200D\u{1F52C}': 'scientist',
  '\u{1F469}\u200D\u{1F3EB}': 'teacher',
  '\u{1F6E1}\uFE0F': 'knight',
};
export const AVATAR_SIZE = 32;
export const PORTRAIT_SIZE = 40;

function bust(id: AvatarId): Canvas {
  const c = new Canvas(AVATAR_SIZE, AVATAR_SIZE);
  c.rect(0, 0, AVATAR_SIZE, AVATAR_SIZE, 'fForest7');
  c.rect(0, 24, AVATAR_SIZE, 8, 'fForest5');
  const tunic = { student: 'teal', wizard: 'violet', elf: 'moss', scientist: 'white', teacher: 'ember', knight: 'iron' }[id] as 'teal';
  c.poly([[4, 32], [6, 25], [11, 22], [21, 22], [26, 25], [28, 32]], tunic);
  c.rect(14, 19, 4, 4, 'skin');
  if (id === 'knight') {
    c.ellipse(16, 13, 7, 8, 'steel');
    c.rect(9, 13, 14, 2, 'steel');
    c.rect(10, 11, 12, 3, 'ink');
    c.rect(11, 12, 3, 1, 'fTeal'); c.rect(18, 12, 3, 1, 'fTeal');
    c.rect(15, 5, 2, 7, 'iron');
    c.poly([[17, 6], [22, 2], [26, 6], [20, 8]], 'ember');
    c.rect(15, 17, 2, 4, 'iron');
    return c;
  }
  const hair = { student: 'wood', wizard: 'parch', elf: 'gold', scientist: 'violet', teacher: 'iron' }[id] as 'wood';
  if (id === 'elf') {
    c.poly([[10, 12], [2, 9], [10, 16]], 'skin');
    c.poly([[22, 12], [30, 9], [22, 16]], 'skin');
    c.ellipse(16, 11, 8, 8, hair);
    c.rect(8, 11, 3, 14, hair); c.rect(21, 11, 3, 14, hair);
  } else {
    c.ellipse(16, 11, 7.5, 7, hair);
  }
  c.ellipse(16, 14, 6, 7, 'skin');
  if (id === 'elf') c.rect(9, 6, 14, 2, hair);
  c.rect(9, 8, 14, 3, hair);
  c.rect(12, 13, 2, 2, 'ink'); c.rect(18, 13, 2, 2, 'ink');
  c.px(12, 13, 'white'); c.px(18, 13, 'white');
  c.rect(15, 18, 3, 1, 'fEmber7');
  if (id === 'student') {
    c.rect(7, 4, 18, 2, 'coal'); c.rect(11, 6, 10, 3, 'coal'); c.line(25, 5, 26, 11, 'gold', 1); c.px(26, 12, 'gold');
  } else if (id === 'wizard') {
    c.poly([[6, 9], [26, 9], [18, 1], [14, 1]], 'violet');
    c.poly([[17, 1], [22, 0], [21, 4]], 'violet');
    c.rect(5, 8, 22, 2, 'violet'); c.px(14, 5, 'fGold'); c.px(18, 7, 'fGold');
    c.poly([[10, 17], [22, 17], [16, 28]], 'parch');
  } else if (id === 'scientist') {
    c.rect(9, 11, 6, 4, 'teal'); c.rect(17, 11, 6, 4, 'teal');
    c.rect(10, 12, 4, 2, 'fTeal'); c.rect(18, 12, 4, 2, 'fTeal');
    c.rect(15, 12, 2, 1, 'wood'); c.rect(8, 10, 16, 1, 'wood');
    c.rect(14, 23, 4, 9, 'teal');
  } else if (id === 'teacher') {
    c.ellipse(16, 4, 3, 2.5, hair);
    c.rect(10, 12, 5, 4, 'ink'); c.rect(17, 12, 5, 4, 'ink');
    c.rect(11, 13, 3, 2, 'fParch'); c.rect(18, 13, 3, 2, 'fParch');
    c.rect(15, 13, 2, 1, 'ink');
    c.rect(20, 25, 7, 6, 'parch'); c.rect(20, 25, 1, 6, 'gold');
  } else if (id === 'elf') {
    c.rect(10, 8, 12, 1, 'gold'); c.px(16, 9, 'fTeal');
  }
  return c;
}

const cache = new Map<string, PixelGrid>();
/** A 32x32 pixel bust used as a profile picture. */
export function avatarGrid(id: AvatarId): PixelGrid {
  const key = `a:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = bust(id).bake();
  cache.set(key, g);
  return g;
}

const crop = (g: PixelGrid, x0: number, y0: number, w: number, h: number): PixelGrid => ({
  w,
  h,
  rows: Array.from({ length: h }, (_, y) => (g.rows[y0 + y] ?? '').slice(x0, x0 + w).padEnd(w, '.')),
});

/** A 40x40 camp portrait: the class hero's head and shoulders (no weapon) on a dusk-green backdrop. */
export function portraitGrid(cls: HeroClass): PixelGrid {
  const key = `p:${cls}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const bg = new Canvas(PORTRAIT_SIZE, PORTRAIT_SIZE);
  bg.rect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE, 'fForest7');
  bg.rect(0, 28, PORTRAIT_SIZE, 12, 'fForest5');
  const layers = (['back', 'body', 'face', 'armor'] as const).map((l) => crop(heroLayerGrid(cls, 'idle', l), 6, 0, PORTRAIT_SIZE, PORTRAIT_SIZE));
  const g = overlay([bg.bake({ outline: false, shade: false }), ...layers]);
  cache.set(key, g);
  return g;
}
export { HERO_CLASSES };
