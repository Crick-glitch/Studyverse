import type { PixelGrid } from '../grid';
import { bloomBrute, dragonHatchling, goblinChieftain, orcWarlord, shadowAssassin } from './enemies-beasts';
import { gearworkGolem, hollowMage, inkwraith, mimicTome } from './enemies-arcane';
import { archivistLich, clockworkTitan, procrastinationWyrm } from './bosses';
import { renderEnemy, type EnemyDef, type EnemyOpts, type EnemyState } from './enemy-kit';

export { ENEMY_FRAMES, ENEMY_STATES, type EnemyState } from './enemy-kit';

/** Regular enemies, in the order of the roster in 04-rpg-design-spec.md. */
export const REGULAR_ENEMIES: readonly EnemyDef[] = [
  goblinChieftain,
  orcWarlord,
  dragonHatchling,
  hollowMage,
  shadowAssassin,
  gearworkGolem,
  inkwraith,
  bloomBrute,
  mimicTome,
];
export const BOSS_ENEMIES: readonly EnemyDef[] = [procrastinationWyrm, archivistLich, clockworkTitan];
export const ALL_ENEMIES: readonly EnemyDef[] = [...REGULAR_ENEMIES, ...BOSS_ENEMIES];

export const ENEMY_SLUGS = ALL_ENEMIES.map((e) => e.slug);
const BY_SLUG = new Map(ALL_ENEMIES.map((e) => [e.slug, e]));

export const getEnemyDef = (slug: string): EnemyDef | undefined => BY_SLUG.get(slug);
export const isBoss = (slug: string): boolean => BOSS_ENEMIES.some((e) => e.slug === slug);
/** Bosses have a phase-2 look; regular enemies do not. */
export const enemyStates = (slug: string): readonly EnemyState[] =>
  isBoss(slug) ? ['idle', 'attack', 'hit', 'defeat', 'phase2'] : ['idle', 'attack', 'hit', 'defeat'];

export function enemyGrid(slug: string, state: EnemyState, opts: EnemyOpts = {}): PixelGrid {
  const def = BY_SLUG.get(slug);
  if (!def) throw new Error(`Unknown enemy: ${slug}`);
  if (state === 'phase2' && !def.phase2) throw new Error(`${slug} has no phase 2`);
  return renderEnemy(def, state, opts);
}
