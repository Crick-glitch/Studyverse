import { Canvas, type Pt } from '../draw/canvas';
import { overlay, type PixelGrid } from '../grid';
import type { MaterialKey } from '../palette';
import { defaultFrame } from './frames';

export const ENEMY_STATES = ['idle', 'attack', 'hit', 'defeat'] as const;
export type EnemyState = (typeof ENEMY_STATES)[number] | 'phase2';

/** What a drawing function needs to know about the moment it is drawing. */
export interface Pose {
  /** Lunging at the hero: open mouths, raised weapons, glowing eyes. */
  atk: boolean;
  /** Recoiling from a hit: squinting eyes, shut mouths. */
  hurt: boolean;
  /** Boss phase 2: extra details (cracks, wisps, horns) on top of the recoloured body. */
  p2: boolean;
  /** Frame within the state (see ENEMY_FRAMES). */
  frame?: number;
  /** Attack wind-up (frame 0): coiled back, weapon not yet swung. Draw functions may raise a weapon here. */
  wind?: boolean;
  /** Second idle frame: draw functions may sway a cloak, flicker an orb, turn a cog. */
  idle2?: boolean;
}

/** Frames per state: a two-frame idle and a three-frame attack (wind-up, impact, recovery). */
export const ENEMY_FRAMES: Readonly<Record<EnemyState, number>> = { idle: 2, attack: 3, hit: 1, defeat: 1, phase2: 2 };

export type DefeatStyle = 'topple' | 'melt' | 'collapse';

export interface EnemyDef {
  slug: string;
  name: string;
  size: 48 | 96;
  /** Row the feet rest on. */
  ground: number;
  /** Whole pixels the sprite moves towards the hero on `attack`, and away on `hit`. */
  lunge: number;
  recoil: number;
  defeat: DefeatStyle;
  /** Optional deeper form shading (see `BakeOptions.rim`) for silhouettes that read as flat. */
  rim?: number;
  /** Present only for bosses: materials swapped when the boss reaches phase 2. */
  phase2?: Partial<Record<MaterialKey, MaterialKey>>;
  draw: (pose: Pose) => Canvas;
}

export interface EnemyOpts {
  /** One-frame white flash, normally combined with `hit`. */
  flash?: boolean;
  /** Frame within the state; defaults to the state's still frame (attack = impact). */
  frame?: number;
}

const shadowGrid = (def: EnemyDef, dx: number, wide: boolean): PixelGrid => {
  const c = new Canvas(def.size, def.size);
  const mid = def.size / 2 - 0.5 + dx;
  const rx = def.size === 96 ? (wide ? 40 : 34) : wide ? 17 : 13;
  c.ellipse(mid, def.ground + (def.size === 96 ? 3 : 1.5), rx, def.size === 96 ? 3 : 2, 'fCoal8');
  return c.bake({ outline: false });
};

/** First and last column holding any opaque cell. */
const opaqueXRange = (g: PixelGrid): [number, number] => {
  let x0 = g.w;
  let x1 = -1;
  for (const row of g.rows) {
    for (let x = 0; x < g.w; x++) {
      if (row[x] !== '.') {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  return [x0, x1];
};

const cache = new Map<string, PixelGrid>();

/** Compose one enemy frame. Every state comes from the same drawing, so silhouettes stay consistent. */
export function renderEnemy(def: EnemyDef, state: EnemyState, opts: EnemyOpts = {}): PixelGrid {
  const count = ENEMY_FRAMES[state];
  const raw = opts.frame ?? defaultFrame(state);
  const fr = Number.isFinite(raw) ? Math.min(count - 1, Math.max(0, Math.trunc(raw))) : 0;
  const key = `${def.slug}|${state}|${fr}|${opts.flash ? 'f' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const attacking = state === 'attack';
  const pose: Pose = {
    atk: attacking && fr === 1,
    hurt: state === 'hit',
    p2: state === 'phase2',
    frame: fr,
    wind: attacking && fr === 0,
    idle2: (state === 'idle' || state === 'phase2') && fr === 1,
  };
  let body = def.draw(pose);
  const big = def.size === 96;
  if (pose.idle2) body = body.breathed(big ? 2 : 1);
  let dx = 0;
  if (attacking) {
    // wind-up coils away from the hero, impact lunges, recovery is halfway back
    if (fr === 0) {
      body = body.squashedY(big ? 0.97 : 0.94);
      dx = Math.max(1, Math.round(def.lunge * 0.5));
    } else if (fr === 1) dx = -def.lunge;
    else dx = -Math.round(def.lunge * 0.5);
  }
  if (state === 'hit') dx = def.recoil;
  if (dx) {
    // Lunge and recoil are limited so the sprite's outline never reaches the canvas edge (no clipping).
    const [x0, x1] = opaqueXRange(body.bake());
    dx = Math.max(1 - x0, Math.min(def.size - 2 - x1, dx));
    if (dx) body = body.shifted(dx, 0);
  }
  if (state === 'defeat') {
    if (def.defeat === 'topple') body = body.rotated(true).droppedTo(def.ground);
    // squashedY compresses for ratios below 1: ghosts melt to a puddle, big bodies sag
    else if (def.defeat === 'melt') body = body.squashedY(0.3).droppedTo(def.ground);
    else body = body.squashedY(0.45).droppedTo(def.ground);
  }
  const grid = overlay([
    shadowGrid(def, dx, state === 'defeat'),
    body.bake({
      flash: !!opts.flash,
      gray: state === 'defeat',
      rim: def.rim,
      remap: state === 'phase2' ? def.phase2 : undefined,
    }),
  ]);
  cache.set(key, grid);
  return grid;
}

/* ---------- drawing helpers shared by every enemy ---------- */

/** A thick curve: discs along a smooth path, radius interpolated between the given radii. */
export function tube(c: Canvas, pts: readonly Pt[], radii: number | readonly number[], m: MaterialKey): void {
  const r = (i: number, t: number): number => {
    if (typeof radii === 'number') return radii;
    const a = radii[Math.min(i, radii.length - 1)] ?? 1;
    const b = radii[Math.min(i + 1, radii.length - 1)] ?? a;
    return a + (b - a) * t;
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i] as Pt;
    const [x1, y1] = pts[i + 1] as Pt;
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      c.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r(i, t), m);
    }
  }
}

/** A cog: disc, eight teeth, dark hole. */
export function cog(c: Canvas, cx: number, cy: number, r: number, m: MaterialKey, hole: MaterialKey = 'coal'): void {
  c.disc(cx, cy, r, m);
  const t = r + 1;
  const d = Math.round(r * 0.72);
  const pts: Pt[] = [[0, -t], [0, t], [-t, 0], [t, 0], [-d, -d], [d, -d], [-d, d], [d, d]];
  for (const [x, y] of pts) c.rect(Math.round(cx + x) - 1, Math.round(cy + y) - 1, 2, 2, m);
  c.disc(cx, cy, Math.max(1, Math.round(r / 3)), hole);
}

/** A small closed book seen from the side. */
export function book(c: Canvas, x: number, y: number, w: number, h: number, cover: MaterialKey): void {
  c.rect(x, y, w, h, cover);
  c.rect(x + 1, y + h - 2, w - 2, 1, 'parch');
  c.rect(x, y + 1, 1, h - 2, 'gold');
}

/** A page: parchment rectangle with two ink lines. */
export function page(c: Canvas, x: number, y: number, w = 4, h = 5): void {
  c.rect(x, y, w, h, 'parch');
  c.rect(x + 1, y + 1, Math.max(1, w - 2), 1, 'fParch5');
  if (h > 3) c.rect(x + 1, y + 3, Math.max(1, w - 3), 1, 'fParch5');
}
