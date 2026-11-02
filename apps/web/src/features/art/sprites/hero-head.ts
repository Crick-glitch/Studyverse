import type { Canvas, Pt } from '../draw/canvas';
import type { MaterialKey } from '../palette';
import type { Eyes, Frame, Mouth } from './hero-rig';

const FACE: Record<string, MaterialKey> = { w: 'white', k: 'ink', s: 'fSkin7', e: 'fEmber', t: 'fTeal' };

/** Brow colour per class (matches the hair or the helm's brim). */
const BROW: Record<Frame['cls'], MaterialKey> = { warrior: 'fWood7', tank: 'fCoal6', scholar: 'fViolet7' };

function eyes(c: Canvas, f: Frame, kind: Eyes) {
  const ex1 = f.hx + 1;
  const ex2 = f.hx + 6;
  const ey = f.hy;
  const brow = BROW[f.cls];
  const b = (x: number, y: number) => c.px(x, y, brow);
  const both = (rows: string[], dx1 = 0, dy = 0, dx2 = 0) => {
    c.stamp(rows, ex1 + dx1, ey + dy, FACE);
    c.stamp(rows, ex2 + dx2, ey + dy, FACE);
  };
  switch (kind) {
    case 'open':
      both(['wk', 'kk']);
      [ex1 - 1, ex1, ex1 + 1].forEach((x) => b(x, ey - 2));
      [ex2, ex2 + 1, ex2 + 2].forEach((x) => b(x, ey - 2));
      break;
    case 'fierce':
      both(['kk', 'wk']);
      b(ex1 - 1, ey - 2); b(ex1, ey - 2); b(ex1 + 1, ey - 1); b(ex1 + 2, ey - 1);
      b(ex2 - 1, ey - 1); b(ex2, ey - 1); b(ex2 + 1, ey - 2); b(ex2 + 2, ey - 2);
      break;
    case 'wince':
      c.stamp(['k.', '.k', 'k.'], ex1, ey - 1, FACE);
      c.stamp(['.k', 'k.', '.k'], ex2, ey - 1, FACE);
      break;
    case 'closed':
      both(['kk'], 0, 1);
      b(ex1 - 1, ey - 1); b(ex1, ey - 2); b(ex1 + 1, ey - 3);
      b(ex2, ey - 3); b(ex2 + 1, ey - 2); b(ex2 + 2, ey - 1);
      break;
    case 'happy':
      both(['.k.', 'k.k'], 0, 0, 0);
      c.px(ex1 - 1, ey + 3, 'fEmber'); c.px(ex2 + 2, ey + 3, 'fEmber');
      break;
  }
}

function mouth(c: Canvas, f: Frame, kind: Mouth) {
  // the head is 19 wide at the eyes but only ~12 wide at the mouth, so keep these inside x <= hx + 5
  const x = f.hx + 2;
  const y = f.hy + 5;
  switch (kind) {
    case 'flat': c.stamp(['kkk'], x + 1, y, FACE); break;
    case 'grit': c.stamp(['kkkk', 'kwwk'], x, y, FACE); break;
    case 'shout': c.stamp(['kkkk', 'keek', '.kk.'], x, y - 1, FACE); break;
    case 'o': c.stamp(['kk', 'kk'], x + 1, y, FACE); break;
    case 'smile': c.stamp(['k..k', '.kk.'], x, y, FACE); break;
    case 'grin': c.stamp(['kkkk', 'kwwk', '.kk.'], x, y - 1, FACE); break;
  }
}

/** Skull, jaw, nose and the hair or helm. Facial features live in `drawFace` so they can be a flat decal. */
export function drawHead(c: Canvas, f: Frame): void {
  const { hx, hy } = f;
  const h = (dx: number, dy: number): Pt => [hx + dx, hy + dy];
  c.ellipse(hx, hy, 9, 8, 'skin');
  c.rect(hx - 4, hy + 6, 9, 3, 'skin');
  c.px(hx + 9, hy + 2, 'skin');
  c.px(hx + 9, hy + 3, 'skin');
  c.rect(hx - 2, hy + 8, 5, 2, 'fSkin7');
  if (f.cls === 'warrior') warriorHair(c, f, h);
  else if (f.cls === 'tank') tankHelm(c, f, h);
  else scholarHair(c, f, h);
}

/** Eyes, brows, mouth, cheeks and glasses, drawn flat on their own layer. */
export function drawFace(c: Canvas, f: Frame): void {
  eyes(c, f, f.p.eyes);
  mouth(c, f, f.p.mouth);
  if (f.cls === 'scholar') glasses(c, f);
  c.px(f.hx + 3, f.hy + 4, 'fSkin5');
}

function warriorHair(c: Canvas, f: Frame, h: (dx: number, dy: number) => Pt) {
  const { hx, hy } = f;
  // swept-back mass with a fringe that falls over the brow
  c.poly([h(-10, 5), h(-10.5, -1), h(-8, -6.5), h(-3, -9.5), h(3, -10), h(8, -7.5), h(9.5, -3.5), h(8, -3.5), h(5, -5), h(2, -3.5), h(-1, -5), h(-3, -2), h(-4, 3), h(-6, 6)], 'wood');
  // three spikes sweeping up and back
  c.poly([h(-9, -5), h(-15, -10), h(-6, -8)], 'wood');
  c.poly([h(-6, -8), h(-10, -15), h(-1, -10)], 'wood');
  c.poly([h(-1, -10), h(2, -16), h(5, -9.5)], 'wood');
  // highlight strands
  c.line(hx - 4, hy - 8, hx + 1, hy - 8, 'fParch5');
  c.line(hx - 7, hy - 4, hx - 5, hy - 6, 'fParch5');
  c.px(hx + 6, hy - 6, 'fParch5');
  // headband with trailing tails
  c.rect(hx - 8, hy - 5, 17, 2, 'gold');
  c.poly([h(-8, -5), h(-14, -3), h(-15, 1), h(-11, -1), h(-8, -3)], 'ember');
  c.px(hx + 2, hy - 4, 'fGold');
}

function tankHelm(c: Canvas, f: Frame, h: (dx: number, dy: number) => Pt) {
  const { hx, hy } = f;
  // dome over the skull
  c.ellipse(hx - 0.5, hy - 2, 10.5, 8.5, 'steel');
  // re-open the face (skin inside the head ellipse, in front of the cheek guard)
  for (let y = hy - 2; y <= hy + 8; y++)
    for (let x = hx - 2; x <= hx + 10; x++)
      if (((x - hx) / 9) ** 2 + ((y - hy) / 8) ** 2 <= 1.02 || (y > hy + 5 && x < hx + 5 && x > hx - 5)) c.px(x, y, 'skin');
  // brow ridge projecting forward, cheek guard and crest
  c.poly([h(-3, -6), h(11, -5), h(11, -3), h(-3, -3)], 'iron');
  c.poly([h(-11, -2), h(-3, -2), h(-4, 8), h(-9, 8)], 'steel');
  c.rect(hx - 9, hy + 2, 6, 1, 'iron');
  c.rect(hx + 4, hy - 3, 1, 5, 'iron');
  c.rect(hx - 8, hy - 11, 14, 2, 'iron');
  c.rect(hx - 6, hy - 10, 10, 1, 'fCoal6');
  // plume
  c.poly([h(-4, -10), h(3, -12), h(-6, -15), h(-12, -13), h(-14, -7), h(-9, -8)], 'ember');
  c.line(hx - 11, hy - 11, hx - 4, hy - 11, 'fEmber');
}

function scholarHair(c: Canvas, f: Frame, h: (dx: number, dy: number) => Pt) {
  const { hx, hy } = f;
  // long hair behind the ear
  c.poly([h(-10, -2), h(-11, 8), h(-8, 12), h(-4, 10), h(-4, 3)], 'violet');
  // bowl cut with a side-swept fringe that stops above the brow
  c.poly([h(-10, 2), h(-10.5, -3), h(-8, -8), h(-2, -10.5), h(5, -10), h(9.5, -5.5), h(9, -4), h(6, -5), h(3, -6.5), h(-1, -5.5), h(-4, -3), h(-5, 3), h(-7, 4)], 'violet');
  c.line(hx - 6, hy - 8, hx + 3, hy - 9, 'fViolet');
  c.line(hx + 1, hy - 7, hx + 6, hy - 6, 'fViolet');
  c.line(hx - 9, hy - 1, hx - 8, hy + 6, 'fViolet7');
  // teal bookmark ribbon
  c.rect(hx - 8, hy - 5, 17, 1, 'fTeal5');
  c.poly([h(-8, -5), h(-12, -2), h(-13, 5), h(-10, 6), h(-10, -1)], 'teal');
}

function glasses(c: Canvas, f: Frame) {
  const ex1 = f.hx + 1;
  const ex2 = f.hx + 6;
  const ey = f.hy;
  const ring = (x: number) => {
    c.rect(x - 1, ey - 1, 4, 1, 'fGold5');
    c.rect(x - 1, ey + 2, 4, 1, 'fGold5');
    c.rect(x - 1, ey, 1, 2, 'fGold5');
    c.rect(x + 2, ey, 1, 2, 'fGold5');
  };
  ring(ex1);
  ring(ex2);
  c.px(ex1 + 3, ey, 'fGold5');
  c.line(ex1 - 2, ey, f.hx - 6, ey, 'fGold5');
}
