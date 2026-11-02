import { BATTLE, getEnemy, type IntentKey } from '@studyverse/shared';
import { pick, rngFor } from './rng.js';
import type { EngineState } from './types.js';

/** What the enemy telegraphs at the start of `state.turn`. Pure in (seed, turn, enemy, boss phase). */
export function rollIntent(
  s: Pick<EngineState, 'seed' | 'turn' | 'enemySlug' | 'bossPhase'>,
): { intent: IntentKey; bossGuard: boolean } {
  const rng = rngFor(s.seed, s.turn, 'intent');
  const def = getEnemy(s.enemySlug);
  const pool: readonly IntentKey[] = def?.intents ?? ['strike'];
  if (s.enemySlug === 'clockwork-titan') {
    if (s.turn % BATTLE.boss.titanGuardEvery === 0) return { intent: 'guard', bossGuard: true };
    return { intent: pick(pool.filter((i) => i !== 'guard'), rng), bossGuard: false };
  }
  if (s.enemySlug === 'archivist-lich' && s.bossPhase >= 2 && s.turn % BATTLE.boss.lichDrainEvery === 0) {
    return { intent: 'drain', bossGuard: false };
  }
  return { intent: pick(pool, rng), bossGuard: false };
}
