import { Canvas, type Pt } from '../draw/canvas';
import { defaultFrame } from './frames';

/** Original student-adventurer heroes, side view facing right, 64x64, feet on row 59. */
export const HERO_SIZE = 64;
export const HERO_GROUND = 59;
/** Heroes stand this many pixels right of the pose table's origin, leaving room for capes and recoil on the left. */
export const HERO_X0 = 2;
export const HERO_CLASSES = ['warrior', 'tank', 'scholar'] as const;
export type HeroClass = (typeof HERO_CLASSES)[number];
export const HERO_STATES = ['idle', 'attack', 'hit', 'defeat', 'victory'] as const;
export type HeroState = (typeof HERO_STATES)[number];
/**
 * Draw order. `face` is a flat, outline-free decal (eyes, brows, mouth, glasses) so features never disturb the
 * skin shading; `offhand` carries the Tank's shield and the Scholar's book; `weapon` is replaceable gear.
 */
export const HERO_LAYERS = ['shadow', 'back', 'body', 'face', 'armor', 'offhand', 'weapon'] as const;
export type HeroLayer = (typeof HERO_LAYERS)[number];

/** Frames per state: a two-frame idle and a three-frame attack (wind-up, impact, recovery). */
export const HERO_FRAMES = { idle: 2, attack: 3, hit: 1, defeat: 1, victory: 1 } as const satisfies Record<HeroState, number>;
export { ATTACK_PHASES, type AttackPhase } from './frames';

export type Eyes = 'open' | 'fierce' | 'wince' | 'closed' | 'happy';
export type Mouth = 'flat' | 'grit' | 'shout' | 'o' | 'smile' | 'grin';

/** One pose. Coordinates are for a body at dx = 0; the frame adds dx. */
export interface Pose {
  dx: number;
  /** Shoulders and head lowered by this much (breath, crouch). */
  down: number;
  /** Hips lowered by this much (legs bend). */
  hip: number;
  /** Shoulders forward of the hips. */
  lean: number;
  headDx: number;
  headDy: number;
  /** Foot x offsets from the hip centre. */
  back: number;
  front: number;
  kneel: boolean;
  hand: Pt;
  /** Direction the weapon points from the near hand. */
  wdir: Pt;
  farHand: Pt;
  eyes: Eyes;
  mouth: Mouth;
  /** Cape / robe swing, -2..2. */
  sway: number;
}

const P = (o: Partial<Pose> & Pick<Pose, 'hand' | 'wdir'>): Pose => ({
  dx: 0, down: 0, hip: 0, lean: 0, headDx: 0, headDy: 0, back: -7, front: 6, kneel: false,
  farHand: [14, 41], eyes: 'open', mouth: 'flat', sway: 0, ...o,
});

export const POSES: Readonly<Record<HeroState, readonly Pose[]>> = {
  idle: [
    P({ lean: 1, hand: [35, 37], wdir: [0.5, -0.87] }),
    P({ lean: 1, down: 1, hand: [35, 38], wdir: [0.5, -0.87], farHand: [14, 42], sway: 1 }),
  ],
  attack: [
    // wind-up: coil back, weapon drawn behind
    P({ dx: -1, down: 3, hip: 3, lean: -3, headDx: -1, headDy: 1, back: -9, front: 7, hand: [13, 35], wdir: [-0.6, -0.8], farHand: [29, 38], eyes: 'fierce', mouth: 'grit', sway: -1 }),
    // impact: full lunge, cut finishing low and forward
    P({ dx: 3, down: 4, hip: 4, lean: 5, headDx: 2, headDy: 1, back: -11, front: 9, hand: [43, 37], wdir: [0.78, 0.62], farHand: [11, 34], eyes: 'fierce', mouth: 'shout', sway: 2 }),
    // recovery: weapon swings low, weight comes back
    P({ dx: 2, down: 2, hip: 2, lean: 3, headDx: 1, back: -9, front: 8, hand: [37, 38], wdir: [0.9, 0.43], farHand: [12, 38], eyes: 'open', mouth: 'o', sway: 1 }),
  ],
  hit: [P({ dx: -3, down: 1, lean: -4, headDx: -2, headDy: 1, back: -8, front: 3, hand: [29, 40], wdir: [0.55, -0.83], farHand: [13, 36], eyes: 'wince', mouth: 'o', sway: 2 })],
  defeat: [P({ down: 14, hip: 10, lean: 5, headDx: 3, headDy: 5, kneel: true, back: -12, front: 10, hand: [42, 46], wdir: [0, 1], farHand: [26, 49], eyes: 'closed', mouth: 'flat' })],
  victory: [P({ dx: 1, hand: [40, 28], wdir: [0.3, -0.95], farHand: [14, 24], eyes: 'happy', mouth: 'grin', sway: -1 })],
};

interface ClassBase {
  tl: Pt; tr: Pt; br: Pt; bl: Pt;
  hx: number; hy: number; legW: number; handDx: number;
}
const BASE: Record<HeroClass, ClassBase> = {
  warrior: { tl: [13, 27], tr: [31, 27], br: [27, 42], bl: [16, 42], hx: 24, hy: 17, legW: 5, handDx: 0 },
  tank: { tl: [10, 27], tr: [31, 27], br: [30, 43], bl: [11, 43], hx: 22, hy: 18, legW: 7, handDx: 1 },
  scholar: { tl: [16, 27], tr: [28, 27], br: [27, 42], bl: [17, 42], hx: 24, hy: 17, legW: 4, handDx: 0 },
};

export interface Frame {
  cls: HeroClass;
  state: HeroState;
  index: number;
  p: Pose;
  /** Head centre. */
  hx: number;
  hy: number;
  /** Torso quad corners (top-left, top-right, bottom-right, bottom-left). */
  tl: Pt; tr: Pt; br: Pt; bl: Pt;
  top: number;
  bottom: number;
  hipX: number;
  /** Near / far shoulder joints. */
  sh: Pt;
  fsh: Pt;
  hand: Pt;
  farHand: Pt;
  wdir: Pt;
  legW: number;
}

export const clampFrame = (state: HeroState, index: number): number => {
  const n = HERO_FRAMES[state];
  return Number.isFinite(index) ? Math.min(n - 1, Math.max(0, Math.trunc(index))) : 0;
};

export function frame(cls: HeroClass, state: HeroState, index = defaultFrame(state)): Frame {
  const i = clampFrame(state, index);
  const p = POSES[state][i] as Pose;
  const b = BASE[cls];
  const ox = p.dx + HERO_X0;
  const lean = Math.round(p.lean);
  const top = 27 + p.down;
  const bottom = b.bl[1] + p.hip;
  const tl: Pt = [b.tl[0] + ox + lean, top];
  const tr: Pt = [b.tr[0] + ox + lean, top];
  const br: Pt = [b.br[0] + ox, bottom];
  const bl: Pt = [b.bl[0] + ox, bottom];
  return {
    cls, state, index: i, p, tl, tr, br, bl, top, bottom, legW: b.legW,
    hx: b.hx + ox + Math.round(lean * 0.6) + p.headDx,
    hy: b.hy + p.down + p.headDy,
    hipX: Math.round((bl[0] + br[0]) / 2),
    sh: [tr[0] - 3, top + 4],
    fsh: [tl[0] + 3, top + 4],
    hand: [p.hand[0] + ox + b.handDx, p.hand[1]],
    farHand: [p.farHand[0] + ox, p.farHand[1]],
    wdir: p.wdir,
  };
}

export const norm = (v: Pt): Pt => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

/** Two-bone elbow between a shoulder and a hand; bends towards `bias` (default: down and back). */
export function elbow(a: Pt, b: Pt, l1: number, l2: number, bias: Pt = [-0.3, 1]): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy) || 1, l1 + l2 - 0.01);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / (Math.hypot(dx, dy) || 1);
  const uy = dy / (Math.hypot(dx, dy) || 1);
  const mx = a[0] + ux * along;
  const my = a[1] + uy * along;
  const c1: Pt = [mx - uy * h, my + ux * h];
  const c2: Pt = [mx + uy * h, my - ux * h];
  const s1 = c1[0] * bias[0] + c1[1] * bias[1];
  const s2 = c2[0] * bias[0] + c2[1] * bias[1];
  return s1 >= s2 ? c1 : c2;
}

export const shadowLayer = (f: Frame): Canvas => {
  const c = new Canvas(HERO_SIZE, HERO_SIZE);
  c.ellipse(f.hipX + 1, 60.5, f.state === 'defeat' ? 17 : 15, 2, 'fCoal8');
  return c;
};
