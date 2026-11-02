import {
  ABILITY_TEXT,
  BATTLE,
  BOSS_GUARD_EFFECT,
  INTENT_TEXT,
  getBoss,
  getDungeon,
  getEnemy,
  type BattleDto,
} from '@studyverse/shared';
import type { Battle } from '../generated/prisma/client.js';
import { abilityOptions, publicQuestion } from '../battle/engine.js';
import type { BattleExtras, StoredBattle } from './battleTypes.js';

/** Maps the stored battle to what the browser may see. The answer and explanation never appear here. */
export function toBattleDto(row: Battle, stored: StoredBattle, extras: BattleExtras): BattleDto {
  const s = stored.engine;
  const def = getEnemy(s.enemySlug);
  const boss = getBoss(s.enemySlug);
  const dungeon = getDungeon(s.tier);
  const q = publicQuestion(s);
  const intentText = INTENT_TEXT[s.intent];
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    phase: s.phase,
    subject: s.subject,
    tier: s.tier,
    dungeon: {
      slug: dungeon?.slug ?? 'archive',
      name: dungeon?.name ?? 'The Whispering Archive',
      background: dungeon?.background ?? 'dungeon.archive',
    },
    turn: s.turn,
    hero: {
      hp: s.heroHp,
      maxHp: s.hero.maxHp,
      atk: s.hero.atk + s.hero.effects.bonusAtk,
      def: s.hero.def,
      level: s.hero.level,
      playerClass: s.hero.playerClass,
      weapon: stored.meta.weapon,
      armor: stored.meta.armor,
      perks: stored.meta.perks,
    },
    enemy: {
      hp: s.enemyHp,
      maxHp: s.enemy.maxHp,
      atk: s.enemy.atk,
      def: s.enemy.def,
      slug: s.enemySlug,
      name: def?.name ?? s.enemySlug,
      isBoss: s.isBoss,
      bossPhase: s.bossPhase,
      intro: boss?.intro ?? null,
    },
    combo: s.combo,
    focus: s.focus,
    focusMax: BATTLE.focus.max,
    intent: {
      key: s.intent,
      name: s.bossGuard ? 'Iron Guard' : intentText.name,
      effect: s.bossGuard ? BOSS_GUARD_EFFECT : intentText.effect,
      bossGuard: s.bossGuard,
    },
    move: s.cur.move,
    question: q,
    removedIndex: s.cur.removedIndex,
    armed: s.armed,
    abilities: abilityOptions(s).map((o) => ({
      key: o.key,
      label: ABILITY_TEXT[o.key].label,
      effect: ABILITY_TEXT[o.key].effect,
      cost: BATTLE.focus.abilityCost,
      available: o.available,
      reason: o.reason,
      armed: o.armed,
    })),
    questionsAsked: s.tally.asked,
    correctAnswers: s.tally.correct,
    lastResult: extras.lastResult,
    log: extras.log,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
  };
}
