import {
  BATTLE,
  DAILY_XP_CAPS,
  FIRST_CLEAR_XP,
  battleEnergy,
  battleXp,
  getBoss,
  getEnemy,
  isBossSlug,
  rollRarity,
  type BattleLootDto,
  type BattleMissedDto,
  type BattleSummaryDto,
  type RarityKey,
} from '@studyverse/shared';
import { accuracyOf } from '../battle/engine.js';
import { pick, rngFor } from '../battle/rng.js';
import type { Battle, BattleTurn, ItemDefinition } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import type { Prisma } from '../lib/prisma.js';
import { grantXp, type GrantXpResult } from '../lib/xp.js';
import { parseStored } from './battleTypes.js';
import { onFirstClear } from './battleHooks.js';
import { toProgressDto } from './player.js';
import { recordQuestEvent } from './quests.js';
import { addEnergy, touchStreak } from './streak.js';

type Tx = Prisma.TransactionClient;

export const battleNotFound = () => new AppError(404, 'BATTLE_NOT_FOUND', 'Battle not found');

type LootCandidate = Pick<ItemDefinition, 'id' | 'slug' | 'rarity'>;

/**
 * The drop. Both rolls come from the battle's stored seed, so a replay can never re-roll it. `pity` forces at
 * least uncommon. If a rarity has no items in the catalog the roll falls back to the whole catalog.
 */
export function chooseLoot<T extends LootCandidate>(
  seed: number,
  isBoss: boolean,
  pity: boolean,
  catalog: readonly T[],
): T | null {
  if (catalog.length === 0) return null;
  const rarity: RarityKey = rollRarity(rngFor(seed, 0, 'loot-rarity')(), isBoss, pity);
  const sameRarity = catalog.filter((d) => d.rarity === rarity);
  return pick(sameRarity.length > 0 ? sameRarity : catalog, rngFor(seed, 0, 'loot-item'));
}

/**
 * Pity: the player's last `pityAfter` finished REGULAR raid victories all dropped a common (or nothing).
 * Needs a full window; boss victories are not part of it.
 */
async function pityActive(tx: Tx, userId: string, battleId: string): Promise<boolean> {
  const rows = await tx.battle.findMany({
    where: { userId, mode: 'raid', status: 'victory', rewardsGrantedAt: { not: null }, id: { not: battleId } },
    orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
    take: BATTLE.loot.pityAfter * 4,
    select: { enemySlug: true, rewardSummary: true },
  });
  const regular = rows.filter((r) => !isBossSlug(r.enemySlug)).slice(0, BATTLE.loot.pityAfter);
  if (regular.length < BATTLE.loot.pityAfter) return false;
  return regular.every((r) => {
    const loot = (r.rewardSummary as { loot?: { rarity?: string } | null } | null)?.loot;
    return !loot || loot.rarity === 'common';
  });
}

async function awardLoot(
  tx: Tx,
  userId: string,
  row: Battle,
  isBoss: boolean,
): Promise<BattleLootDto | null> {
  const pity = !isBoss && (await pityActive(tx, userId, row.id));
  const def = chooseLoot(row.seed, isBoss, pity, await tx.itemDefinition.findMany());
  if (!def) return null;
  const full = await tx.itemDefinition.findUniqueOrThrow({ where: { id: def.id } });
  const owned = await tx.playerItem.findFirst({ where: { userId, itemDefinitionId: full.id }, select: { id: true } });
  const dto: BattleLootDto = {
    slug: full.slug,
    name: full.name,
    slot: full.slot,
    rarity: full.rarity,
    atk: full.atk,
    def: full.def,
    effect: full.effectKey,
    equipped: false,
    duplicate: owned !== null,
    duplicateXp: owned ? BATTLE.rewards.duplicateXp[full.rarity] : 0,
  };
  if (owned) return dto; // a duplicate pays bonus XP instead (no second currency)
  const item = await tx.playerItem.create({ data: { userId, itemDefinitionId: full.id, source: 'battle' } });
  const eq = await tx.equipment.findUnique({ where: { userId } });
  const slotEmpty = full.slot === 'weapon' ? !eq?.weaponItemId : !eq?.armorItemId;
  if (slotEmpty) {
    const field = full.slot === 'weapon' ? { weaponItemId: item.id } : { armorItemId: item.id };
    await tx.equipment.upsert({ where: { userId }, create: { userId, ...field }, update: field });
    dto.equipped = true; // only ever into an EMPTY slot; Camp does the rest (session 07)
  }
  return dto;
}

function missedFrom(turns: BattleTurn[]): { missed: BattleMissedDto[]; weakSpot: BattleSummaryDto['weakSpot'] } {
  const seen = new Set<string>();
  const missed: BattleMissedDto[] = [];
  const bySubject = new Map<string, number>();
  for (const t of turns) {
    if (t.correct !== false || t.questionText === null || t.correctIndex === null) continue;
    const key = t.questionId ?? t.cardId ?? t.questionText;
    if (seen.has(key)) continue; // a question missed twice is listed once
    seen.add(key);
    const subject = t.questionSubject ?? 'Other';
    bySubject.set(subject, (bySubject.get(subject) ?? 0) + 1);
    missed.push({
      turnNumber: t.turnNumber,
      subject,
      text: t.questionText,
      choices: t.choices,
      correctIndex: t.correctIndex,
      selectedIndex: t.selectedIndex,
      explanation: t.explanation,
      isCard: t.cardId !== null,
    });
  }
  const top = [...bySubject.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { missed, weakSpot: top ? { subject: top[0], missed: top[1] } : null };
}

/**
 * Pays a finished battle, ONCE, in the caller's transaction (the caller holds the player lock).
 *
 * - raid: ledger `battle`/battleId; defeat pays 40%; victory adds loot, +1 energy (+1 Scholar), a raid win and
 *   quest progress; a boss victory also pays the one-time first-clear bonus (`first_clear`/bossSlug).
 * - practice: ledger `battle_practice`/battleId at 25%, under the daily cap, never leaderboard-eligible; no loot,
 *   energy, raid wins or quest wins.
 * - retreat: pays nothing.
 * The result is stored on the battle; a second call returns it unchanged with `alreadyFinished: true`.
 */
export async function finishBattleInTx(
  tx: Tx,
  userId: string,
  battleId: string,
  now: Date,
): Promise<BattleSummaryDto> {
  const row = await tx.battle.findFirst({ where: { id: battleId, userId } });
  if (!row) throw battleNotFound();
  if (row.rewardsGrantedAt && row.rewardSummary) {
    return { ...(row.rewardSummary as unknown as BattleSummaryDto), alreadyFinished: true };
  }
  if (row.status === 'active') {
    throw new AppError(409, 'BATTLE_NOT_OVER', 'Finish the battle (or retreat) before claiming rewards.');
  }
  const outcome = row.status;
  const s = parseStored(row).engine;
  const turns = await tx.battleTurn.findMany({
    where: { battleId, answeredAt: { not: null } },
    orderBy: { turnNumber: 'asc' },
  });
  const { missed, weakSpot } = missedFrom(turns);
  const enemy = getEnemy(s.enemySlug);
  const boss = getBoss(s.enemySlug);
  const raid = row.mode === 'raid';
  const victory = outcome === 'victory';

  let xp: BattleSummaryDto['xp'] = { requested: 0, awarded: 0, capped: false, dailyCap: null };
  let energy = 0;
  let loot: BattleLootDto | null = null;
  let firstClear: BattleSummaryDto['firstClear'] = null;
  let levelsGained = 0;

  if (outcome !== 'retreated') {
    if (raid && victory) loot = await awardLoot(tx, userId, row, s.isBoss);
    const requested = battleXp({
      level: s.hero.level,
      isBoss: s.isBoss,
      accuracy: accuracyOf(s),
      mode: row.mode,
      victory,
      scholar: s.hero.effects.scholar,
      gearXpMult: s.hero.effects.battleXpMult,
      ...(loot?.duplicate && { duplicateXp: loot.duplicateXp }),
    });
    const verdict = victory ? 'victory' : 'defeat';
    const paid: GrantXpResult = await grantXp(
      raid
        ? {
            userId, amount: requested, now,
            reason: `Raid ${verdict}: ${enemy?.name ?? s.enemySlug}`,
            sourceType: 'battle', sourceId: row.id, leaderboardEligible: true,
          }
        : {
            userId, amount: requested, now,
            reason: `Practice ${verdict}: ${enemy?.name ?? s.enemySlug}`,
            sourceType: 'battle_practice', sourceId: row.id, leaderboardEligible: false,
            dailyCap: { group: ['battle_practice'], amount: DAILY_XP_CAPS.battle_practice },
          },
      tx,
    );
    xp = { requested, awarded: paid.amount, capped: paid.capped, dailyCap: raid ? null : DAILY_XP_CAPS.battle_practice };
    levelsGained += paid.levelsGained;
    let rewarded = paid.amount > 0;

    if (raid) {
      await tx.playerProgress.update({
        where: { userId },
        data: victory ? { raidWins: { increment: 1 } } : { raidLosses: { increment: 1 } },
      });
      rewarded = true;
    }
    if (raid && victory) {
      energy = battleEnergy(s.hero.effects.scholar);
      await addEnergy(tx, userId, energy);
      await recordQuestEvent(tx, userId, 'battles_won', 1, now);
      if (s.isBoss && boss) {
        const bonus = FIRST_CLEAR_XP[row.tier as 1 | 2 | 3] ?? FIRST_CLEAR_XP[1];
        const fc = await grantXp(
          {
            userId, amount: bonus, now,
            reason: `First clear: ${boss.name}`,
            sourceType: 'first_clear', sourceId: boss.slug, leaderboardEligible: true,
          },
          tx,
        );
        firstClear = { bossSlug: boss.slug, xp: bonus, awarded: fc.granted };
        if (fc.granted) {
          levelsGained += fc.levelsGained;
          await onFirstClear(userId, boss.slug, tx);
        }
      }
    }
    if (rewarded) await touchStreak(tx, userId, now);
  }

  const summary: BattleSummaryDto = {
    battleId: row.id,
    mode: row.mode,
    outcome,
    subject: row.subject,
    tier: row.tier,
    enemy: { slug: s.enemySlug, name: enemy?.name ?? s.enemySlug, isBoss: s.isBoss },
    asked: s.tally.asked,
    correct: s.tally.correct,
    xp,
    energy,
    loot,
    firstClear,
    missed,
    weakSpot,
    levelsGained,
    progress: toProgressDto(await tx.playerProgress.findUniqueOrThrow({ where: { userId } })),
    alreadyFinished: false,
  };
  await tx.battle.update({
    where: { id: row.id },
    data: { rewardsGrantedAt: now, rewardSummary: summary as unknown as Prisma.InputJsonValue },
  });
  return summary;
}
