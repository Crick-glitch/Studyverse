import { describe, expect, it } from 'vitest';
import { validateGrid, type PixelGrid } from '../grid';
import { MANIFEST, animOf, isGridEntry } from '../manifest';
import { ALL_ENEMIES, ENEMY_FRAMES, enemyGrid, enemyStates, type EnemyState } from './enemies';
import { ATTACK_PHASES, defaultFrame } from './frames';
import { HERO_CLASSES, HERO_FRAMES, HERO_SIZE, HERO_STATES, WEAPON_SLUGS, heroGrid, heroLayerGrid } from './hero';

const same = (a: PixelGrid, b: PixelGrid) => a.rows.join('') === b.rows.join('');
const touchesEdge = (g: PixelGrid) =>
  g.rows[0]!.replaceAll('.', '') !== '' ||
  g.rows[g.h - 1]!.replaceAll('.', '') !== '' ||
  g.rows.some((r) => r[0] !== '.' || r[g.w - 1] !== '.');
const opaque = (g: PixelGrid) => {
  const s = new Set<string>();
  g.rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && s.add(`${x},${y}`)));
  return s;
};
const framesOf = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('hero frames', () => {
  it('has a two-frame idle and a wind-up / impact / recovery attack', () => {
    expect(HERO_FRAMES.idle).toBe(2);
    expect(HERO_FRAMES.attack).toBe(ATTACK_PHASES.length);
    expect(ATTACK_PHASES).toEqual(['windup', 'impact', 'recovery']);
  });

  describe.each(HERO_CLASSES)('%s', (cls) => {
    it('every frame of every state is a valid 64x64 grid that never touches the canvas edge', () => {
      for (const state of HERO_STATES) {
        for (const frame of framesOf(HERO_FRAMES[state])) {
          for (const weapon of WEAPON_SLUGS) {
            const g = heroGrid(cls, state, { frame, weapon });
            expect(validateGrid(g)).toEqual([]);
            expect([g.w, g.h]).toEqual([HERO_SIZE, HERO_SIZE]);
            expect(touchesEdge(g)).toBe(false);
          }
        }
      }
    });

    it('the two idle frames differ, and the three attack frames all differ from each other and from idle', () => {
      expect(same(heroGrid(cls, 'idle', { frame: 0 }), heroGrid(cls, 'idle', { frame: 1 }))).toBe(false);
      const atk = framesOf(3).map((frame) => heroGrid(cls, 'attack', { frame }));
      expect(new Set(atk.map((g) => g.rows.join(''))).size).toBe(3);
      const idle = heroGrid(cls, 'idle', { frame: 0 });
      atk.forEach((g) => expect(same(g, idle)).toBe(false));
    });

    it('a still attack shows the impact frame, and an out-of-range frame is clamped', () => {
      expect(defaultFrame('attack')).toBe(1);
      expect(same(heroGrid(cls, 'attack'), heroGrid(cls, 'attack', { frame: 1 }))).toBe(true);
      expect(same(heroGrid(cls, 'idle', { frame: 99 }), heroGrid(cls, 'idle', { frame: 1 }))).toBe(true);
      expect(same(heroGrid(cls, 'hit', { frame: -3 }), heroGrid(cls, 'hit'))).toBe(true);
    });

    it('no weapon, in any frame, is ever drawn over the eyes, brows or mouth', () => {
      for (const state of HERO_STATES) {
        for (const frame of framesOf(HERO_FRAMES[state])) {
          const face = opaque(heroLayerGrid(cls, state, 'face', { frame }));
          expect(face.size).toBeGreaterThan(5);
          for (const weapon of WEAPON_SLUGS) {
            const w = opaque(heroLayerGrid(cls, state, 'weapon', { frame, weapon }));
            expect([...face].filter((p) => w.has(p))).toEqual([]);
          }
        }
      }
    });
  });

  it('classes differ by silhouette, not only by headgear', () => {
    // Composed silhouette (every layer the player sees, no shadow) at idle. Measured when this test was
    // written: the old shared-body design had class pairs differing by 133-289 pixels, the redraw by 481-571.
    const layers = ['back', 'body', 'face', 'armor', 'offhand', 'weapon'] as const;
    const shape = (cls: (typeof HERO_CLASSES)[number]) => {
      const gs = layers.map((l) => heroLayerGrid(cls, 'idle', l, {}));
      return Array.from({ length: HERO_SIZE }, (_, y) =>
        Array.from({ length: HERO_SIZE }, (_, x) => (gs.some((g) => g.rows[y]![x] !== '.') ? '#' : '.')).join(''),
      );
    };
    const diff = (a: string[], b: string[]) => a.reduce((n, r, y) => n + [...r].filter((ch, x) => ch !== b[y]![x]).length, 0);
    const [w, t, s] = HERO_CLASSES.map(shape) as [string[], string[], string[]];
    expect(diff(w, t)).toBeGreaterThan(400);
    expect(diff(w, s)).toBeGreaterThan(400);
    expect(diff(t, s)).toBeGreaterThan(400);
  });
});

describe('enemy frames', () => {
  const frames = (state: EnemyState) => framesOf(ENEMY_FRAMES[state]);

  it('keeps the same state list but gives idle two frames and attack three', () => {
    expect(ENEMY_FRAMES.idle).toBe(2);
    expect(ENEMY_FRAMES.attack).toBe(3);
    expect(ENEMY_FRAMES.hit).toBe(1);
    expect(ENEMY_FRAMES.defeat).toBe(1);
  });

  describe.each(ALL_ENEMIES.map((e) => [e.slug, e.size] as const))('%s', (slug, size) => {
    it('every frame of every state is a valid grid of the declared size and never touches the edge', () => {
      for (const state of enemyStates(slug)) {
        for (const frame of frames(state)) {
          for (const flash of [false, true]) {
            const g = enemyGrid(slug, state, { frame, flash });
            expect(validateGrid(g)).toEqual([]);
            expect([g.w, g.h]).toEqual([size, size]);
            expect(touchesEdge(g)).toBe(false);
          }
        }
      }
    });

    it('the idle frames differ, the attack frames differ from each other, and the default attack is the impact', () => {
      expect(same(enemyGrid(slug, 'idle', { frame: 0 }), enemyGrid(slug, 'idle', { frame: 1 }))).toBe(false);
      const atk = frames('attack').map((frame) => enemyGrid(slug, 'attack', { frame }));
      expect(new Set(atk.map((g) => g.rows.join(''))).size).toBe(3);
      expect(same(enemyGrid(slug, 'attack'), atk[1]!)).toBe(true);
    });
  });
});

describe('manifest animation metadata', () => {
  const grids = Object.values(MANIFEST).filter(isGridEntry);

  it('describes every multi-frame state, with a duration per frame', () => {
    for (const e of grids.filter((g) => g.group === 'hero' || g.group === 'monster')) {
      for (const st of e.states) {
        const a = animOf(e, st);
        const expected = e.group === 'hero' ? HERO_FRAMES[st as keyof typeof HERO_FRAMES] : ENEMY_FRAMES[st as EnemyState];
        expect(a.frames).toBe(expected);
        expect(a.ms).toHaveLength(a.frames);
        expect(a.still).toBeGreaterThanOrEqual(0);
        expect(a.still).toBeLessThan(a.frames);
        if (a.frames > 1) {
          expect(a.ms.every((ms) => ms >= 60 && ms <= 1000)).toBe(true);
          expect(a.loop).toBe(st === 'idle' || st === 'phase2');
        }
      }
    }
  });

  it('every frame of every animated grid entry renders at the entry size', () => {
    for (const e of grids) {
      for (const st of e.states) {
        for (const frame of framesOf(animOf(e, st).frames)) {
          const g = e.grid(st, { frame });
          expect(validateGrid(g)).toEqual([]);
          expect([g.w, g.h]).toEqual([e.size.w, e.size.h]);
        }
      }
    }
  });
});
