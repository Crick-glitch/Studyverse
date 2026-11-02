import { describe, expect, it } from 'vitest';
import { validateGrid, type PixelGrid } from './grid';
import { ALL_ENEMIES, BOSS_ENEMIES, REGULAR_ENEMIES, enemyGrid, enemyStates, type EnemyState } from './sprites/enemies';
import { ENEMY_STATES } from './sprites/enemy-kit';

const SPEC_SLUGS = [
  'goblin-chieftain', 'orc-warlord', 'dragon-hatchling', 'hollow-mage', 'shadow-assassin',
  'gearwork-golem', 'inkwraith', 'bloom-brute', 'mimic-tome',
  'procrastination-wyrm', 'archivist-lich', 'clockwork-titan',
];
const key = (g: PixelGrid) => g.rows.join('');
const column = (g: PixelGrid, x: number) => g.rows.map((r) => r[x]).join('');
const row = (g: PixelGrid, y: number) => g.rows[y] ?? '';
const empty = (s: string) => /^\.*$/.test(s);
/** Opaque cells at or above the feet; the ground shadow below them is ignored. */
const silhouette = (slug: string, ground: number) => {
  const g = enemyGrid(slug, 'idle');
  return new Set(g.rows.flatMap((r, y) => (y <= ground ? [...r].flatMap((c, x) => (c !== '.' ? [`${x},${y}`] : [])) : [])));
};

describe('enemy roster', () => {
  it('has exactly the 9 regular enemies and 3 bosses from the design spec', () => {
    expect(ALL_ENEMIES.map((e) => e.slug).sort()).toEqual([...SPEC_SLUGS].sort());
    expect(REGULAR_ENEMIES).toHaveLength(9);
    expect(BOSS_ENEMIES).toHaveLength(3);
  });

  it('regular enemies are 48px with 4 states; bosses are 96px with a 5th phase-2 state', () => {
    for (const e of REGULAR_ENEMIES) {
      expect(e.size).toBe(48);
      expect(enemyStates(e.slug)).toEqual(ENEMY_STATES);
    }
    for (const e of BOSS_ENEMIES) {
      expect(e.size).toBe(96);
      expect(enemyStates(e.slug)).toEqual([...ENEMY_STATES, 'phase2']);
    }
  });

  it('refuses phase 2 for a regular enemy and unknown slugs', () => {
    expect(() => enemyGrid('goblin-chieftain', 'phase2')).toThrow();
    expect(() => enemyGrid('nope', 'idle')).toThrow();
  });
});

describe.each(ALL_ENEMIES.map((e) => [e.slug, e] as const))('%s', (slug, def) => {
  const states = enemyStates(slug) as readonly EnemyState[];

  it.each(states)('%s is a valid grid of the right size', (st) => {
    const g = enemyGrid(slug, st);
    expect(g.w).toBe(def.size);
    expect(g.h).toBe(def.size);
    expect(validateGrid(g)).toEqual([]);
  });

  it('never touches the canvas edge in any state, with or without the hit flash (no clipping)', () => {
    for (const st of states) for (const flash of [false, true]) {
      const g = enemyGrid(slug, st, { flash });
      expect([`${st}${flash ? '+flash' : ''} left`, empty(column(g, 0))]).toEqual([`${st}${flash ? '+flash' : ''} left`, true]);
      expect([`${st}${flash ? '+flash' : ''} right`, empty(column(g, g.w - 1))]).toEqual([`${st}${flash ? '+flash' : ''} right`, true]);
      expect([`${st}${flash ? '+flash' : ''} top`, empty(row(g, 0))]).toEqual([`${st}${flash ? '+flash' : ''} top`, true]);
    }
  });

  it('every state looks different from idle, and the flash changes the frame', () => {
    const idle = key(enemyGrid(slug, 'idle'));
    for (const st of states.filter((s) => s !== 'idle')) expect(key(enemyGrid(slug, st))).not.toBe(idle);
    expect(key(enemyGrid(slug, 'hit', { flash: true }))).not.toBe(key(enemyGrid(slug, 'hit')));
  });

  it('is deterministic', () => {
    expect(key(enemyGrid(slug, 'attack'))).toBe(key(enemyGrid(slug, 'attack')));
  });
});

/** Share of the combined outline that differs. A recolour scores 0; two sprites built on one template score under 0.1. */
const MIN_DIFF = 0.2;

describe('silhouettes', () => {
  /** Monsters must differ by body shape, not just colour (05-art-and-sprites.md). */
  it.each([
    ['regular', REGULAR_ENEMIES],
    ['boss', BOSS_ENEMIES],
  ] as const)('every pair of %s enemies has a clearly different outline', (_n, list) => {
    const sil = list.map((e) => ({ slug: e.slug, s: silhouette(e.slug, e.ground) }));
    const tooClose: string[] = [];
    for (let i = 0; i < sil.length; i++) for (let j = i + 1; j < sil.length; j++) {
      const a = sil[i]!.s, b = sil[j]!.s;
      let inter = 0;
      for (const p of a) if (b.has(p)) inter++;
      const diff = 1 - inter / (a.size + b.size - inter);
      if (diff < MIN_DIFF) tooClose.push(`${sil[i]!.slug} vs ${sil[j]!.slug}: ${diff.toFixed(2)}`);
    }
    expect(tooClose).toEqual([]);
  });
});
