import type { AnswerResultDto, BattleDto, BattleSummaryDto } from '@studyverse/shared';

/** Test and screenshot fixtures for the battle screen. */
export function fakeResult(over: Partial<AnswerResultDto> = {}): AnswerResultDto {
  return {
    turnNumber: 1, move: 'steady', intent: 'strike', correct: true, selectedIndex: 0, correctIndex: 0, explanation: null,
    damageDealt: 0, damageTaken: 0, enemyHealed: 0, heroHealed: 0, combo: 0, focusGained: 0, events: [], ended: false, outcome: null,
    ...over,
  };
}

export function fakeBattle(over: Partial<BattleDto> = {}): BattleDto {
  return {
    id: 'b1', mode: 'raid', status: 'active', phase: 'awaitingMove', subject: 'Math', tier: 1,
    dungeon: { slug: 'archive', name: 'The Whispering Archive', background: 'dungeon.archive' },
    turn: 1,
    hero: { hp: 100, maxHp: 100, atk: 13, def: 6, level: 1, playerClass: 'warrior', weapon: { slug: 'iron-sword', name: 'Iron Sword', rarity: 'common', effect: null }, armor: { slug: 'leather-armor', name: 'Leather Armor', rarity: 'common', effect: null }, perks: ['Warrior: +2 base damage on correct answers'] },
    enemy: { hp: 72, maxHp: 72, atk: 9, def: 3, slug: 'goblin-chieftain', name: 'Goblin Chieftain', isBoss: false, bossPhase: 1, intro: null },
    combo: 0, focus: 0, focusMax: 3,
    intent: { key: 'strike', name: 'Strike', effect: 'A plain attack.', bossGuard: false },
    move: null, question: null, removedIndex: null, armed: null, abilities: [], questionsAsked: 0, correctAnswers: 0,
    lastResult: null, log: ['Battle started!'], startedAt: '2026-10-30T12:00:00.000Z', endedAt: null,
    ...over,
  };
}

export function fakeSummary(over: Partial<BattleSummaryDto> = {}): BattleSummaryDto {
  return {
    battleId: 'b1', mode: 'raid', outcome: 'victory', subject: 'Math', tier: 1,
    enemy: { slug: 'goblin-chieftain', name: 'Goblin Chieftain', isBoss: false },
    asked: 6, correct: 5, xp: { requested: 28, awarded: 28, capped: false, dailyCap: null }, energy: 1,
    loot: null, firstClear: null, missed: [], weakSpot: null, levelsGained: 0,
    progress: { level: 1, totalXp: 28, currentLevelXp: 28, xpForNextLevel: 100, streak: 1, studyEnergy: 7, skillPoints: 0, raidWins: 1, raidLosses: 0 },
    alreadyFinished: false,
    ...over,
  };
}
