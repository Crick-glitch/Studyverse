import { Canvas, type Pt } from '../draw/canvas';
import type { MaterialKey } from '../palette';
import { HERO_GROUND, HERO_SIZE, norm, type Frame } from './hero-rig';

export const WEAPON_SLUGS = ['iron-sword', 'steel-sword', 'dragon-slayer', 'scribes-staff', 'quillblade', 'tome-hammer'] as const;
export const ARMOR_SLUGS = ['leather-armor', 'iron-plate', 'dragon-scale', 'scholars-robe', 'cartographers-mail', 'wardens-plate'] as const;
export type WeaponSlug = (typeof WEAPON_SLUGS)[number];
export type ArmorSlug = (typeof ARMOR_SLUGS)[number];

export function armorLayer(slug: ArmorSlug, f: Frame): Canvas {
  const c = new Canvas(HERO_SIZE, HERO_SIZE);
  const { tl, tr, br, bl } = f;
  const mid = (a: number, b: number) => Math.round((a + b) / 2);
  const shoulder = (m: MaterialKey, r = 4) => c.ellipse(tr[0] - 2, f.top + 2, r, r - 1, m);
  const cx = mid(tl[0], tr[0]);
  switch (slug) {
    case 'leather-armor':
      c.poly([tl, tr, br, bl], 'wood');
      c.rect(bl[0] - 1, f.bottom - 4, br[0] - bl[0] + 3, 2, 'coal');
      c.rect(mid(bl[0], br[0]) - 1, f.bottom - 4, 3, 2, 'gold');
      c.line(tl[0] + 2, f.top + 1, bl[0] + 3, f.bottom - 5, 'coal');
      c.rect(tl[0] + 3, f.top + 4, 3, 3, 'fWood5');
      shoulder('wood', 4);
      break;
    case 'iron-plate':
      c.poly([tl, tr, br, bl], 'steel');
      c.rect(bl[0] - 1, f.bottom - 4, br[0] - bl[0] + 3, 3, 'iron');
      c.rect(cx - 1, f.top + 3, 2, 9, 'iron');
      c.px(tl[0] + 3, f.top + 4, 'iron');
      c.px(tr[0] - 3, f.top + 4, 'iron');
      shoulder('steel', 5);
      c.px(tr[0] - 2, f.top + 1, 'white');
      break;
    case 'dragon-scale':
      c.poly([tl, tr, br, bl], 'ember');
      for (let y = f.top + 2; y < f.bottom - 3; y += 3)
        for (let x = tl[0] + ((y / 3) % 2 ? 1 : 3); x < tr[0] - 1; x += 4) c.stamp(['###', '.#.'], x - 1, y, { '#': 'fEmber' });
      c.rect(bl[0] - 1, f.bottom - 3, br[0] - bl[0] + 3, 2, 'gold');
      shoulder('ember', 5);
      c.poly([[tr[0] - 4, f.top - 1], [tr[0] - 2, f.top - 6], [tr[0], f.top - 1]], 'gold');
      break;
    case 'scholars-robe': {
      const hem = Math.min(57, f.bottom + 12);
      c.poly([tl, tr, [br[0] + 5, hem], [bl[0] - 5, hem]], 'teal');
      c.rect(bl[0] - 5, hem - 2, br[0] - bl[0] + 11, 2, 'parch');
      c.line(cx, f.top + 1, mid(bl[0], br[0]) + 1, hem - 2, 'parch');
      c.line(cx - 4, f.bottom + 2, cx - 6, hem - 3, 'fTeal7');
      c.line(cx + 5, f.bottom + 2, cx + 7, hem - 3, 'fTeal7');
      c.rect(bl[0] - 1, f.bottom - 5, br[0] - bl[0] + 3, 2, 'gold');
      shoulder('teal', 3);
      break;
    }
    case 'cartographers-mail':
      c.poly([tl, tr, br, bl], 'iron');
      for (let y = f.top + 1; y < f.bottom - 2; y += 2)
        for (let x = tl[0] + (y % 4 === 0 ? 0 : 1); x < tr[0]; x += 2) c.px(x, y, 'steel');
      c.poly([[cx - 3, f.top + 1], [cx + 3, f.top + 1], [mid(bl[0], br[0]) + 3, f.bottom - 1], [mid(bl[0], br[0]) - 3, f.bottom - 1]], 'parch');
      c.line(cx - 1, f.top + 4, mid(bl[0], br[0]) + 1, f.bottom - 3, 'fEmber5');
      c.px(mid(bl[0], br[0]), f.bottom - 6, 'fTeal5');
      shoulder('iron', 4);
      break;
    case 'wardens-plate':
      c.poly([tl, tr, br, bl], 'coal');
      c.rect(tl[0] + 1, f.top + 1, tr[0] - tl[0] - 2, 4, 'iron');
      c.rect(cx - 1, f.top + 5, 2, 8, 'gold');
      c.rect(bl[0] - 2, f.bottom - 4, br[0] - bl[0] + 5, 4, 'iron');
      shoulder('iron', 6);
      c.rect(tr[0] - 6, f.top - 1, 5, 2, 'gold');
      c.poly([[tr[0] - 1, f.top], [tr[0] + 3, f.top - 5], [tr[0] + 1, f.top + 2]], 'steel');
      break;
  }
  return c;
}

const SWORDS: Record<string, { L: number; hw: number; blade: MaterialKey }> = {
  'iron-sword': { L: 28, hw: 3.1, blade: 'iron' },
  'steel-sword': { L: 29, hw: 3.3, blade: 'steel' },
  'dragon-slayer': { L: 33, hw: 4.2, blade: 'steel' },
};
const REACH: Record<WeaponSlug, number> = {
  'iron-sword': 28, 'steel-sword': 29, 'dragon-slayer': 33, 'scribes-staff': 38, quillblade: 28, 'tome-hammer': 27,
};
/** Staff and hammer lean on the ground when the hero is down; blades are planted point-first. */
const UPRIGHT = new Set<WeaponSlug>(['scribes-staff', 'tome-hammer']);

function buildWeapon(slug: WeaponSlug, f: Frame, shrink: number): Canvas {
  const c = new Canvas(HERO_SIZE, HERO_SIZE);
  const [hx, hy] = f.hand;
  const down = f.state === 'defeat';
  const dir = norm(down && UPRIGHT.has(slug) ? [0.1, -1] : f.wdir);
  const [dx, dy] = dir;
  // never let the tip leave the canvas: shorten the part beyond the hand if the pose would clip
  const limit = (pos: number, d: number, lo: number, hi: number) => (d > 0.01 ? (hi - pos) / d : d < -0.01 ? (lo - pos) / d : Infinity);
  const tmax = Math.min(limit(hx, dx, 2, 61), down && !UPRIGHT.has(slug) ? Infinity : limit(hy, dy, 3, HERO_GROUND - 1));
  // the fist sits mid-grip: the grip runs from t = -6 (pommel) to t = 0 (guard), so the hand is at t = -3
  const GRIP = 3;
  const k = Math.min(1, tmax / (REACH[slug] + GRIP)) * shrink;
  const px = -dy;
  const py = dx;
  const W = (t: number, side: number): Pt => {
    const u = t + GRIP;
    const tt = u > 0 ? u * k : u;
    return [hx + dx * tt + px * side, hy + dy * tt + py * side];
  };
  const along = (t0: number, t1: number, side: number, m: MaterialKey, thick = 1) => {
    const a = W(t0, side);
    const b = W(t1, side);
    c.line(a[0], a[1], b[0], b[1], m, thick);
  };
  const poly = (pts: [number, number][], m: MaterialKey) => c.poly(pts.map(([t, s]) => W(t, s)), m);
  const ball = (t: number, side: number, r: number, m: MaterialKey) => {
    const p = W(t, side);
    c.disc(p[0], p[1], r, m);
  };
  const sword = SWORDS[slug];
  if (sword) {
    const { L, hw, blade } = sword;
    const big = slug === 'dragon-slayer';
    along(-6, 0, 0, 'wood', 2);
    ball(-7, 0, 1.8, big ? 'ember' : 'gold');
    poly([[1.5, -hw], [L - 4, -hw * 0.85], [L, 0], [L - 4, hw * 0.85], [1.5, hw]], blade);
    along(3, L - 5, 0, big ? 'fEmber' : 'white');
    poly([[0, -6], [2, -6], [2, 6], [0, 6]], 'gold');
    ball(0.5, -6, 1.2, 'gold');
    ball(0.5, 6, 1.2, 'gold');
    if (big) [9, 15, 21].forEach((t) => ball(t, 0, 1, 'fEmber'));
  } else if (slug === 'scribes-staff') {
    along(-9, 31, 0, 'wood', 2);
    poly([[28, -5], [30, -5], [30, 5], [28, 5]], 'gold');
    ball(34, 0, 4.2, 'teal');
    ball(34, 0, 2, 'fTeal');
    ball(33, -1, 0.8, 'white');
  } else if (slug === 'quillblade') {
    along(-6, 0, 0, 'wood', 2);
    ball(-7, 0, 1.8, 'gold');
    poly([[0, -5], [2, -5], [2, 5], [0, 5]], 'gold');
    poly([[1.5, -3], [14, -5], [26, -1.2], [28, 0], [26, 1.2], [14, 5], [1.5, 3]], 'parch');
    along(3, 26, 0, 'steel');
    along(10, 21, -3, 'fParch3');
    along(10, 21, 3, 'fParch3');
  } else {
    along(-6, 20, 0, 'wood', 2);
    poly([[14, -8], [26, -8], [26, 8], [14, 8]], 'ember');
    poly([[15, -6.5], [25, -6.5], [25, 6.5], [15, 6.5]], 'parch');
    along(14, 26, 0, 'gold');
    along(14, 26, -7, 'coal');
    along(14, 26, 7, 'coal');
  }
  c.rect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3, 'skin');
  c.clear(0, HERO_GROUND + 1, HERO_SIZE, HERO_SIZE - HERO_GROUND - 1);
  return c;
}

/**
 * The weapon in the near hand. The part beyond the hand is shortened until the whole drawing, widths and
 * outline included, sits inside the canvas, so a big blade can never be cut off by the frame.
 */
export function weaponLayer(slug: WeaponSlug, f: Frame): Canvas {
  let shrink = 1;
  let c = buildWeapon(slug, f, shrink);
  for (let i = 0; i < 24; i++) {
    const b = c.bounds();
    if (!b || (b.x0 >= 2 && b.x1 <= HERO_SIZE - 3 && b.y0 >= 2)) break;
    shrink -= 0.04;
    c = buildWeapon(slug, f, shrink);
  }
  return c;
}
