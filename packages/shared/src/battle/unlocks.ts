import { DUNGEONS, getBoss, getDungeon, type DungeonDef } from './roster.js';

/** What the unlock rules are derived from (all of it comes from raid `Battle` rows plus the level). */
export interface UnlockFacts {
  level: number;
  /** Boss slugs the player has defeated in a RAID (practice never counts). */
  defeatedBosses: readonly string[];
  /** Raid victories over regular enemies per tier. */
  raidWinsByTier: Readonly<Record<number, number>>;
}

export interface Gate {
  open: boolean;
  /** Why it is locked, in plain words; null when open. */
  reason: string | null;
}

export interface DungeonStatus {
  tier: DungeonDef['tier'];
  dungeon: Gate;
  boss: Gate;
  bossDefeated: boolean;
  raidWins: number;
  raidWinsNeeded: number;
}

const join = (parts: string[]): string => parts.join(' and ');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Opening rules of 04 "Dungeons, level gates and unlock rules": level, plus the previous boss for tiers 2 and 3. */
export function dungeonGate(d: DungeonDef, f: UnlockFacts): Gate {
  const needs: string[] = [];
  if (f.level < d.opensAtLevel) needs.push(`reach level ${d.opensAtLevel}`);
  if (d.requiresBossSlug && !f.defeatedBosses.includes(d.requiresBossSlug)) {
    needs.push(`defeat ${getBoss(d.requiresBossSlug)?.name ?? 'the previous boss'}`);
  }
  if (needs.length === 0) return { open: true, reason: null };
  const text = join(needs);
  return { open: false, reason: text.charAt(0).toUpperCase() + text.slice(1) };
}

/** The boss gate needs its dungeon open, the boss level, and 3 raid victories over regular enemies in that dungeon. */
export function bossGate(d: DungeonDef, f: UnlockFacts): Gate {
  const dun = dungeonGate(d, f);
  if (!dun.open) return { open: false, reason: dun.reason };
  const wins = f.raidWinsByTier[d.tier] ?? 0;
  const needs: string[] = [];
  if (f.level < d.bossOpensAtLevel) needs.push(`reach level ${d.bossOpensAtLevel}`);
  if (wins < d.bossGateRaidWins) {
    const n = d.bossGateRaidWins - wins;
    needs.push(`win ${n} more ${plural(n, 'raid', 'raids')} here`);
  }
  if (needs.length === 0) return { open: true, reason: null };
  const text = join(needs);
  return { open: false, reason: text.charAt(0).toUpperCase() + text.slice(1) };
}

export function dungeonStatus(tier: number, f: UnlockFacts): DungeonStatus | undefined {
  const d = getDungeon(tier);
  if (!d) return undefined;
  return {
    tier: d.tier,
    dungeon: dungeonGate(d, f),
    boss: bossGate(d, f),
    bossDefeated: f.defeatedBosses.includes(d.bossSlug),
    raidWins: f.raidWinsByTier[d.tier] ?? 0,
    raidWinsNeeded: d.bossGateRaidWins,
  };
}

export const allDungeonStatuses = (f: UnlockFacts): DungeonStatus[] =>
  DUNGEONS.map((d) => dungeonStatus(d.tier, f) as DungeonStatus);
