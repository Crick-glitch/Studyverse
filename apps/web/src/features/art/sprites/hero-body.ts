import { Canvas, type Pt } from '../draw/canvas';
import type { MaterialKey } from '../palette';
import { drawFace, drawHead } from './hero-head';
import { HERO_GROUND, HERO_SIZE, elbow, type Frame, type HeroClass } from './hero-rig';

interface Look {
  tunic: MaterialKey;
  trim: MaterialKey;
  pants: MaterialKey;
  boot: MaterialKey;
  cuff: MaterialKey;
}
const LOOK: Record<HeroClass, Look> = {
  warrior: { tunic: 'ember', trim: 'gold', pants: 'coal', boot: 'wood', cuff: 'gold' },
  tank: { tunic: 'iron', trim: 'gold', pants: 'coal', boot: 'iron', cuff: 'steel' },
  scholar: { tunic: 'teal', trim: 'parch', pants: 'violet', boot: 'wood', cuff: 'parch' },
};
const blank = () => new Canvas(HERO_SIZE, HERO_SIZE);
const clampX = (x: number, lo = 2, hi = 61) => Math.max(lo, Math.min(hi, x));

/** Where the far hand goes: grips the shield / book for those classes, swings freely for the Warrior. */
export function farTarget(f: Frame): Pt {
  if (f.cls === 'tank') return [f.tr[0] - 4, f.top + 12];
  if (f.cls === 'scholar') return [f.tr[0] - 8, f.top + 14];
  return f.farHand;
}

function arm(c: Canvas, from: Pt, to: Pt, look: Look, upper = 4, lower = 3, bias: Pt = [-0.3, 1]) {
  const e = elbow(from, to, 7, 7, bias);
  c.line(from[0], from[1], e[0], e[1], look.tunic, upper);
  c.line(e[0], e[1], to[0], to[1], look.tunic, lower);
  c.rect(Math.round(to[0]) - 2, Math.round(to[1]) - 2, 2, 2, look.cuff);
}

function cape(c: Canvas, f: Frame) {
  const s = f.p.sway;
  const [tx] = f.tl;
  const y = (v: number) => Math.min(57, v);
  const pts: Pt[] = [
    [tx + 6, f.top - 1], [tx - 1, f.top], [clampX(tx - 6 - s), f.top + 10], [clampX(tx - 11 - s * 2), y(f.bottom + 5)],
    [clampX(tx - 8 - s), y(f.bottom + 11)], [clampX(tx - 4 - s), y(f.bottom + 8)], [clampX(tx - 2 - s), y(f.bottom + 14)],
    [tx + 3, y(f.bottom + 8)], [f.bl[0] + 3, f.bottom + 1], [tx + 8, f.top + 8],
  ];
  c.poly(pts, 'ember');
  c.line(tx + 2, f.top + 3, clampX(tx - 7 - s), y(f.bottom + 6), 'fEmber7');
  c.line(tx + 4, f.top + 5, clampX(tx - 2 - s), y(f.bottom + 9), 'fEmber7');
  c.line(tx - 1, f.top + 2, clampX(tx - 5 - s), f.top + 9, 'fEmber');
}

export function backLayer(cls: HeroClass, f: Frame): Canvas {
  const c = blank();
  const look = LOOK[cls];
  arm(c, f.fsh, farTarget(f), look, 4, 3, [-0.6, 0.8]);
  c.rect(Math.round(farTarget(f)[0]) - 1, Math.round(farTarget(f)[1]) - 1, 3, 3, 'skin');
  if (cls === 'warrior') cape(c, f);
  if (cls === 'tank') {
    // bedroll and pack strapped behind the pauldron
    const bx = clampX(f.tl[0] - 5, 3);
    c.rect(bx, f.top - 2, 8, 12, 'wood');
    c.rect(bx - 1, f.top - 1, 2, 10, 'parch');
    c.rect(bx, f.top + 2, 8, 1, 'coal');
    c.rect(bx, f.top + 7, 8, 1, 'coal');
  }
  if (cls === 'scholar') {
    // satchel with a scroll tube
    c.rect(f.tl[0] - 5, f.top + 8, 9, 9, 'wood');
    c.rect(f.tl[0] - 5, f.top + 8, 9, 3, 'fWood5');
    c.px(f.tl[0] - 1, f.top + 11, 'fGold5');
    c.poly([[f.tl[0] - 3, f.top + 3], [f.tl[0] - 8, f.top + 1], [f.tl[0] - 9, f.top + 4], [f.tl[0] - 4, f.top + 7]], 'parch');
    c.line(f.tl[0] - 8, f.top + 2, f.tl[0] - 5, f.top + 5, 'fEmber5');
  }
  return c;
}

function legs(c: Canvas, f: Frame, look: Look) {
  const hipY = f.bottom - 2;
  const g = HERO_GROUND - 3;
  const w = f.legW;
  const foot = (off: number): Pt => [f.hipX + off, g];
  const boot = (p: Pt, w2 = 9) => {
    c.rect(p[0] - 3, g, w2, 4, look.boot);
    c.rect(p[0] - 3, g, w2, 1, look.cuff === 'steel' ? 'fCoal6' : 'fWood7');
  };
  if (f.p.kneel) {
    const hipB: Pt = [f.hipX - 3, hipY];
    const hipF: Pt = [f.hipX + 3, hipY];
    const kneeB: Pt = [f.hipX - 6, g + 1];
    c.line(hipB[0], hipB[1], kneeB[0], kneeB[1], look.pants, w);
    c.line(kneeB[0], kneeB[1], f.hipX - 15, g + 1, look.pants, Math.max(3, w - 1));
    c.rect(f.hipX - 19, g, 5, 4, look.boot);
    const kneeF: Pt = [f.hipX + 10, hipY + 4];
    c.line(hipF[0], hipF[1], kneeF[0], kneeF[1], look.pants, w);
    c.line(kneeF[0], kneeF[1], f.hipX + 10, g, look.pants, Math.max(3, w - 1));
    boot([f.hipX + 8, g]);
    return;
  }
  [-1, 1].forEach((side) => {
    const hip: Pt = [f.hipX + side * 3, hipY];
    const fp = foot(side < 0 ? f.p.back : f.p.front);
    const bend = (side < 0 ? 1 : 2) + f.p.hip * (side < 0 ? 0.3 : 0.5);
    const knee: Pt = [(hip[0] + fp[0]) / 2 + bend, (hip[1] + fp[1]) / 2];
    c.line(hip[0], hip[1], knee[0], knee[1], look.pants, w);
    c.line(knee[0], knee[1], fp[0], fp[1], f.cls === 'tank' ? 'iron' : look.pants, f.cls === 'tank' ? w : Math.max(3, w - 1));
    boot(fp);
  });
}

function torso(c: Canvas, f: Frame, look: Look) {
  c.poly([f.tl, f.tr, f.br, f.bl], look.tunic);
  c.rect(f.tl[0] + 2, f.top - 1, f.tr[0] - f.tl[0] - 3, 2, look.trim);
  // belt
  c.rect(f.bl[0] - 1, f.bottom - 4, f.br[0] - f.bl[0] + 3, 2, 'coal');
  c.px(Math.round((f.bl[0] + f.br[0]) / 2) + 1, f.bottom - 4, 'fGold');
}

/** Class body: legs, tunic, arm, neck and the redrawn head. Armour goes on top in its own layer. */
export function bodyLayer(cls: HeroClass, f: Frame): Canvas {
  const c = blank();
  const look = LOOK[cls];
  legs(c, f, look);
  torso(c, f, look);
  c.rect(f.hx - 3, f.hy + 6, 7, f.top - f.hy - 4, 'skin');
  arm(c, f.sh, f.hand, look, cls === 'tank' ? 5 : 4, cls === 'tank' ? 4 : 3);
  drawHead(c, f);
  return c;
}

/** Flat facial-feature decal, baked without outline or shading. */
export function faceLayer(f: Frame): Canvas {
  const c = blank();
  drawFace(c, f);
  return c;
}

/** Class off-hand item: the Tank's tower shield, the Scholar's book. The Warrior has none. */
export function offhandLayer(cls: HeroClass, f: Frame): Canvas {
  const c = blank();
  if (cls === 'tank') {
    const sx = f.tr[0] - 1;
    // kneeling, the shield rests on the ground instead of hanging below the canvas
    const sy = Math.min(f.top + 12, HERO_GROUND - 15);
    const P = (dx: number, dy: number): Pt => [sx + dx, sy + dy];
    c.poly([P(-8, -12), P(8, -12), P(8, 2), P(0, 14), P(-8, 2)], 'steel');
    c.poly([P(-6, -10), P(6, -10), P(6, 1), P(0, 11), P(-6, 1)], 'ember');
    c.rect(sx - 1, sy - 9, 2, 17, 'gold');
    c.rect(sx - 5, sy - 5, 10, 2, 'gold');
    c.disc(sx, sy - 4, 2.2, 'fGold');
    c.rect(sx - 8, sy - 12, 16, 1, 'white');
    c.rect(Math.round(farTarget(f)[0]) - 2, Math.round(farTarget(f)[1]) + 3, 3, 3, 'skin');
  }
  if (cls === 'scholar') {
    const bx = f.tr[0] - 5;
    const by = f.top + 7;
    c.rect(bx - 4, by, 9, 11, 'ember');
    c.rect(bx + 4, by + 1, 2, 9, 'parch');
    c.rect(bx - 4, by + 9, 10, 2, 'parch');
    c.rect(bx - 3, by + 2, 6, 1, 'gold');
    c.rect(bx - 3, by + 4, 6, 3, 'fGold7');
    c.px(bx - 1, by + 5, 'fGold');
    c.rect(bx - 6, by + 7, 4, 4, 'skin');
  }
  return c;
}
